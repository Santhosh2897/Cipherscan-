/**
 * community.ts — Community Threat Intelligence endpoints
 *
 * GET  /api/community/trust?url=        Get community trust score for a URL
 * POST /api/community/report            User reports a URL as threat
 * GET  /api/community/trending-threats  Most flagged threat categories in 24h
 * GET  /api/community/stats             Overall community intelligence stats
 * GET  /api/user/patterns               Per-device domain patterns and stats
 */

import { Router } from "express";
import { db, communityReportsTable, urlCacheTable, userDomainPatternsTable } from "@workspace/db";
import { eq, desc, sql, gte, and } from "drizzle-orm";
import {
  computeCommunityTrust,
  submitCommunityReport,
  hashUrl,
  normalizeUrl,
  getCacheStats,
} from "../lib/urlIntelligence.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ─── GET /api/community/trust?url= ──────────────────────────────────────────
router.get("/community/trust", async (req, res): Promise<void> => {
  const url = typeof req.query["url"] === "string" ? req.query["url"] : null;
  if (!url) {
    res.status(400).json({ error: "url query parameter is required" });
    return;
  }

  const trust = await computeCommunityTrust(url);
  res.json({
    urlHash: hashUrl(url),
    trustScore: trust.trustScore,
    scanCount: trust.scanCount,
    communityFlags: trust.communityFlags,
    verdict: trust.verdict,
    // trustScore = -1 means URL is not in community database yet
    isKnown: trust.trustScore >= 0,
  });
});

