/**
 * CipherScan — API Server lib index
 *
 * Shared services and utilities for the Express backend.
 *
 * Files in this directory:
 *
 *   logger.ts           — Singleton pino logger. Use `logger` for app-level logs
 *                         and `req.log` inside route handlers (child logger with
 *                         request ID attached by pino-http middleware in app.ts).
 *
 *   reputationService.ts — Parallel threat reputation analysis.
 *                          Calls VirusTotal v3 + Google Safe Browsing v4 concurrently,
 *                          then combines with heuristic analysis (URL shorteners,
 *                          redirect depth, TLD checks, UPI VPA validation).
 *                          Returns: riskScore (0–100), verdict, threatCategory, reasons.
 *                          Env vars: VIRUSTOTAL_API_KEY, GOOGLE_SAFE_BROWSING_API_KEY
 *                          (gracefully degrades to heuristics-only if keys absent).
 *
 *   sandboxService.ts   — Playwright headless Chromium sandbox.
 *                          Navigates to the target URL, follows all JS + HTTP redirects,
 *                          captures the final destination URL and a 1280×720 JPEG
 *                          screenshot saved to /public/previews/{hash}.jpg.
 *                          Returns: finalUrl, redirectChain, previewImageUrl.
 *                          Gracefully degrades if playwright is not installed.
 */

export { logger } from "./logger";
export { analyzeSandbox } from "./sandboxService";
export type { SandboxResult } from "./sandboxService";
export { analyzeReputation } from "./reputationService";
export type { ReputationResult } from "./reputationService";
