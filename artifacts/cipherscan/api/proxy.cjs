/**
 * CipherScan — Vercel BFF Proxy  (api/proxy.cjs)
 *
 * .cjs extension is required because artifacts/cipherscan/package.json
 * has "type":"module" — without .cjs, Node.js treats .js files as ESM
 * and module.exports causes a crash (FUNCTION_INVOCATION_FAILED).
 *
 * Forwards all /api/* requests to Render, injecting x-api-key server-side.
 *
 * Required Vercel env vars (server-side only, no VITE_ prefix):
 *   BACKEND_URL  — e.g. https://cipherscan-ecjs.onrender.com
 *   APP_API_KEY  — same value as APP_API_KEY on the Render backend
 */

"use strict";
const https = require("https");
const http  = require("http");
const { URL } = require("url");

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
      res.on("end", () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString(),
      }));
    });
    req.on("error", reject);
    req.setTimeout(28000, () => req.destroy(new Error("Upstream timeout")));
    if (body) req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  const backendUrl = process.env.BACKEND_URL;
  const apiKey     = process.env.APP_API_KEY;

  if (!backendUrl) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "BACKEND_URL is not configured." }));
    return;
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(backendUrl.replace(/\/$/, "") + (req.url || "/"));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Invalid BACKEND_URL: " + e.message }));
    return;
  }

  // Build forwarded headers, strip hop-by-hop, inject API key
  const forwardHeaders = {};
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (!HOP_BY_HOP.has(k.toLowerCase()) && typeof v === "string") {
      forwardHeaders[k] = v;
    }
  }
  if (apiKey) forwardHeaders["x-api-key"] = apiKey;

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
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Proxy upstream error: " + err.message }));
    return;
  }

  // Forward safe response headers
  for (const [k, v] of Object.entries(upstream.headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) {
      try { res.setHeader(k, v); } catch (_) {}
    }
  }
  res.statusCode = upstream.status;
  res.end(upstream.body);
};
