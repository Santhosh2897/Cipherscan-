/**
 * CipherScan — Vercel BFF Proxy (api/proxy.js)
 *
 * Forwards all /api/* requests to the Render backend, injecting x-api-key
 * server-side so the key is never exposed to the client browser.
 */

export default async function handler(req, res) {
  const backendUrl = process.env.BACKEND_URL;
  const apiKey = process.env.APP_API_KEY;

  if (!backendUrl) {
    return res.status(500).json({ error: "BACKEND_URL is not configured." });
  }

  const upstream = `${backendUrl.replace(/\/$/, "")}${req.url || "/"}`;

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

