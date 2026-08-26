import { Router } from "express";
import { db, scansTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(raw: unknown): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

router.get("/scans", async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);

    const results = await db
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
        virusTotalScore: scansTable.virusTotalScore,
        googleSafeBrowsing: scansTable.googleSafeBrowsing,
        createdAt: scansTable.createdAt,
      })
      .from(scansTable)
      .orderBy(desc(scansTable.createdAt))
      .limit(limit);

    return res.json({ items: results });
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
    return res.json(scan);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;