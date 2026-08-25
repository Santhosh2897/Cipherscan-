import { Router } from "express";
import { db } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

// Direct table definition reference to ensure runtime independence
const scans = pgTable("scans", {
  id: text("id").primaryKey(),
  targetUrl: text("target_url").notNull(),
  finalUrl: text("final_url"),
  verdict: text("verdict").notNull(),
  riskScore: integer("risk_score").notNull(),
  threatTypes: jsonb("threat_types").$type<string[]>(),
  threatReasons: jsonb("threat_reasons").$type<string[]>(),
  redirectChain: jsonb("redirect_chain").$type<string[]>(),
  domainReputation: jsonb("domain_reputation"),
  screenshotBase64: text("screenshot_base64"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

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