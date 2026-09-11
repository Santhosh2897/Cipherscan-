/**
 * urlIntelligence.ts — Smart URL caching + community threat intelligence service.
 *
 * Responsibilities:
 *  1. URL normalization and SHA-256 hashing for cross-user deduplication
 *  2. url_cache read/write with per-verdict TTL
 *  3. user_domain_patterns update + trusted domain lookup
 *  4. Community trust score calculation
 */

import { createHash } from "crypto";
import { db, urlCacheTable, userDomainPatternsTable, communityReportsTable } from "@workspace/db";
import { eq, and, gt, sql } from "drizzle-orm";
import { logger } from "./logger.js";

// ─── TTL constants (milliseconds) ───────────────────────────────────────────
const TTL_MS = {
  safe: 24 * 60 * 60 * 1000,         // 24 hours
  suspicious: 6 * 60 * 60 * 1000,    // 6 hours
  malicious: 60 * 60 * 1000,         // 1 hour — re-check often
  upi: 0,                             // never cache UPI payment URLs
} as const;

/** Auto-whitelist threshold: domain scanned ≥ N times with safe verdict */
const TRUSTED_DOMAIN_THRESHOLD = 10;

// ─── URL Normalization ───────────────────────────────────────────────────────

/**
 * Normalizes a URL for consistent hashing:
 * - Lowercase scheme + host
 * - Strip UTM/tracking params (utm_source, utm_medium, utm_campaign, fbclid, gclid, etc.)
 * - Sort remaining query params for canonicalization
 * - Strip trailing slash from path (unless root)
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hostname = url.hostname.toLowerCase();
    url.protocol = url.protocol.toLowerCase();

    const STRIP_PARAMS = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "fbclid", "gclid", "msclkid", "ref", "referrer", "source",
    ];
    STRIP_PARAMS.forEach((p) => url.searchParams.delete(p));

    // Sort remaining params for canonical form
    url.searchParams.sort();

    // Normalize path: remove trailing slash unless root
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

/**
 * Returns SHA-256 hex digest of the normalized URL.
 * Used as the primary key in url_cache.
 */
export function hashUrl(url: string): string {
  return createHash("sha256").update(normalizeUrl(url)).digest("hex");
}

/**
 * Returns SHA-256 hex digest of a device ID.
 * Used to pseudonymize device IDs in community_reports.
 */
export function hashDeviceId(deviceId: string): string {
  return createHash("sha256").update(deviceId).digest("hex");
}

/**
 * Returns true if the URL is a UPI payment intent that should never be cached.
 */
export function isUpiUrl(url: string): boolean {
  return url.toLowerCase().startsWith("upi://");
}

// ─── Cache TTL helper ────────────────────────────────────────────────────────

function computeExpiresAt(verdict: string, url: string): Date {
  if (isUpiUrl(url)) {
    // UPI URLs expire immediately (never cache)
    return new Date(0);
  }
  const ttl = TTL_MS[verdict as keyof typeof TTL_MS] ?? TTL_MS.safe;
  return new Date(Date.now() + ttl);
}

// ─── Cache Read ──────────────────────────────────────────────────────────────

export interface CachedScanResult {
  urlHash: string;
  originalUrl: string;
  finalUrl: string;
  verdict: string;
  riskScore: number;
  threatCategory: string | null;
  redirectChain: string;
  reasons: string;
  previewImageUrl: string | null;
  virusTotalScore: number | null;
  scanCount: number;
  communityFlags: number;
}

/**
 * Looks up a URL in the cross-user cache.
 * Returns the cached result if not expired, otherwise null.
 */
export async function getCachedScan(url: string): Promise<CachedScanResult | null> {
  if (isUpiUrl(url)) return null;

  const urlHash = hashUrl(url);
  const now = new Date();

  try {
    const [row] = await db
      .select()
      .from(urlCacheTable)
      .where(and(eq(urlCacheTable.urlHash, urlHash), gt(urlCacheTable.expiresAt, now)))
      .limit(1);

    if (!row) return null;

    logger.info({ urlHash, verdict: row.verdict, scanCount: row.scanCount }, "url_cache HIT");
    return row as CachedScanResult;
  } catch (err: any) {
    logger.warn({ error: err.message }, "url_cache lookup failed — bypassing cache");
    return null;
  }
}

// ─── Cache Write ─────────────────────────────────────────────────────────────

export interface ScanResultForCache {
  originalUrl: string;
  finalUrl: string;
  verdict: string;
  riskScore: number;
  threatCategory?: string | null;
  redirectChain: string;
  reasons: string;
  previewImageUrl?: string | null;
  virusTotalScore?: number | null;
}

