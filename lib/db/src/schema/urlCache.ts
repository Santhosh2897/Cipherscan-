import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * url_cache — cross-user shared URL analysis results.
 *
 * When any user scans a URL, the result is cached here (by SHA-256 hash of
 * the normalised URL). Subsequent scans by any user get an instant result
 * without re-running the expensive Playwright sandbox + reputation APIs.
 *
 * Privacy: The url_hash is a one-way SHA-256 of the normalised URL, so
 * no plaintext URL leaks into the community intelligence pool.
 */
export const urlCacheTable = pgTable("url_cache", {
  /** SHA-256 hex digest of the normalised URL */
  urlHash: text("url_hash").primaryKey(),

  /** Original URL stored for returning the full result */
  originalUrl: text("original_url").notNull(),

  /** Resolved final URL after redirects */
  finalUrl: text("final_url").notNull(),

  /** Verdict: safe | suspicious | malicious */
  verdict: text("verdict").notNull(),

  riskScore: integer("risk_score").notNull().default(0),
  threatCategory: text("threat_category"),

  /** JSON-encoded string[] */
  redirectChain: text("redirect_chain").notNull().default("[]"),
  reasons: text("reasons").notNull().default("[]"),
  previewImageUrl: text("preview_image_url"),
  virusTotalScore: integer("virus_total_score"),

  /** Number of distinct user scans that hit this URL */
  scanCount: integer("scan_count").notNull().default(1),

  /**
   * Number of community threat reports on this URL.
   * Incremented via POST /api/community/report.
   */
  communityFlags: integer("community_flags").notNull().default(0),

  firstSeen: timestamp("first_seen").defaultNow().notNull(),
  lastScanned: timestamp("last_scanned").defaultNow().notNull(),

  /** Cache invalidation timestamp — null means permanent */
  expiresAt: timestamp("expires_at").notNull(),
});

export type UrlCache = typeof urlCacheTable.$inferSelect;
export type InsertUrlCache = typeof urlCacheTable.$inferInsert;
