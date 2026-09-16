/**
 * CipherScan — Server-Side Dashboard Auth (api/auth.js)
 *
 * Supports two roles:
 *  1. Admin Mode:
 *     POST /api/auth  { pin: "123456" }  → { ok: true, role: "admin", token: "admin.<slot>.<hmac>" }
 *     Grants full access to Fleet Overview, all registered devices, and global controls.
 *
 *  2. Device Mode:
 *     POST /api/auth  { deviceId: "uuid" }  → { ok: true, role: "device", deviceId: "...", token: "device.<id>.<slot>.<hmac>" }
 *     Grants scoped access strictly restricted to the specified device.
 *
 * Stateless HMAC token validity: 1 hour (rotates at the top of each clock hour).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_PIN_ATTEMPTS_PER_WINDOW = 10; // brute-force guard for PIN
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

function getSecret(pin) {
  return pin && pin.trim() !== "" ? pin.trim() : "cipherscan-dev-secret-key-fallback";
}

/**
 * Generates an Admin HMAC token valid for the current hour slot.
 */
export function generateAdminToken(pin, hourSlot = Math.floor(Date.now() / 3_600_000)) {
  const secret = getSecret(pin);
  const sig = createHmac("sha256", secret)
    .update(`admin:${hourSlot}`)
    .digest("hex");
  return `admin.${hourSlot}.${sig}`;
}

/**
 * Generates a Device-Scoped HMAC token bound to a specific deviceId.
 */
export function generateDeviceToken(pin, deviceId, hourSlot = Math.floor(Date.now() / 3_600_000)) {
  const secret = getSecret(pin);
  const cleanId = String(deviceId).trim();
  const sig = createHmac("sha256", secret)
    .update(`device:${cleanId}:${hourSlot}`)
    .digest("hex");
  return `device.${encodeURIComponent(cleanId)}.${hourSlot}.${sig}`;
}

/**
 * Verifies a token. Checks current hour AND previous hour (handles clock edge).
 * Returns: { valid: boolean, role?: "admin" | "device", deviceId?: string }
 */
export function verifyToken(pin, token) {
  if (!token || typeof token !== "string") return { valid: false };

  const secret = getSecret(pin);
  const currentSlot = Math.floor(Date.now() / 3_600_000);
  const validSlots = [currentSlot, currentSlot - 1];

  // 1. Admin Token Format: admin.<slot>.<sig>
  if (token.startsWith("admin.")) {
    const parts = token.split(".");
    if (parts.length === 3) {
      const [, slotStr, providedSig] = parts;
      const slotNum = parseInt(slotStr, 10);
      if (validSlots.includes(slotNum)) {
        const expectedSig = createHmac("sha256", secret)
          .update(`admin:${slotNum}`)
          .digest("hex");
        try {
          if (timingSafeEqual(Buffer.from(providedSig, "hex"), Buffer.from(expectedSig, "hex"))) {
            return { valid: true, role: "admin" };
          }
        } catch {
          // length mismatch
        }
      }
    }
  }

  // 2. Device Token Format: device.<encDeviceId>.<slot>.<sig>
  if (token.startsWith("device.")) {
    const parts = token.split(".");
    if (parts.length === 4) {
      const [, encDeviceId, slotStr, providedSig] = parts;
      const slotNum = parseInt(slotStr, 10);
      const deviceId = decodeURIComponent(encDeviceId);
      if (validSlots.includes(slotNum) && deviceId) {
        const expectedSig = createHmac("sha256", secret)
          .update(`device:${deviceId}:${slotNum}`)
          .digest("hex");
        try {
          if (timingSafeEqual(Buffer.from(providedSig, "hex"), Buffer.from(expectedSig, "hex"))) {
            return { valid: true, role: "device", deviceId };
          }
        } catch {
          // length mismatch
        }
      }
    }
  }

  // 3. Backward Compatibility: Legacy Token Format
  for (const slot of validSlots) {
    const legacyExpected = createHmac("sha256", secret)
      .update(`cipherscan:${slot}`)
      .digest("hex");
    try {
      if (timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(legacyExpected, "hex"))) {
        return { valid: true, role: "admin" };
      }
    } catch {
      // length mismatch
    }
  }

  return { valid: false };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const configuredPin = process.env.DASHBOARD_PIN;

  const clientIp =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  const { pin, deviceId } = req.body || {};

  // Case 1: Device View Authentication (Requires valid deviceId)
  if (deviceId && typeof deviceId === "string" && deviceId.trim() !== "") {
    const cleanDeviceId = deviceId.trim();
    if (cleanDeviceId.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid Device ID format." });
    }

    const token = generateDeviceToken(configuredPin, cleanDeviceId);
    return res.status(200).json({
      ok: true,
      role: "device",
      deviceId: cleanDeviceId,
      token,
    });
  }

  // Case 2: Admin Authentication (Requires matching PIN)
  if (pin && typeof pin === "string") {
    // If no PIN is configured on server → dev mode admin passes freely
    if (!configuredPin || configuredPin.trim() === "") {
      const token = generateAdminToken("");
      return res.status(200).json({ ok: true, role: "admin", token, devMode: true });
    }

    // Brute-force protection on PIN attempts
    if (!checkAttemptLimit(clientIp)) {
      return res.status(429).json({
        ok: false,
        error: "Too many attempts. Please wait a minute before trying again.",
      });
    }

    // Constant-time PIN comparison
    const configuredBuf = Buffer.from(configuredPin.trim());
    const providedBuf = Buffer.from(pin.trim());
    const lengthMatch = configuredBuf.length === providedBuf.length;
    const padLen = Math.max(configuredBuf.length, providedBuf.length);
    const a = Buffer.concat([configuredBuf], padLen);
    const b = Buffer.concat([providedBuf], padLen);
    const pinMatch = lengthMatch && timingSafeEqual(a, b);

    if (!pinMatch) {
      return res.status(401).json({ ok: false, error: "Incorrect Admin PIN." });
    }

    const token = generateAdminToken(configuredPin.trim());
    return res.status(200).json({ ok: true, role: "admin", token });
  }

  // If no PIN configured and no body sent, allow devMode bypass
  if (!configuredPin || configuredPin.trim() === "") {
    const token = generateAdminToken("");
    return res.status(200).json({ ok: true, role: "admin", token, devMode: true });
  }

  return res.status(400).json({
    ok: false,
    error: "Either Admin PIN or Device ID is required to authenticate.",
  });
}
