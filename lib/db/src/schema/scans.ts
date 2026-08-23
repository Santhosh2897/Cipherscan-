import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scansTable = pgTable("scans", {
  id: serial("id").primaryKey(),
  originalUrl: text("original_url").notNull(),
  finalUrl: text("final_url").notNull(),
  isSafe: boolean("is_safe").notNull(),
  riskScore: integer("risk_score").notNull().default(0),
  verdict: text("verdict").notNull().default("safe"), // safe | suspicious | malicious
  threatCategory: text("threat_category"),
  redirectChain: text("redirect_chain").notNull().default("[]"), // JSON string[]
  reasons: text("reasons").notNull().default("[]"), // JSON string[]
  previewImageUrl: text("preview_image_url"),
  triggerType: text("trigger_type").notNull().default("manual"), // camera | link | manual
  virusTotalScore: integer("virus_total_score"),
  googleSafeBrowsing: boolean("google_safe_browsing").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScanSchema = createInsertSchema(scansTable).omit({ id: true, createdAt: true });
export type InsertScan = z.infer<typeof insertScanSchema>;
export type Scan = typeof scansTable.$inferSelect;