// ─── POST /api/community/report ──────────────────────────────────────────────
router.post("/community/report", async (req, res): Promise<void> => {
  const { url, deviceId, reportedVerdict } = req.body as {
    url?: string;
    deviceId?: string;
    reportedVerdict?: string;
  };

  if (!url || !deviceId || !reportedVerdict) {
    res.status(400).json({ error: "url, deviceId, and reportedVerdict are required" });
    return;
  }

  if (!["malicious", "suspicious"].includes(reportedVerdict)) {
    res.status(400).json({ error: "reportedVerdict must be 'malicious' or 'suspicious'" });
    return;
  }

  try {
    await submitCommunityReport(url, deviceId, reportedVerdict as "malicious" | "suspicious");
    logger.info({ urlHash: hashUrl(url), reportedVerdict }, "Community report submitted");
    res.json({ success: true, message: "Thank you for your report. It helps protect all users." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/community/trending-threats ────────────────────────────────────
router.get("/community/trending-threats", async (req, res): Promise<void> => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Top flagged threat categories in last 24h from url_cache
    const threatCategories = await db
      .select({
        category: urlCacheTable.threatCategory,
        count: sql<number>`COUNT(*)`,
        avgRisk: sql<number>`AVG(risk_score)`,
      })
      .from(urlCacheTable)
      .where(
        and(
          sql`threat_category IS NOT NULL`,
          gte(urlCacheTable.lastScanned, since),
        ),
      )
      .groupBy(urlCacheTable.threatCategory)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    // Top community-flagged URLs in last 24h
    const flagged = await db
      .select({
        urlHash: communityReportsTable.urlHash,
        flagCount: sql<number>`COUNT(*)`,
      })
      .from(communityReportsTable)
      .where(gte(communityReportsTable.reportedAt, since))
      .groupBy(communityReportsTable.urlHash)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    res.json({
      period: "last_24h",
      trendingCategories: threatCategories.map((r) => ({
        category: r.category ?? "Unknown",
        count: Number(r.count),
        avgRiskScore: Math.round(Number(r.avgRisk)),
      })),
      topFlaggedUrls: flagged.map((r) => ({
        urlHash: r.urlHash, // Never return plaintext URLs in the community feed
        flagCount: Number(r.flagCount),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/community/stats ────────────────────────────────────────────────
router.get("/community/stats", async (req, res): Promise<void> => {
  try {
    const stats = await getCacheStats();

    const [cacheBreakdown] = await db
      .select({
        safeCount: sql<number>`COUNT(*) FILTER (WHERE verdict = 'safe')`,
        suspiciousCount: sql<number>`COUNT(*) FILTER (WHERE verdict = 'suspicious')`,
        maliciousCount: sql<number>`COUNT(*) FILTER (WHERE verdict = 'malicious')`,
        totalScanHits: sql<number>`SUM(scan_count)`,
        avgScanCount: sql<number>`AVG(scan_count)`,
      })
      .from(urlCacheTable);

    const [reportStats] = await db
      .select({ totalReports: sql<number>`COUNT(*)` })
      .from(communityReportsTable);

    res.json({
      totalCachedUrls: stats.totalCachedUrls,
      totalCommunityFlags: stats.totalCommunityFlags,
      totalReports: Number(reportStats?.totalReports ?? 0),
      totalScanHits: Number(cacheBreakdown?.totalScanHits ?? 0),
      avgUrlScanCount: Number(cacheBreakdown?.avgScanCount ?? 0).toFixed(1),
      verdictBreakdown: {
        safe: Number(cacheBreakdown?.safeCount ?? 0),
        suspicious: Number(cacheBreakdown?.suspiciousCount ?? 0),
        malicious: Number(cacheBreakdown?.maliciousCount ?? 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/patterns?deviceId= ───────────────────────────────────────
router.get("/user/patterns", async (req, res): Promise<void> => {
  const deviceId = typeof req.query["deviceId"] === "string" ? req.query["deviceId"] : null;
  if (!deviceId) {
    res.status(400).json({ error: "deviceId query parameter is required" });
    return;
  }

  try {
    const patterns = await db
      .select()
      .from(userDomainPatternsTable)
      .where(eq(userDomainPatternsTable.deviceId, deviceId))
      .orderBy(desc(userDomainPatternsTable.scanCount))
      .limit(100);

    const trustedDomains = patterns.filter((p) => p.isTrusted && !p.isBlocked).map((p) => p.domain);
    const blockedDomains = patterns.filter((p) => p.isBlocked).map((p) => p.domain);
    const totalScans = patterns.reduce((sum, p) => sum + (p.scanCount ?? 0), 0);

    res.json({
      deviceId,
      trustedDomains,
      blockedDomains,
      totalDomainsTracked: patterns.length,
      totalScansTracked: totalScans,
      topDomains: patterns.slice(0, 20).map((p) => ({
        domain: p.domain,
        scanCount: p.scanCount,
        isTrusted: p.isTrusted,
        lastSeen: p.lastSeen,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/trust ────────────────────────────────────────────────────
/** Manual trust / block override by the user */
router.post("/user/trust", async (req, res): Promise<void> => {
  const { deviceId: rawDevId, domain: rawDomain, action } = req.body as {
    deviceId?: string;
    domain?: string;
    action?: "trust" | "block" | "reset";
  };

  const deviceId = rawDevId?.trim();
  const domain = rawDomain?.trim().toLowerCase();

  if (!deviceId || !domain || !action) {
    res.status(400).json({ error: "deviceId, domain, and action are required" });
    return;
  }

  if (!["trust", "block", "reset"].includes(action)) {
    res.status(400).json({ error: "action must be 'trust', 'block', or 'reset'" });
    return;
  }

  // Domain syntax validation to prevent script or header injection
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
  if (!domainRegex.test(domain) || domain.length > 253) {
    res.status(400).json({ error: "Invalid domain format" });
    return;
  }

  if (deviceId.length > 128) {
    res.status(400).json({ error: "Invalid deviceId" });
    return;
  }

  try {
    const updates =
      action === "trust"
        ? { isTrusted: true, isBlocked: false }
        : action === "block"
        ? { isTrusted: false, isBlocked: true }
        : { isTrusted: false, isBlocked: false };

    await db
      .insert(userDomainPatternsTable)
      .values({ deviceId, domain, scanCount: 0, ...updates })
      .onConflictDoUpdate({
        target: [userDomainPatternsTable.deviceId, userDomainPatternsTable.domain],
        set: updates,
      });

    res.json({ success: true, domain, action });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
