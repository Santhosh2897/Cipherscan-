/**
 * CipherScan — Server-Side Dashboard Auth (api/auth.js)
 *
 * POST /api/auth         { pin: "123456" }  → { ok: true,  token: "..." }
 *                                           → { ok: false, error: "..." }
 *
 * The PIN never leaves the server. The browser only ever sees a short-lived
 * HMAC token derived from the PIN + an hourly time window. The token is
 * stateless — no DB or shared memory needed across serverless invocations.
 *
 * Token validity: 1 hour (rotates at the top of each clock hour).
 * The browser stores the token in sessionStorage, which is wiped on tab close.
 *
 * Server env vars required:
 *   DASHBOARD_PIN   — the secret PIN (no VITE_ prefix — never sent to browser)
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_PIN_ATTEMPTS_PER_WINDOW = 10; // brute-force guard
const WINDOW_MS = 60_000;

// In-memory attempt tracker (per Vercel instance — good enough as a deterrent)
const attemptStore = new Map();

function checkAttemptLimit(ip) {
  const now = Date.now();
  const entry = attemptStore.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attemptStore.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MAX_PIN_ATTEMPTS_PER_WINDOW) return false;
  entry.count++;
  return true;
}

/**
 * Generates a stateless HMAC token valid for the current 1-hour window.
 * token = HMAC-SHA256(key=DASHBOARD_PIN, data="cipherscan:<hourSlot>")
 */
function generateToken(pin) {
  const hourSlot = Math.floor(Date.now() / 3_600_000); // changes every hour
  return createHmac("sha256", pin)
    .update(`cipherscan:${hourSlot}`)
    .digest("hex");
}

/**
 * Verifies a token. Checks current hour AND previous hour (handles clock edge).
 */
export function verifyToken(pin, token) {
  if (!pin || !token) return false;
  const hourSlot = Math.floor(Date.now() / 3_600_000);
  for (const slot of [hourSlot, hourSlot - 1]) {
    const expected = createHmac("sha256", pin)
      .update(`cipherscan:${slot}`)
      .digest("hex");
    try {
      if (timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"))) {
        return true;
      }
    } catch {
      // Buffer length mismatch = invalid token format
    }
  }
  return false;
}

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const configuredPin = process.env.DASHBOARD_PIN;

  // If no PIN is configured → dashboard is open (dev mode)
  if (!configuredPin || configuredPin.trim() === "") {
    return res.status(200).json({ ok: true, token: "dev-mode-open", devMode: true });
  }

  // Brute-force protection
  const clientIp =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (!checkAttemptLimit(clientIp)) {
    return res.status(429).json({
      ok: false,
      error: "Too many attempts. Please wait a minute before trying again.",
    });
  }

  const { pin } = req.body || {};

  if (!pin || typeof pin !== "string") {
    return res.status(400).json({ ok: false, error: "PIN is required." });
  }

  // Constant-time comparison to prevent timing attacks
  const configuredBuf = Buffer.from(configuredPin.trim());
  const providedBuf = Buffer.from(pin.trim());

  const lengthMatch = configuredBuf.length === providedBuf.length;
  // Always run timingSafeEqual (pad to same length if needed to avoid length leak)
  const padLen = Math.max(configuredBuf.length, providedBuf.length);
  const a = Buffer.concat([configuredBuf], padLen);
  const b = Buffer.concat([providedBuf], padLen);
  const pinMatch = lengthMatch && timingSafeEqual(a, b);

  if (!pinMatch) {
    return res.status(401).json({ ok: false, error: "Incorrect PIN." });
  }

  // PIN correct → issue a 1-hour HMAC token
  const token = generateToken(configuredPin.trim());
  return res.status(200).json({ ok: true, token });
}
