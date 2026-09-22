import { Router } from "express";
import { db, scansTable } from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { logger } from "../lib/logger.js";

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

/**
 * GET /api/alerts/retroactive
 * Checks if a scan (or recent scans) for a device was elevated to malicious
 * by Tier 2 background Playwright sandbox.
 */
router.get("/alerts/retroactive", async (req, res): Promise<void> => {
  try {
    const rawScanId = req.query["scanId"];
    const rawDeviceId = req.query["deviceId"];

    if (rawScanId) {
      const scanId = Number(rawScanId);
      if (isNaN(scanId)) {
        res.status(400).json({ error: "Invalid scanId" });
        return;
      }

      const conditions = [eq(scansTable.id, scanId)];
      if (typeof rawDeviceId === "string" && rawDeviceId.trim() !== "") {
        conditions.push(eq(scansTable.deviceId, rawDeviceId.trim()));
      }

      const [scan] = await db
        .select()
        .from(scansTable)
        .where(conditions.length > 1 ? and(...conditions) : conditions[0])
        .limit(1);

      if (!scan) {
        res.status(404).json({ error: "Scan not found", elevated: false });
        return;
      }

      const isElevated = scan.verdict === "malicious" || (!scan.isSafe && scan.riskScore >= 70);

      res.json({
        elevated: isElevated,
        scanId: scan.id,
        originalUrl: scan.originalUrl,
        finalUrl: scan.finalUrl,
        isSafe: scan.isSafe,
        verdict: scan.verdict,
        threatCategory: scan.threatCategory,
        riskScore: scan.riskScore,
        reasons: safeParseJsonArray(scan.reasons),
        previewImageUrl: scan.previewImageUrl,
        createdAt: scan.createdAt.toISOString(),
      });
      return;
    }

    // If no specific scanId, check for recent elevated threats in the last 15 minutes
    if (typeof rawDeviceId === "string" && rawDeviceId.trim() !== "") {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const recentThreats = await db
        .select()
        .from(scansTable)
        .where(
          and(
            eq(scansTable.deviceId, rawDeviceId.trim()),
            eq(scansTable.verdict, "malicious"),
            gte(scansTable.createdAt, fifteenMinutesAgo),
          ),
        )
        .orderBy(desc(scansTable.createdAt))
        .limit(5);

      res.json({
        elevated: recentThreats.length > 0,
        alerts: recentThreats.map((s) => ({
          scanId: s.id,
          originalUrl: s.originalUrl,
          finalUrl: s.finalUrl,
          isSafe: s.isSafe,
          verdict: s.verdict,
          threatCategory: s.threatCategory,
          riskScore: s.riskScore,
          reasons: safeParseJsonArray(s.reasons),
          previewImageUrl: s.previewImageUrl,
          createdAt: s.createdAt.toISOString(),
        })),
      });
      return;
    }

    res.status(400).json({ error: "Either scanId or deviceId is required" });
  } catch (err: any) {
    logger.error({ error: err.message }, "Error in GET /api/alerts/retroactive");
    if (req.query["scanId"]) {
      res.status(404).json({ error: "Scan not found", elevated: false });
    } else {
      res.status(200).json({ elevated: false, alerts: [] });
    }
  }
});

/**
 * POST /api/alerts/acknowledge
 */
router.post("/alerts/acknowledge", (req, res): void => {
  const { scanId, deviceId } = req.body || {};
  logger.info({ scanId, deviceId }, "Retroactive threat alert acknowledged by client");
  res.json({ acknowledged: true, scanId, deviceId });
});

export default router;
