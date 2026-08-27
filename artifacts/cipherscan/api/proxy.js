/**
 * CipherScan — Vercel BFF Proxy  (api/proxy.js)
 *
 * Forwards all /api/* browser requests to the Render backend,
 * injecting x-api-key server-side so the key never appears in the
 * public JS bundle or browser DevTools.
 *
 * Required Vercel env vars (server-side only, no VITE_ prefix):
 *   BACKEND_URL  — e.g. https://cipherscan-ecjs.onrender.com
 *   APP_API_KEY  — same value as APP_API_KEY on the Render backend
 */

// Headers that must not be forwarded between hops (RFC 2616 §13.5.1)
const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate",
  "proxy-authorization", "te", "trailers",
  "transfer-encoding", "upgrade", "host",
]);

/** @param {import('@vercel/node').VercelRequest} req @param {import('@vercel/node').VercelResponse} res */
module.exports = async function handler(req, res) {
  const backendUrl = process.env.BACKEND_URL;
  const apiKey     = process.env.APP_API_KEY;

  if (!backendUrl) {
    return res.status(500).json({ error: "BACKEND_URL is not configured." });
  }

  // req.url is the full path Vercel received, e.g. /api/stats?limit=10
  const upstream = `${backendUrl.replace(/\/$/, "")}${req.url || "/"}`;

  // Build forwarded headers — strip hop-by-hop, inject x-api-key
  const forwardHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase()) && typeof v === "string") {
      forwardHeaders[k] = v;
    }
  }
  if (apiKey) forwardHeaders["x-api-key"] = apiKey;

  // Serialise body for POST / PUT / PATCH
  let body;
  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    body = JSON.stringify(req.body);
    if (!forwardHeaders["content-type"]) {
      forwardHeaders["content-type"] = "application/json";
    }
  }

  let upstreamRes;
  try {
    upstreamRes = await fetch(upstream, {
      method: req.method || "GET",
      headers: forwardHeaders,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    return res.status(502).json({ error: `Proxy upstream error: ${err.message}` });
  }

  // Forward response headers
  upstreamRes.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) res.setHeader(key, value);
  });

  res.status(upstreamRes.status);
  const text = await upstreamRes.text();
  res.send(text);
};