/**
 * Upserts a scan result into the url_cache.
 * If the URL already exists, increments scan_count and refreshes last_scanned + expires_at.
 */
export async function upsertUrlCache(result: ScanResultForCache): Promise<void> {
  if (isUpiUrl(result.originalUrl)) return;

  const urlHash = hashUrl(result.originalUrl);
  const expiresAt = computeExpiresAt(result.verdict, result.originalUrl);

  try {
    await db
      .insert(urlCacheTable)
      .values({
        urlHash,
        originalUrl: result.originalUrl,
        finalUrl: result.finalUrl,
        verdict: result.verdict,
        riskScore: result.riskScore,
        threatCategory: result.threatCategory ?? null,
        redirectChain: result.redirectChain,
        reasons: result.reasons,
        previewImageUrl: result.previewImageUrl ?? null,
        virusTotalScore: result.virusTotalScore ?? null,
        scanCount: 1,
        communityFlags: 0,
        expiresAt,
        firstSeen: new Date(),
        lastScanned: new Date(),
      })
      .onConflictDoUpdate({
        target: urlCacheTable.urlHash,
        set: {
          finalUrl: result.finalUrl,
          verdict: result.verdict,
          riskScore: result.riskScore,
          threatCategory: result.threatCategory ?? null,
          redirectChain: result.redirectChain,
          reasons: result.reasons,
          previewImageUrl: result.previewImageUrl ?? null,
          virusTotalScore: result.virusTotalScore ?? null,
          scanCount: sql`url_cache.scan_count + 1`,
          lastScanned: new Date(),
          expiresAt,
        },
      });

    logger.info({ urlHash, verdict: result.verdict }, "url_cache UPSERT");
  } catch (err: any) {
    logger.warn({ error: err.message }, "url_cache upsert failed — continuing without cache");
  }
}

/**
 * Increments scan_count for an existing cache entry (on cache hit).
 */
export async function incrementCacheScanCount(url: string): Promise<void> {
  const urlHash = hashUrl(url);
  try {
    await db
      .update(urlCacheTable)
      .set({
        scanCount: sql`url_cache.scan_count + 1`,
        lastScanned: new Date(),
      })
      .where(eq(urlCacheTable.urlHash, urlHash));
  } catch {
    // Non-critical, ignore
  }
}

/**
 * Updates the preview image in the URL cache (e.g. replacing placeholder SVGs with real screenshots).
 */
export async function updateCachePreviewImage(url: string, previewImageUrl: string): Promise<void> {
  const urlHash = hashUrl(url);
  try {
    await db
      .update(urlCacheTable)
      .set({
        previewImageUrl,
        lastScanned: new Date(),
      })
      .where(eq(urlCacheTable.urlHash, urlHash));
  } catch {
    // Non-critical, ignore
  }
}

// ─── User Domain Patterns ────────────────────────────────────────────────────

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Returns true if the device has a trusted pattern for this domain.
 * Used to return instant SAFE for whitelisted domains.
 */
export async function isTrustedDomainForDevice(url: string, deviceId: string | null): Promise<boolean> {
  if (!deviceId) return false;
  const domain = extractDomain(url);
  if (!domain) return false;

  try {
    const [pattern] = await db
      .select()
      .from(userDomainPatternsTable)
      .where(
        and(
          eq(userDomainPatternsTable.deviceId, deviceId),
          eq(userDomainPatternsTable.domain, domain),
          eq(userDomainPatternsTable.isTrusted, true),
          eq(userDomainPatternsTable.isBlocked, false),
        ),
      )
      .limit(1);

    return !!pattern;
  } catch {
    return false;
  }
}

/**
 * Returns domain pattern info for messaging in the scan overlay.
 */
export async function getDomainPatternForDevice(
  url: string,
  deviceId: string | null,
): Promise<{ scanCount: number; isTrusted: boolean } | null> {
  if (!deviceId) return null;
  const domain = extractDomain(url);
  if (!domain) return null;

  try {
    const [pattern] = await db
      .select()
      .from(userDomainPatternsTable)
      .where(
        and(
          eq(userDomainPatternsTable.deviceId, deviceId),
          eq(userDomainPatternsTable.domain, domain),
        ),
      )
      .limit(1);

    return pattern ? { scanCount: pattern.scanCount, isTrusted: pattern.isTrusted } : null;
  } catch {
    return null;
  }
}

/**
 * Upserts domain pattern for a device. Auto-whitelists when threshold is reached
 * and the verdict is safe.
 */
