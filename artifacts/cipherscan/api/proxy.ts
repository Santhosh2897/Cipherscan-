/**
 * CipherScan — Vercel BFF Proxy
 * file: artifacts/cipherscan/api/proxy.ts
 *
 * This Serverless Function proxies ALL /api/* requests from the browser to
 * the Render backend, injecting `x-api-key` server-side so the key is never
 * exposed in the public JS bundle or visible in browser DevTools.
 *
 * Required Vercel environment variables (server-side, not VITE_ prefixed):
 *   BACKEND_URL   — Render service root URL (e.g. https://cipherscan-api.onrender.com)
 *   APP_API_KEY   — The shared secret (same value as APP_API_KEY on the backend)
 *
 * Routing (vercel.json): { "source": "/api/:path*", "destination": "/api/proxy" }
 * The original sub-path is forwarded via the request URL path.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

// Headers that must not be forwarded between hops (RFC 2616 §13.5.1).
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const backendUrl = process.env["BACKEND_URL"];
  const apiKey = process.env["APP_API_KEY"];

  if (!backendUrl) {
    res.status(500).json({ error: "BACKEND_URL environment variable is not configured." });
    return;
  }

  // req.url is the full path Vercel received, e.g. /api/stats/timeline?limit=10
  const upstreamUrl = `${backendUrl.replace(/\/$/, "")}${req.url ?? "/"}`;

  // Build forwarded headers — strip hop-by-hop, inject x-api-key.
  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && typeof value === "string") {
      forwardHeaders[key] = value;
    }
  }

  // Inject the API key server-side — this is the core security improvement.
  if (apiKey) {
    forwardHeaders["x-api-key"] = apiKey;
  }

  // Forward the request body for POST/PUT/PATCH.
  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = JSON.stringify(req.body);
    if (!forwardHeaders["content-type"]) {
      forwardHeaders["content-type"] = "application/json";
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: req.method ?? "GET",
      headers: forwardHeaders,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Proxy upstream error: ${message}` });
    return;
  }

  // Copy upstream response headers to the Vercel response.
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  res.status(upstream.status);
  const responseText = await upstream.text();
  res.send(responseText);
}
