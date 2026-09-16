import { Router } from "express";
import { db, scansTable } from "@workspace/db";
import { sql, count, avg, gte, desc, eq, and } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rawDeviceId = typeof req.query.deviceId === "string" ? req.query.deviceId.trim() : undefined;
    const deviceId = rawDeviceId && rawDeviceId !== "" && rawDeviceId !== "all" ? rawDeviceId : undefined;
    const deviceCondition = deviceId ? eq(scansTable.deviceId, deviceId) : undefined;

    const totalsBase = db
      .select({
        totalScans: count(),
        threatsBlocked: sql<number>`count(*) filter (where verdict = 'malicious')`,
        safeLinks: sql<number>`count(*) filter (where verdict = 'safe')`,
        suspiciousLinks: sql<number>`count(*) filter (where verdict = 'suspicious')`,
        mobileScans: sql<number>`count(*) filter (where trigger_type in ('link', 'camera'))`,
        webScans: sql<number>`count(*) filter (where trigger_type = 'manual' or trigger_type is null or trigger_type = '')`,
        activeDevicesCount: sql<number>`count(distinct device_id) filter (where device_id is not null)`,
        avgRiskScore: avg(scansTable.riskScore),
      })
      .from(scansTable);

    const totalsQuery = deviceCondition ? totalsBase.where(deviceCondition) : totalsBase;

    const todayConditions = [gte(scansTable.createdAt, today)];
    if (deviceCondition) {
      todayConditions.push(deviceCondition);
    }
    const todayQuery = db
      .select({ count: count() })
      .from(scansTable)
      .where(todayConditions.length > 1 ? and(...todayConditions) : todayConditions[0]);

    const threatConditions = [sql`threat_category is not null`];
    if (deviceCondition) {
      threatConditions.push(deviceCondition);
    }
    const topThreatQuery = db
      .select({ threatCategory: scansTable.threatCategory, count: count() })
      .from(scansTable)
      .where(threatConditions.length > 1 ? and(...threatConditions) : threatConditions[0])
      .groupBy(scansTable.threatCategory)
      .orderBy(desc(count()))
      .limit(1);

    const [totals, todayCount, topThreat] = await Promise.all([
      totalsQuery,
      todayQuery,
      topThreatQuery,
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
    const rawDeviceId = typeof req.query.deviceId === "string" ? req.query.deviceId.trim() : undefined;
    const deviceId = rawDeviceId && rawDeviceId !== "" && rawDeviceId !== "all" ? rawDeviceId : undefined;

    const conditions = [sql`threat_category is not null`];
    if (deviceId) {
      conditions.push(eq(scansTable.deviceId, deviceId));
    }

    const rows = await db
      .select({
        category: scansTable.threatCategory,
        count: count(),
      })
      .from(scansTable)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
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
    const rawDeviceId = typeof req.query.deviceId === "string" ? req.query.deviceId.trim() : undefined;
    const deviceId = rawDeviceId && rawDeviceId !== "" && rawDeviceId !== "all" ? rawDeviceId : undefined;

    const deviceFilter = deviceId ? sql` AND device_id = ${deviceId}` : sql``;

    const result = await db.execute(sql`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM-DD') as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE verdict != 'safe') as threats
      FROM scans
      WHERE created_at >= NOW() - INTERVAL '7 days' ${deviceFilter}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
      ORDER BY date ASC
    `);

    const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
    const countsByDate = new Map<string, { total: number; threats: number }>();

    for (const r of rows as any[]) {
      const dateKey = String(r.date).slice(0, 10);
      countsByDate.set(dateKey, {
        total: Number(r.total || 0),
        threats: Number(r.threats || 0),
      });
    }

    // Build complete 7-day series ending today
    const timeline = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const existing = countsByDate.get(dateKey) || { total: 0, threats: 0 };
      timeline.push({
        date: dateKey,
        total: existing.total,
        threats: existing.threats,
      });
    }

    res.json(timeline);
  } catch (error: any) {
    res.status(500).json({ error: error.message, items: [] });
  }
});

export default router;