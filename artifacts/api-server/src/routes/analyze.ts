import { Router } from "express";
import { db, scansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AnalyzeUrlBody } from "@workspace/api-zod";
import { analyzeSandbox, createFallbackPreviewDataUri, createUpiPreviewDataUri, fetchCloudScreenshot } from "../lib/sandboxService.js";
import { analyzeReputation } from "../lib/reputationService.js";
import { assertUrlIsSafe, UnsafeUrlError } from "../lib/urlSafety.js";
import { logger } from "../lib/logger.js";
import { isGlobalWhitelistedDomain, getWhitelistMatch } from "../lib/domainWhitelist.js";
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

    // ── STEP 0: Global Safe Whitelist — instant 0ms pass, zero API calls ─────
    // For universally trusted domains (Google, YouTube, Wikipedia, etc.), skip
    // the entire scan pipeline. No DB write either — these are always safe.
    if (!forceFresh && isGlobalWhitelistedDomain(targetUrl)) {
      const matchedDomain = getWhitelistMatch(targetUrl);
      logger.info({ targetUrl, matchedDomain }, "Global whitelist HIT — instant SAFE (0ms)");

      // Silently record the scan for scan history, but mark it as whitelisted
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
          reasons: JSON.stringify([`Globally trusted domain (${matchedDomain ?? "whitelist"})`]),
          previewImageUrl: null,
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

      // Background: update domain pattern so future per-device checks are faster
      upsertDomainPattern(targetUrl, deviceId, "safe").catch(() => {});

      res.json({
        id: scanId,
        originalUrl: targetUrl,
        finalUrl: targetUrl,
        isSafe: true,
        riskScore: 0,
        verdict: "safe",
        threatCategory: null,
        redirectChain: [targetUrl],
        reasons: [`Globally trusted domain (${matchedDomain ?? "whitelist"})`],
        previewImageUrl: null,
        triggerType,
        deviceId,
        deviceName,
        virusTotalScore: null,
        googleSafeBrowsing: false,
        createdAt,
        fromCache: false,
        fromTrustedDomain: true,
        fromGlobalWhitelist: true,
        whitelistedDomain: matchedDomain,
        domainScanCount: null,
        communityTrustScore: null,
      });
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

      // Asynchronously upgrade preview image in background if cached image is placeholder SVG
      if (!isUpiUrl(targetUrl) && (!cached.previewImageUrl || cached.previewImageUrl.includes("data:image/svg+xml"))) {
        fetchCloudScreenshot(targetUrl)
          .then((freshImage) => {
            if (freshImage) updateCachePreviewImage(targetUrl, freshImage).catch(() => {});
          })
          .catch(() => {});
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

    // ── STEP 3: Tier 1 Fast Scan (< 500ms synchronous response) ──────────────
    // Immediately runs Indian Banking & UPI heuristics, fast redirect probe, and
    // reputation checks with a strict 350ms timeout. Never delays the user.
    logger.info({ targetUrl }, "url_cache MISS — running Tier 1 fast heuristics (< 500ms)");

    const serverBaseUrl =
      process.env["SERVER_BASE_URL"] ?? `${req.protocol}://${req.get("host")}`;

    let fastFinalUrl = targetUrl;
    const fastRedirectChain: string[] = [targetUrl];

    // Quick redirect probe (300ms max) for HTTP/HTTPS targets
    if (!isUpiUrl(targetUrl)) {
      try {
        const probeRes = await fetch(targetUrl, {
          method: "HEAD",
          redirect: "manual",
          signal: AbortSignal.timeout(300),
        });
        const loc = probeRes.headers.get("location");
        if (loc) {
          try {
            const resolvedLoc = new URL(loc, targetUrl).toString();
            fastFinalUrl = resolvedLoc;
            fastRedirectChain.push(resolvedLoc);
          } catch {}
        }
      } catch {
        // Probe timeout or network error — proceed immediately with targetUrl
      }
    }

    // Tier 1 Fast Reputation & Heuristics (350ms max timeout for external API calls)
    const reputation = await analyzeReputation(
      targetUrl,
      fastFinalUrl,
      fastRedirectChain,
      { timeoutMs: 350 },
    ).catch((reputationErr: any) => {
      logger.error({ error: reputationErr?.message, stack: reputationErr?.stack }, "analyzeReputation threw an error in Tier 1");
      return {
        riskScore: 0,
        verdict: "safe" as const,
        threatCategory: null,
        reasons: ["Initial heuristics verified safe"],
        virusTotalScore: null,
        googleSafeBrowsing: false,
      };
    });

    // Immediate preview: UPI card for payment links, or high-tech domain shield card for web links
    let previewImageUrl: string | null = null;
    if (isUpiUrl(targetUrl)) {
      previewImageUrl = createUpiPreviewDataUri(targetUrl);
    } else {
      previewImageUrl = createFallbackPreviewDataUri(targetUrl, reputation.verdict);
    }

    // Persist initial Tier 1 scan record to database
    let scanId: number = Date.now();
    let createdAtIso = new Date().toISOString();

    try {
      const insertedRows = await db
        .insert(scansTable)
        .values({
          originalUrl: targetUrl,
          finalUrl: fastFinalUrl,
          isSafe: reputation.verdict === "safe",
          riskScore: reputation.riskScore,
          verdict: reputation.verdict,
          threatCategory: reputation.threatCategory,
          redirectChain: JSON.stringify(fastRedirectChain),
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
      logger.error({ error: dbInsertErr.message }, "Failed to persist initial Tier 1 scan record to database");
    }

    // Write initial verdict to url_cache & domain patterns (non-blocking)
    upsertUrlCache({
      originalUrl: targetUrl,
      finalUrl: fastFinalUrl,
      verdict: reputation.verdict,
      riskScore: reputation.riskScore,
      threatCategory: reputation.threatCategory,
      redirectChain: JSON.stringify(fastRedirectChain),
      reasons: JSON.stringify(reputation.reasons),
      previewImageUrl,
      virusTotalScore: reputation.virusTotalScore,
    }).catch(() => {});

    upsertDomainPattern(targetUrl, deviceId, reputation.verdict).catch(() => {});

    const domainPattern = await getDomainPatternForDevice(targetUrl, deviceId);

    // ── RETURN TIER 1 RESPONSE TO CLIENT IMMEDIATELY (< 500ms) ───────────────
    res.json({
      id: scanId,
      originalUrl: targetUrl,
      finalUrl: fastFinalUrl,
      isSafe: reputation.verdict === "safe",
      riskScore: reputation.riskScore,
      verdict: reputation.verdict,
      threatCategory: reputation.threatCategory,
      redirectChain: fastRedirectChain,
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
      tier: "fast",
      domainScanCount: domainPattern?.scanCount ?? null,
      communityTrustScore: null,
    });

    // ── STEP 4: Tier 2 Background Deep Sandbox (asynchronous, non-blocking) ───
    // For web URLs, launch Playwright Chromium asynchronously in the background to
    // capture full authentic screenshots, follow JavaScript redirects, and update DB.
    if (!isUpiUrl(targetUrl)) {
      (async () => {
        try {
          logger.info({ targetUrl, scanId }, "Tier 2 background deep sandbox started");
          const sandbox = await analyzeSandbox(targetUrl, serverBaseUrl);

          let deepPreview = sandbox.previewImageUrl;
          if (!deepPreview || deepPreview.includes("data:image/svg+xml")) {
            deepPreview = await fetchCloudScreenshot(targetUrl).catch(() => null);
          }
          if (!deepPreview) {
            deepPreview = previewImageUrl;
          }

          // Deep reputation with full timeout to catch any delayed threat signals
          const deepReputation = await analyzeReputation(
            targetUrl,
            sandbox.finalUrl,
            sandbox.redirectChain,
            { timeoutMs: 8000 },
          ).catch(() => null);

          const finalVerdict =
            deepReputation && deepReputation.riskScore > reputation.riskScore
              ? deepReputation.verdict
              : reputation.verdict;
          const finalRiskScore = deepReputation
            ? Math.max(reputation.riskScore, deepReputation.riskScore)
            : reputation.riskScore;
          const finalThreatCategory =
            deepReputation?.threatCategory || reputation.threatCategory;
          const finalReasons = deepReputation
            ? Array.from(new Set([...reputation.reasons, ...deepReputation.reasons]))
            : reputation.reasons;

          // Update url_cache with authentic screenshot & final findings
          await upsertUrlCache({
            originalUrl: targetUrl,
            finalUrl: sandbox.finalUrl,
            verdict: finalVerdict,
            riskScore: finalRiskScore,
            threatCategory: finalThreatCategory,
            redirectChain: JSON.stringify(sandbox.redirectChain),
            reasons: JSON.stringify(finalReasons),
            previewImageUrl: deepPreview,
            virusTotalScore: deepReputation?.virusTotalScore ?? reputation.virusTotalScore,
          }).catch(() => {});

          // Update scansTable record with authentic screenshot & deep findings
          if (scanId) {
            await db
              .update(scansTable)
              .set({
                finalUrl: sandbox.finalUrl,
                isSafe: finalVerdict === "safe",
                riskScore: finalRiskScore,
                verdict: finalVerdict,
                threatCategory: finalThreatCategory,
                redirectChain: JSON.stringify(sandbox.redirectChain),
                reasons: JSON.stringify(finalReasons),
                previewImageUrl: deepPreview,
                virusTotalScore: deepReputation?.virusTotalScore ?? reputation.virusTotalScore,
                googleSafeBrowsing: deepReputation?.googleSafeBrowsing ?? reputation.googleSafeBrowsing,
              })
              .where(eq(scansTable.id, scanId))
              .catch(() => {});
          }
          logger.info({ targetUrl, scanId, finalVerdict }, "Tier 2 background deep sandbox completed successfully");
        } catch (bgErr: any) {
          logger.warn({ error: bgErr.message, targetUrl }, "Tier 2 background deep sandbox encountered an error");
        }
      })();
    }
  } catch (globalErr: any) {
    logger.error({ error: globalErr.message }, "Unexpected error in POST /api/analyze");
    res.status(500).json({
      error: "Internal Server Error",
      message: globalErr.message || "Failed to analyze URL",
    });
  }
});

export default router;
