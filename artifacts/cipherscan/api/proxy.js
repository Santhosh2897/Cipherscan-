/**
 * CipherScan — Vercel BFF Proxy (api/proxy.js)
 *
 * Forwards all /api/* requests to the Render backend, injecting x-api-key
 * server-side so the key is never exposed to the client browser.
 *
 * Rate limits (per IP, per minute):
 *  - /api/analyze : 10 requests  (expensive: Playwright + VirusTotal + GSB)
 *  - all other    : 60 requests
 */

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// Map<ip, { count, windowStart }>
const rateLimitStore = new Map();
const WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip, maxRequests) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000) };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

// Purge stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > WINDOW_MS * 2) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60_000);
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const backendUrl = process.env.BACKEND_URL;
  const apiKey = process.env.APP_API_KEY;

  if (!backendUrl) {
    return res.status(500).json({ error: "BACKEND_URL is not configured." });
  }

  // Only allow expected HTTP methods
  const allowedMethods = new Set(["GET", "POST", "DELETE", "HEAD", "OPTIONS"]);
  const method = (req.method || "GET").toUpperCase();
  if (!allowedMethods.has(method)) {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Sanitize path to prevent upstream traversal
  const rawUrl = req.url || "/";
  const cleanPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;

  // ─── Rate limiting ───────────────────────────────────────────────────────────
  const clientIp =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  const isAnalyze = cleanPath.startsWith("/api/analyze");
  const maxRequests = isAnalyze ? 10 : 60;
  const limitKey = `${clientIp}:${isAnalyze ? "analyze" : "general"}`;
  const { allowed, remaining, retryAfter } = checkRateLimit(limitKey, maxRequests);

  res.setHeader("X-RateLimit-Limit", maxRequests);
  res.setHeader("X-RateLimit-Remaining", remaining ?? 0);

  if (!allowed) {
    res.setHeader("Retry-After", retryAfter ?? 60);
    return res.status(429).json({
      error: "Too Many Requests",
      message: `Rate limit exceeded. Max ${maxRequests} requests/minute for this endpoint. Retry in ${retryAfter}s.`,
    });
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Prevent confused deputy global data purges: DELETE requires explicit device identification
  if (method === "DELETE" && !req.headers["x-device-id"] && !rawUrl.includes("deviceId=")) {
    return res.status(400).json({
      error: "Bad Request",
      message: "DELETE requests through the proxy require an explicit deviceId parameter or x-device-id header."
    });
  }

  const upstream = `${backendUrl.replace(/\/$/, "")}${cleanPath}`;

  const forwardHeaders = {};
  const skipHeaders = new Set([
    "host",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "upgrade",
  ]);

  for (const [k, v] of Object.entries(req.headers || {})) {
    if (!skipHeaders.has(k.toLowerCase()) && typeof v === "string") {
      forwardHeaders[k] = v;
    }
  }

  if (apiKey) {
    forwardHeaders["x-api-key"] = apiKey;
  }

  try {
    let body;
    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      forwardHeaders["content-type"] = forwardHeaders["content-type"] || "application/json";
    }

    const upstreamRes = await fetch(upstream, {
      method: req.method || "GET",
      headers: forwardHeaders,
      body,
      redirect: "manual",
    });

    const data = await upstreamRes.arrayBuffer();

    // Copy response headers except compression headers that fetch already decoded
    upstreamRes.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (
        lower !== "content-encoding" &&
        lower !== "content-length" &&
        lower !== "transfer-encoding" &&
        lower !== "connection"
      ) {
        res.setHeader(key, val);
      }
    });

    res.status(upstreamRes.status);
    return res.send(Buffer.from(data));
  } catch (err) {
    return res.status(502).json({ error: "Proxy upstream error: " + err.message });
  }
}

