import { Router } from "express";
import { db, scansTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

const router = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(raw: unknown): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function safeParseJsonArray(input: string | null | undefined): string[] {
  if (!input) return [];
  try {
    const parsed = typeof input === "string" ? JSON.parse(input) : input;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatScanRecord(scan: any) {
  return {
    ...scan,
    redirectChain: safeParseJsonArray(scan.redirectChain),
    reasons: safeParseJsonArray(scan.reasons),
    createdAt: scan.createdAt instanceof Date ? scan.createdAt.toISOString() : scan.createdAt,
  };
}

router.get("/scans", async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const rawVerdict = typeof req.query.verdict === "string" ? req.query.verdict.trim().toLowerCase() : undefined;
    const isValidVerdict = rawVerdict && ["safe", "suspicious", "malicious"].includes(rawVerdict);
    const deviceIdParam = typeof req.query.deviceId === "string" && req.query.deviceId.trim() !== "" ? req.query.deviceId.trim() : undefined;

    const baseQuery = db
      .select({
        id: scansTable.id,
        originalUrl: scansTable.originalUrl,
        finalUrl: scansTable.finalUrl,
        isSafe: scansTable.isSafe,
        verdict: scansTable.verdict,
        riskScore: scansTable.riskScore,
        threatCategory: scansTable.threatCategory,
        redirectChain: scansTable.redirectChain,
        reasons: scansTable.reasons,
        previewImageUrl: scansTable.previewImageUrl,
        triggerType: scansTable.triggerType,
        deviceId: scansTable.deviceId,
        deviceName: scansTable.deviceName,
        virusTotalScore: scansTable.virusTotalScore,
        googleSafeBrowsing: scansTable.googleSafeBrowsing,
        createdAt: scansTable.createdAt,
      })
      .from(scansTable);

    const conditions = [];
    if (isValidVerdict) {
      conditions.push(eq(scansTable.verdict, rawVerdict as "safe" | "suspicious" | "malicious"));
    }
    if (deviceIdParam) {
      conditions.push(eq(scansTable.deviceId, deviceIdParam));
    }

    const results = conditions.length > 0
      ? await baseQuery
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(scansTable.createdAt))
          .limit(limit)
      : await baseQuery
          .orderBy(desc(scansTable.createdAt))
          .limit(limit);

    return res.json({ items: results.map(formatScanRecord) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/scans/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid scan id" });
    }

    const [scan] = await db.select().from(scansTable).where(eq(scansTable.id, id)).limit(1);
    if (!scan) {
      return res.status(404).json({ error: "Scan not found" });
    }
    return res.json(formatScanRecord(scan));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;