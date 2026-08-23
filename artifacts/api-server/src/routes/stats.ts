import { Router } from "express";
import { db, scansTable } from "@workspace/db";
import { eq, sql, count, avg, gte, desc } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totals, todayCount, topThreat] = await Promise.all([
    db
      .select({
        totalScans: count(),
        threatsBlocked: sql<number>`count(*) filter (where verdict = 'malicious')`,
        safeLinks: sql<number>`count(*) filter (where verdict = 'safe')`,
        suspiciousLinks: sql<number>`count(*) filter (where verdict = 'suspicious')`,
        avgRiskScore: avg(scansTable.riskScore),
      })
      .from(scansTable),
    db
      .select({ count: count() })
      .from(scansTable)
      .where(gte(scansTable.createdAt, today)),
    db
      .select({ threatCategory: scansTable.threatCategory, count: count() })
      .from(scansTable)
      .where(sql`threat_category is not null`)
      .groupBy(scansTable.threatCategory)
      .orderBy(desc(count()))
      .limit(1),
  ]);

  const row = totals[0];

  res.json({
    totalScans: Number(row?.totalScans ?? 0),
    threatsBlocked: Number(row?.threatsBlocked ?? 0),
    safeLinks: Number(row?.safeLinks ?? 0),
    suspiciousLinks: Number(row?.suspiciousLinks ?? 0),
    avgRiskScore: parseFloat((row?.avgRiskScore ?? "0").toString()),
    scansTodayCount: Number(todayCount[0]?.count ?? 0),
    topThreatCategory: topThreat[0]?.threatCategory ?? null,
  });
});

router.get("/stats/threats", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      category: scansTable.threatCategory,
      count: count(),
    })
    .from(scansTable)
    .where(sql`threat_category is not null`)
    .groupBy(scansTable.threatCategory)
    .orderBy(desc(count()))
    .limit(10);

  res.json(
    rows.map((r) => ({
      category: r.category ?? "Unknown",
      count: Number(r.count),
    })),
  );
});

router.get("/stats/timeline", async (req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE verdict != 'safe') as threats
    FROM scans
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);

  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];

  res.json(
    (rows as { date: string; total: string | number; threats: string | number }[]).map((r) => ({
      date: String(r.date),
      total: Number(r.total),
      threats: Number(r.threats),
    })),
  );
});

export default router;
