import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  // Only health checks are public — everything else (including /analyze) requires a key
  if (req.path === "/healthz") {
    return next();
  }

  const configuredKey = process.env.APP_API_KEY;
  if (!configuredKey || configuredKey.trim() === "") {
    if (process.env.NODE_ENV === "production") {
      return res.status(500).json({
        error: "Server Configuration Error",
        message: "API authentication is improperly configured on the server."
      });
    }
    return next();
  }

  const rawHeader = req.header("x-api-key") || req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const providedKey = rawHeader ? rawHeader.trim() : "";

  // Constant-time comparison using fixed-length SHA-256 digests
  const configuredDigest = crypto.createHash("sha256").update(configuredKey).digest();
  const providedDigest = crypto.createHash("sha256").update(providedKey).digest();

  if (!providedKey || !crypto.timingSafeEqual(configuredDigest, providedDigest)) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "A valid API key is required to access this resource."
    });
  }

  next();
}