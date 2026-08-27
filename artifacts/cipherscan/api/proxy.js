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

const https = require("https");
const http  = require("http");
const { URL } = require("url");

// Headers that must not be forwarded between hops
const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate",
  "proxy-authorization", "te", "trailers",
  "transfer-encoding", "upgrade", "host",
]);

function proxyRequest(options, body) {
  return new Promise((resolve, reject) => {
    const lib = options.protocol === "https:" ? https : http;
    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(new Error("Upstream timeout")); });
    if (body) req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  const backendUrl = process.env.BACKEND_URL;
  const apiKey     = process.env.APP_API_KEY;

  if (!backendUrl) {
    res.status(500).json({ error: "BACKEND_URL is not configured." });
    return;
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(backendUrl.replace(/\/$/, "") + (req.url || "/"));
  } catch (e) {
    res.status(500).json({ error: "Invalid BACKEND_URL: " + e.message });
    return;
  }

  // Build forwarded headers
  const forwardHeaders = {};
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (!HOP_BY_HOP.has(k.toLowerCase()) && typeof v === "string") {
      forwardHeaders[k] = v;
    }
  }
  if (apiKey) forwardHeaders["x-api-key"] = apiKey;

  // Serialise body for POST / PUT / PATCH
  let body;
  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    body = JSON.stringify(req.body);
    forwardHeaders["content-type"]   = forwardHeaders["content-type"] || "application/json";
    forwardHeaders["content-length"] = Buffer.byteLength(body).toString();
  }

  const options = {
    protocol: upstreamUrl.protocol,
    hostname: upstreamUrl.hostname,
    port:     upstreamUrl.port || (upstreamUrl.protocol === "https:" ? 443 : 80),
    path:     upstreamUrl.pathname + upstreamUrl.search,
    method:   req.method || "GET",
    headers:  forwardHeaders,
  };

  let upstream;
  try {
    upstream = await proxyRequest(options, body);
  } catch (err) {
    res.status(502).json({ error: "Proxy upstream error: " + err.message });
    return;
  }

  // Forward safe response headers
  for (const [k, v] of Object.entries(upstream.headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) {
      try { res.setHeader(k, v); } catch (_) {}
    }
  }

  res.status(upstream.status).send(upstream.body);
};
