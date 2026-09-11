import { pgTable, text, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";

/**
 * user_domain_patterns — per-device domain frequency learning.
 *
 * The backend tracks which domains each device scans frequently. After
 * a threshold (default 10 safe scans), the domain is auto-whitelisted for
 * that device and future scans return instant SAFE without re-scanning.
 *
 * Privacy: This table is keyed by device_id (a UUID generated on device),
 * which is never tied to any personal identity.
 */
export const userDomainPatternsTable = pgTable(
  "user_domain_patterns",
  {
    deviceId: text("device_id").notNull(),
    domain: text("domain").notNull(),

    /** Total number of times this device has scanned this domain */
    scanCount: integer("scan_count").notNull().default(1),

    lastSeen: timestamp("last_seen").defaultNow().notNull(),

    /**
     * true = backend auto-whitelisted this domain for this device.
     * Instant SAFE result on next scan without hitting APIs.
     */
    isTrusted: boolean("is_trusted").notNull().default(false),

    /**
     * If true, the user manually revoked trust for this domain.
     * Takes precedence over isTrusted.
     */
    isBlocked: boolean("is_blocked").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.deviceId, table.domain] })],
);

export type UserDomainPattern = typeof userDomainPatternsTable.$inferSelect;
export type InsertUserDomainPattern = typeof userDomainPatternsTable.$inferInsert;

/**
 * community_reports — user-submitted threat flags for URLs.
 *
 * When a user taps "Report as Threat" on a scan result, an entry is
 * inserted here and the corresponding url_cache.community_flags counter
 * is incremented atomically.
 *
 * Privacy: device_id and url_hash only — no plaintext URL or personal data.
 */
export const communityReportsTable = pgTable("community_reports", {
  id: text("id").primaryKey(), // nanoid
  urlHash: text("url_hash").notNull(),
  deviceIdHash: text("device_id_hash").notNull(), // one-way SHA-256 of device_id
  reportedVerdict: text("reported_verdict").notNull(), // what the user claims it is
  reportedAt: timestamp("reported_at").defaultNow().notNull(),
});

export type CommunityReport = typeof communityReportsTable.$inferSelect;
export type InsertCommunityReport = typeof communityReportsTable.$inferInsert;