export async function upsertDomainPattern(
  url: string,
  deviceId: string | null,
  verdict: string,
): Promise<void> {
  if (!deviceId || isUpiUrl(url)) return;
  const domain = extractDomain(url);
  if (!domain) return;

  try {
    await db
      .insert(userDomainPatternsTable)
      .values({
        deviceId,
        domain,
        scanCount: 1,
        lastSeen: new Date(),
        isTrusted: false,
        isBlocked: false,
      })
      .onConflictDoUpdate({
        target: [userDomainPatternsTable.deviceId, userDomainPatternsTable.domain],
        set: {
          scanCount: sql`user_domain_patterns.scan_count + 1`,
          lastSeen: new Date(),
          // Auto-trust after threshold of safe scans
          isTrusted: sql`
            CASE
              WHEN ${verdict} = 'safe'
                AND user_domain_patterns.scan_count + 1 >= ${TRUSTED_DOMAIN_THRESHOLD}
                AND NOT user_domain_patterns.is_blocked
              THEN true
              WHEN ${verdict} != 'safe' THEN false
              ELSE user_domain_patterns.is_trusted
            END
          `,
        },
      });
  } catch (err: any) {
    logger.warn({ error: err.message }, "upsertDomainPattern failed — non-critical");
  }
}

// ─── Community Trust Score ───────────────────────────────────────────────────

/**
 * Computes a 0–100 community trust score for a URL.
 *
 * Formula: (safe_fraction) * log10(total_votes + 1) * 100
 *
 * - URL with 1 safe scan: ~50 (uncertain)
 * - URL with 100 safe scans: ~100 (highly trusted)
 * - URL with any malicious flag: 0 (immediate red flag)
 */
export async function computeCommunityTrust(url: string): Promise<{
  trustScore: number;
  scanCount: number;
  communityFlags: number;
  verdict: string | null;
}> {
  const urlHash = hashUrl(url);

  try {
    const [row] = await db
      .select()
      .from(urlCacheTable)
      .where(eq(urlCacheTable.urlHash, urlHash))
      .limit(1);

    if (!row) return { trustScore: -1, scanCount: 0, communityFlags: 0, verdict: null };

    if (row.communityFlags > 0) {
      return { trustScore: 0, scanCount: row.scanCount, communityFlags: row.communityFlags, verdict: row.verdict };
    }

    const safeFraction = row.verdict === "safe" ? 1 : row.verdict === "suspicious" ? 0.3 : 0;
    const trustScore = Math.round(safeFraction * Math.log10(row.scanCount + 1) * 100);

    return {
      trustScore: Math.min(100, Math.max(0, trustScore)),
      scanCount: row.scanCount,
      communityFlags: row.communityFlags,
      verdict: row.verdict,
    };
  } catch {
    return { trustScore: -1, scanCount: 0, communityFlags: 0, verdict: null };
  }
}

/**
 * Records a community threat report and increments the url_cache community_flags counter.
 */
export async function submitCommunityReport(
  url: string,
  deviceId: string,
  reportedVerdict: "malicious" | "suspicious",
): Promise<void> {
  const urlHash = hashUrl(url);
  const deviceIdHash = hashDeviceId(deviceId);

  try {
    await db.insert(communityReportsTable).values({
      id: crypto.randomUUID(),
      urlHash,
      deviceIdHash,
      reportedVerdict,
      reportedAt: new Date(),
    });

    // Increment community_flags in url_cache
    await db
      .update(urlCacheTable)
      .set({ communityFlags: sql`url_cache.community_flags + 1` })
      .where(eq(urlCacheTable.urlHash, urlHash));
  } catch (err: any) {
    logger.warn({ error: err.message }, "submitCommunityReport failed");
  }
}

// ─── Cache Statistics ────────────────────────────────────────────────────────

export async function getCacheStats(): Promise<{
  totalCachedUrls: number;
  totalCommunityFlags: number;
  topVerdicts: Array<{ verdict: string; count: number }>;
}> {
  try {
    const [statsRow] = await db
      .select({
        totalCachedUrls: sql<number>`COUNT(*)`,
        totalCommunityFlags: sql<number>`SUM(community_flags)`,
      })
      .from(urlCacheTable);

    const verdictRows = await db
      .select({
        verdict: urlCacheTable.verdict,
        count: sql<number>`COUNT(*)`,
      })
      .from(urlCacheTable)
      .groupBy(urlCacheTable.verdict);

    return {
      totalCachedUrls: Number(statsRow?.totalCachedUrls ?? 0),
      totalCommunityFlags: Number(statsRow?.totalCommunityFlags ?? 0),
      topVerdicts: verdictRows.map((r) => ({ verdict: r.verdict, count: Number(r.count) })),
    };
  } catch {
    return { totalCachedUrls: 0, totalCommunityFlags: 0, topVerdicts: [] };
  }
}
