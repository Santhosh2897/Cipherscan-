import { z } from "zod/v4";

/**
 * Shared verdict enum — matches the `verdict` column in @workspace/db's
 * scansTable and the values reputationService.ts actually returns.
 */
export const Verdict = z.enum(["safe", "suspicious", "malicious"]);
export type Verdict = z.infer<typeof Verdict>;

export const TriggerType = z.enum(["camera", "link", "manual"]);
export type TriggerType = z.infer<typeof TriggerType>;

/**
 * GET /api/healthz
 */
export const HealthCheckResponse = z.object({
  status: z.literal("ok"),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponse>;

/**
 * POST /api/analyze — request body
 * (routes/analyze.ts destructures { targetUrl, triggerType } from this)
 */
export const AnalyzeUrlBody = z.object({
  targetUrl: z.string().min(1, "targetUrl is required"),
  triggerType: TriggerType,
});
export type AnalyzeUrlBody = z.infer<typeof AnalyzeUrlBody>;

/**
 * GET /api/scans/:id — route params
 * (routes/scans.ts calls GetScanParams.safeParse({ id: parseInt(...) }))
 */
export const GetScanParams = z.object({
  id: z.number().int().positive(),
});
export type GetScanParams = z.infer<typeof GetScanParams>;

/**
 * GET /api/scans — query params
 * (routes/scans.ts destructures { limit = 50, offset = 0, verdict })
 * Query params arrive as strings, so numeric fields use coerce.
 */
export const ListScansQueryParams = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  verdict: Verdict.optional(),
});
export type ListScansQueryParams = z.infer<typeof ListScansQueryParams>;

/**
 * Full scan record shape — mirrors formatScan() in routes/scans.ts and the
 * response shape from routes/analyze.ts. Exported so other packages (e.g.
 * api-client-react) can share one source of truth for the response type.
 */
export const ScanResult = z.object({
  id: z.number(),
  originalUrl: z.string(),
  finalUrl: z.string(),
  isSafe: z.boolean(),
  riskScore: z.number(),
  verdict: Verdict,
  threatCategory: z.string().nullable(),
  redirectChain: z.array(z.string()),
  reasons: z.array(z.string()),
  previewImageUrl: z.string().nullable(),
  triggerType: TriggerType,
  virusTotalScore: z.number().nullable(),
  googleSafeBrowsing: z.boolean(),
  createdAt: z.string(),
});
export type ScanResult = z.infer<typeof ScanResult>;
