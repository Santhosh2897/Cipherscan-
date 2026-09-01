import { Router } from "express";
import { db, scansTable } from "@workspace/db";
import { and, eq, gte, desc } from "drizzle-orm";
import { AnalyzeUrlBody } from "@workspace/api-zod";
import { analyzeSandbox } from "../lib/sandboxService";
import { analyzeReputation } from "../lib/reputationService";
import { assertUrlIsSafe, UnsafeUrlError } from "../lib/urlSafety";
import { logger } from "../lib/logger";

const router = Router();

function safeParseJsonArray(input: string | null | undefined): string[] {
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

router.post("/analyze", async (req, res): Promise<void> => {
  try {
    const parsed = AnalyzeUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { targetUrl, triggerType } = parsed.data;
    const rawBody = req.body as { deviceId?: string; deviceName?: string };
    const deviceId = typeof rawBody?.deviceId === 'string' && rawBody.deviceId.trim() !== '' ? rawBody.deviceId.trim() : null;
    const deviceName = typeof rawBody?.deviceName === 'string' && rawBody.deviceName.trim() !== '' ? rawBody.deviceName.trim() : null;

    // SSRF guard: reject URLs pointing at localhost, private IP ranges, or cloud metadata
    try {
      await assertUrlIsSafe(targetUrl);
    } catch (err) {
      if (err instanceof UnsafeUrlError) {
        res.status(400).json({ error: "URL not allowed" });
        return;
      }
      res.status(400).json({ error: "Invalid or malformed target URL" });
      return;
    }

    // Check if link was recently scanned (cached within 24 hours) with DB error safety
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existingScans = await db
        .select()
        .from(scansTable)
        .where(and(eq(scansTable.originalUrl, targetUrl), gte(scansTable.createdAt, twentyFourHoursAgo)))
        .orderBy(desc(scansTable.createdAt))
        .limit(1);

      if (existingScans.length > 0) {
        const cached = existingScans[0];
        res.json({
          id: cached.id,
          originalUrl: cached.originalUrl,
          finalUrl: cached.finalUrl,
          isSafe: cached.isSafe,
          riskScore: cached.riskScore,
          verdict: cached.verdict,
          threatCategory: cached.threatCategory,
          redirectChain: safeParseJsonArray(cached.redirectChain),
          reasons: safeParseJsonArray(cached.reasons),
          previewImageUrl: cached.previewImageUrl,
          triggerType: cached.triggerType,
          deviceId: cached.deviceId,
          deviceName: cached.deviceName,
          virusTotalScore: cached.virusTotalScore,
          googleSafeBrowsing: cached.googleSafeBrowsing,
          createdAt: cached.createdAt ? cached.createdAt.toISOString() : new Date().toISOString(),
        });
        return;
      }
    } catch (cacheErr: any) {
      logger.warn({ error: cacheErr.message }, "Database scan cache lookup failed, continuing with fresh scan");
    }

    // Determine server base URL for preview image URLs
    const serverBaseUrl = process.env["SERVER_BASE_URL"] ??
      `${req.protocol}://${req.get("host")}`;

    // Run sandbox analysis and reputation checks concurrently
    const [sandboxSettled] = await Promise.allSettled([
      analyzeSandbox(targetUrl, serverBaseUrl),
    ]);

    const sandbox = sandboxSettled.status === "fulfilled"
      ? sandboxSettled.value
      : { finalUrl: targetUrl, redirectChain: [targetUrl], previewImageUrl: null };

    // Now run reputation with resolved finalUrl
    const reputation = await analyzeReputation(targetUrl, sandbox.finalUrl, sandbox.redirectChain).catch(() => ({
      riskScore: 0,
      verdict: "safe" as const,
      threatCategory: null,
      reasons: ["Analysis service temporarily unavailable"],
      virusTotalScore: null,
      googleSafeBrowsing: false,
    }));

    // Try to persist scan to DB with graceful fallback if DB fails
    let scanId = Date.now();
    let createdAtIso = new Date().toISOString();

    try {
      const insertedRows = await db
        .insert(scansTable)
        .values({
          originalUrl: targetUrl,
          finalUrl: sandbox.finalUrl,
          isSafe: reputation.verdict === "safe",
          riskScore: reputation.riskScore,
          verdict: reputation.verdict,
          threatCategory: reputation.threatCategory,
          redirectChain: JSON.stringify(sandbox.redirectChain),
          reasons: JSON.stringify(reputation.reasons),
          previewImageUrl: sandbox.previewImageUrl,
          triggerType: triggerType,
          deviceId: deviceId,
          deviceName: deviceName,
          virusTotalScore: reputation.virusTotalScore,
          googleSafeBrowsing: reputation.googleSafeBrowsing,
        })
        .returning();

      if (insertedRows.length > 0) {
        scanId = insertedRows[0].id;
        createdAtIso = insertedRows[0].createdAt ? insertedRows[0].createdAt.toISOString() : createdAtIso;
      }
    } catch (dbInsertErr: any) {
      logger.error({ error: dbInsertErr.message }, "Failed to persist scan record to database");
    }

    res.json({
      id: scanId,
      originalUrl: targetUrl,
      finalUrl: sandbox.finalUrl,
      isSafe: reputation.verdict === "safe",
      riskScore: reputation.riskScore,
      verdict: reputation.verdict,
      threatCategory: reputation.threatCategory,
      redirectChain: sandbox.redirectChain,
      reasons: reputation.reasons,
      previewImageUrl: sandbox.previewImageUrl,
      triggerType: triggerType,
      deviceId: deviceId,
      deviceName: deviceName,
      virusTotalScore: reputation.virusTotalScore,
      googleSafeBrowsing: reputation.googleSafeBrowsing,
      createdAt: createdAtIso,
    });
  } catch (globalErr: any) {
    logger.error({ error: globalErr.message }, "Unexpected error in POST /api/analyze");
    res.status(500).json({
      error: "Internal Server Error",
      message: globalErr.message || "Failed to analyze URL",
    });
  }
});

export default router;
