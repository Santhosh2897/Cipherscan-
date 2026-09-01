import { Router } from "express";
import { db, scansTable } from "@workspace/db";
import { sql, count, avg, gte, desc } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totals, todayCount, topThreat] = await Promise.all([
      db
        .select({
          totalScans: count(),
          threatsBlocked: sql<number>`count(*) filter (where verdict = 'malicious')`,
          safeLinks: sql<number>`count(*) filter (where verdict = 'safe')`,
          suspiciousLinks: sql<number>`count(*) filter (where verdict = 'suspicious')`,
          mobileScans: sql<number>`count(*) filter (where trigger_type in ('link', 'camera'))`,
          webScans: sql<number>`count(*) filter (where trigger_type = 'manual')`,
          activeDevicesCount: sql<number>`count(distinct device_id) filter (where device_id is not null)`,
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
    const avgScore = parseFloat((row?.avgRiskScore ?? "0").toString());
    const securityScore = Math.max(85, Math.min(100, Math.round(100 - avgScore * 0.15)));
    const securityLevel = securityScore >= 90 ? "OPTIMAL" : "HIGH PROTECTION";

    res.json({
      totalScans: Number(row?.totalScans ?? 0),
      threatsBlocked: Number(row?.threatsBlocked ?? 0),
      safeLinks: Number(row?.safeLinks ?? 0),
      suspiciousLinks: Number(row?.suspiciousLinks ?? 0),
      mobileScans: Number(row?.mobileScans ?? 0),
      webScans: Number(row?.webScans ?? 0),
      activeDevicesCount: Number(row?.activeDevicesCount ?? 0),
      avgRiskScore: avgScore,
      scansTodayCount: Number(todayCount[0]?.count ?? 0),
      topThreatCategory: topThreat[0]?.threatCategory ?? null,
      securityScore,
      securityLevel,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
      totalScans: 0,
      threatsBlocked: 0,
      safeLinks: 0,
      suspiciousLinks: 0,
      mobileScans: 0,
      webScans: 0,
      avgRiskScore: 0,
      scansTodayCount: 0,
      topThreatCategory: null,
      securityScore: 98,
      securityLevel: "OPTIMAL",
    });
  }
});

router.get("/stats/threats", async (req, res): Promise<void> => {
  try {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message, items: [] });
  }
});

router.get("/stats/timeline", async (req, res): Promise<void> => {
  try {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message, items: [] });
  }
});

export default router;