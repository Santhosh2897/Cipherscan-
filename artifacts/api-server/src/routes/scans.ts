import { Router } from "express";
import { db } from "@workspace/db";
import { scans } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

const router = Router();

// GET /api/scans — Lists recent scans without heavy screenshot payloads
router.get("/", async (_req, res) => {
  try {
    const results = await db
      .select({
        id: scans.id,
        targetUrl: scans.targetUrl,
        finalUrl: scans.finalUrl,
        verdict: scans.verdict,
        riskScore: scans.riskScore,
        threatTypes: scans.threatTypes,
        threatReasons: scans.threatReasons,
        redirectChain: scans.redirectChain,
        domainReputation: scans.domainReputation,
        createdAt: scans.createdAt
      })
      .from(scans)
      .orderBy(desc(scans.createdAt))
      .limit(50);

    return res.json({ scans: results });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/scans/:id — Returns complete scan data including screenshot
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [scan] = await db.select().from(scans).where(eq(scans.id, id)).limit(1);

    if (!scan) {
      return res.status(404).json({ error: "Scan not found" });
    }

    return res.json(scan);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;