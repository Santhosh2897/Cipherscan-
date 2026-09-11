import { Router } from "express";
import { db, scansTable } from "@workspace/db";
import { AnalyzeUrlBody } from "@workspace/api-zod";
import { analyzeSandbox, createFallbackPreviewDataUri, fetchCloudScreenshot } from "../lib/sandboxService.js";
import { analyzeReputation } from "../lib/reputationService.js";
import { assertUrlIsSafe, UnsafeUrlError } from "../lib/urlSafety.js";
import { logger } from "../lib/logger.js";
import {
  getCachedScan,
  upsertUrlCache,
  updateCachePreviewImage,
  incrementCacheScanCount,
  upsertDomainPattern,
  getDomainPatternForDevice,
  isTrustedDomainForDevice,
  isUpiUrl,
} from "../lib/urlIntelligence.js";

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

function normalizeUrlInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

router.post("/analyze", async (req, res): Promise<void> => {
  try {
    const parsed = AnalyzeUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { targetUrl: rawTargetUrl, triggerType: rawTrigger, deviceId: rawDevId, deviceName: rawDevName } = parsed.data;
    const targetUrl = normalizeUrlInput(rawTargetUrl);
    const triggerType = rawTrigger || "manual";
    const deviceId = rawDevId && rawDevId.trim() !== "" ? rawDevId.trim() : null;
    const deviceName = rawDevName && rawDevName.trim() !== "" ? rawDevName.trim() : null;

    // Bypass cache flag: ?fresh=true or X-Force-Fresh: true header
    const forceFresh =
      req.query["fresh"] === "true" ||
      req.headers["x-force-fresh"] === "true";

    // SSRF guard: reject URLs pointing at localhost, private IP ranges, or cloud metadata
    try {
      await assertUrlIsSafe(targetUrl);
    } catch (err) {
      if (err instanceof UnsafeUrlError) {
        res.status(400).json({ error: err.message || "URL not allowed" });
        return;
      }
      res.status(400).json({ error: "Invalid or malformed target URL" });
      return;
    }

    // ── STEP 1: Check per-device trusted domain (instant whitelist) ──────────
    const domainTrusted = !forceFresh && await isTrustedDomainForDevice(targetUrl, deviceId);
    if (domainTrusted) {
      logger.info({ targetUrl, deviceId }, "Trusted domain whitelist HIT — instant SAFE");
      const domainPattern = await getDomainPatternForDevice(targetUrl, deviceId);

      const cached = await getCachedScan(targetUrl).catch(() => null);
      let previewImageUrl = cached?.previewImageUrl;
      if (!previewImageUrl || previewImageUrl.includes("data:image/svg+xml")) {
        previewImageUrl = isUpiUrl(targetUrl)
          ? createFallbackPreviewDataUri(targetUrl)
          : await fetchCloudScreenshot(targetUrl).catch(() => null);
      }

      // Still record the personal scan in the scans table
      const insertedRows = await db
        .insert(scansTable)
        .values({
          originalUrl: targetUrl,
          finalUrl: targetUrl,
          isSafe: true,
          riskScore: 0,
          verdict: "safe",
          threatCategory: null,
          redirectChain: JSON.stringify([targetUrl]),
          reasons: JSON.stringify(["Trusted domain — you have visited this site safely many times"]),
          previewImageUrl,
          triggerType,
          deviceId,
          deviceName,
          virusTotalScore: null,
          googleSafeBrowsing: false,
        })
        .returning()
        .catch(() => []);

      const scanId = insertedRows[0]?.id ?? Date.now();
      const createdAt = insertedRows[0]?.createdAt?.toISOString() ?? new Date().toISOString();
      await upsertDomainPattern(targetUrl, deviceId, "safe");

      res.json({
        id: scanId,
        originalUrl: targetUrl,
        finalUrl: targetUrl,
        isSafe: true,
        riskScore: 0,
        verdict: "safe",
        threatCategory: null,
        redirectChain: [targetUrl],
        reasons: ["Trusted domain — you have visited this site safely many times"],
        previewImageUrl,
        triggerType,
        deviceId,
        deviceName,
        virusTotalScore: null,
        googleSafeBrowsing: false,
        createdAt,
        fromCache: false,
        fromTrustedDomain: true,
        domainScanCount: domainPattern?.scanCount ?? 1,
        communityTrustScore: null,
      });
      return;
    }

    // ── STEP 2: Check cross-user URL cache ────────────────────────────────────
    const cached = !forceFresh && !isUpiUrl(targetUrl)
      ? await getCachedScan(targetUrl)
      : null;

    if (cached) {
      logger.info({ targetUrl }, "url_cache HIT — returning fast result");
      incrementCacheScanCount(targetUrl).catch(() => {});

      // If cached image is missing or is an old dummy SVG placeholder, upgrade to live cloud screenshot
      if (!isUpiUrl(targetUrl) && (!cached.previewImageUrl || cached.previewImageUrl.includes("data:image/svg+xml"))) {
        const freshImage = await fetchCloudScreenshot(targetUrl).catch(() => null);
        if (freshImage) {
          cached.previewImageUrl = freshImage;
          updateCachePreviewImage(targetUrl, freshImage).catch(() => {});
        }
      }

      const domainPattern = await getDomainPatternForDevice(targetUrl, deviceId);
      upsertDomainPattern(targetUrl, deviceId, cached.verdict).catch(() => {});

      // Create personal scan record
      const insertedRows = await db
        .insert(scansTable)
        .values({
          originalUrl: cached.originalUrl,
          finalUrl: cached.finalUrl,
          isSafe: cached.verdict === "safe",
          riskScore: cached.riskScore,
          verdict: cached.verdict,
          threatCategory: cached.threatCategory,
          redirectChain: cached.redirectChain,
          reasons: cached.reasons,
          previewImageUrl: cached.previewImageUrl,
          triggerType,
          deviceId,
          deviceName,
          virusTotalScore: cached.virusTotalScore,
          googleSafeBrowsing: false,
        })
        .returning()
        .catch(() => []);

      const scanId = insertedRows[0]?.id ?? Date.now();
      const createdAt = insertedRows[0]?.createdAt?.toISOString() ?? new Date().toISOString();

      res.json({
        id: scanId,
        originalUrl: cached.originalUrl,
        finalUrl: cached.finalUrl,
        isSafe: cached.verdict === "safe",
        riskScore: cached.riskScore,
        verdict: cached.verdict,
        threatCategory: cached.threatCategory,
        redirectChain: safeParseJsonArray(cached.redirectChain),
        reasons: safeParseJsonArray(cached.reasons),
        previewImageUrl: cached.previewImageUrl,
        triggerType,
        deviceId,
        deviceName,
        virusTotalScore: cached.virusTotalScore,
        googleSafeBrowsing: false,
        createdAt,
        fromCache: true,
        fromTrustedDomain: false,
        domainScanCount: domainPattern?.scanCount ?? null,
        communityTrustScore: null,
        cacheHitCount: cached.scanCount,
      });
      return;
    }

    // ── STEP 3: Full scan (cache miss) ────────────────────────────────────────
    logger.info({ targetUrl }, "url_cache MISS — running full scan");

    const serverBaseUrl =
      process.env["SERVER_BASE_URL"] ?? `${req.protocol}://${req.get("host")}`;

    const [sandboxSettled] = await Promise.allSettled([
      analyzeSandbox(targetUrl, serverBaseUrl),
    ]);

    const sandbox =
      sandboxSettled.status === "fulfilled"
        ? sandboxSettled.value
        : { finalUrl: targetUrl, redirectChain: [targetUrl], previewImageUrl: null };

    let previewImageUrl = sandbox.previewImageUrl;
    if ((!previewImageUrl || previewImageUrl.includes("data:image/svg+xml")) && !isUpiUrl(targetUrl)) {
      previewImageUrl = await fetchCloudScreenshot(targetUrl).catch(() => null);
    }

    const reputation = await analyzeReputation(
      targetUrl,
      sandbox.finalUrl,
      sandbox.redirectChain,
    ).catch(() => ({
      riskScore: 0,
      verdict: "safe" as const,
      threatCategory: null,
      reasons: ["Analysis service temporarily unavailable"],
      virusTotalScore: null,
      googleSafeBrowsing: false,
    }));

    // Write to url_cache and domain patterns (non-blocking, background)
    upsertUrlCache({
      originalUrl: targetUrl,
      finalUrl: sandbox.finalUrl,
      verdict: reputation.verdict,
      riskScore: reputation.riskScore,
      threatCategory: reputation.threatCategory,
      redirectChain: JSON.stringify(sandbox.redirectChain),
      reasons: JSON.stringify(reputation.reasons),
      previewImageUrl,
      virusTotalScore: reputation.virusTotalScore,
    }).catch(() => {});

    upsertDomainPattern(targetUrl, deviceId, reputation.verdict).catch(() => {});

    // Persist personal scan record
    let scanId: number = Date.now();
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
          previewImageUrl,
          triggerType,
          deviceId,
          deviceName,
          virusTotalScore: reputation.virusTotalScore,
          googleSafeBrowsing: reputation.googleSafeBrowsing,
        })
        .returning();

      if (insertedRows.length > 0) {
        scanId = insertedRows[0].id;
        createdAtIso = insertedRows[0].createdAt
          ? insertedRows[0].createdAt.toISOString()
          : createdAtIso;
      }
    } catch (dbInsertErr: any) {
      logger.error({ error: dbInsertErr.message }, "Failed to persist scan record to database");
    }

    const domainPattern = await getDomainPatternForDevice(targetUrl, deviceId);

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
      previewImageUrl,
      triggerType,
      deviceId,
      deviceName,
      virusTotalScore: reputation.virusTotalScore,
      googleSafeBrowsing: reputation.googleSafeBrowsing,
      createdAt: createdAtIso,
      fromCache: false,
      fromTrustedDomain: false,
      domainScanCount: domainPattern?.scanCount ?? null,
      communityTrustScore: null,
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
