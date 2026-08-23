import { Router } from "express";
import { db, scansTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { GetScanParams, ListScansQueryParams } from "@workspace/api-zod";

const router = Router();

function formatScan(s: typeof scansTable.$inferSelect) {
  return {
    id: s.id,
    originalUrl: s.originalUrl,
    finalUrl: s.finalUrl,
    isSafe: s.isSafe,
    riskScore: s.riskScore,
    verdict: s.verdict,
    threatCategory: s.threatCategory,
    redirectChain: (() => { try { return JSON.parse(s.redirectChain); } catch { return []; } })(),
    reasons: (() => { try { return JSON.parse(s.reasons); } catch { return []; } })(),
    previewImageUrl: s.previewImageUrl,
    triggerType: s.triggerType,
    virusTotalScore: s.virusTotalScore,
    googleSafeBrowsing: s.googleSafeBrowsing,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/scans", async (req, res): Promise<void> => {
  const parsed = ListScansQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 50, offset = 0, verdict } = parsed.data;

  let query = db.select().from(scansTable).orderBy(desc(scansTable.createdAt)).$dynamic();
  if (verdict) {
    query = query.where(eq(scansTable.verdict, verdict));
  }

  const [items, totalResult] = await Promise.all([
    query.limit(limit).offset(offset),
    db.select({ count: count() }).from(scansTable),
  ]);

  res.json({
    items: items.map(formatScan),
    total: totalResult[0]?.count ?? 0,
  });
});

router.get("/scans/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const parsed = GetScanParams.safeParse({ id: parseInt(rawId ?? "0", 10) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid scan ID" });
    return;
  }

  const [scan] = await db.select().from(scansTable).where(eq(scansTable.id, parsed.data.id)).limit(1);
  if (!scan) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  res.json(formatScan(scan));
});

export default router;
