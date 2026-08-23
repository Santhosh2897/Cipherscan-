import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

/**
 * Requires a shared secret API key on every request. This closes two gaps:
 *  - /api/analyze being callable by anyone (not just the Android app),
 *    which combined with the sandbox is an open invitation to abuse.
 *  - /api/scans leaking every user's browsing/UPI history to anyone who
 *    calls it, since it previously had no access control at all.
 *
 * Generate a key with: openssl rand -hex 32
 * Set it as APP_API_KEY in the backend's .env, and send it as the
 * x-api-key header from the Android app / web dashboard.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const expectedKey = process.env["APP_API_KEY"];

  if (!expectedKey) {
    logger.error("APP_API_KEY is not set — refusing all requests until configured");
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const providedKey = req.header("x-api-key");

  if (!providedKey || providedKey !== expectedKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
