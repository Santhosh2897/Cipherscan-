import { Request, Response, NextFunction } from "express";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  // Allow health checks and public URL analysis without an API key
  if (req.path === "/healthz" || req.path === "/analyze") {
    return next();
  }

  const configuredKey = process.env.APP_API_KEY;
  if (!configuredKey) {
    return next();
  }

  const providedKey = req.header("x-api-key") || req.header("authorization")?.replace("Bearer ", "");

  if (!providedKey || providedKey !== configuredKey) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "A valid API key is required to access this resource."
    });
  }

  next();
}