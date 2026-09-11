import pg from 'pg';

const client = new pg.Client(process.env.DATABASE_URL);
await client.connect();
console.log('Connected to Neon DB ✅');

const sql = `
  -- url_cache: cross-user shared URL analysis cache
  CREATE TABLE IF NOT EXISTS url_cache (
    url_hash        TEXT PRIMARY KEY,
    original_url    TEXT NOT NULL,
    final_url       TEXT NOT NULL,
    verdict         TEXT NOT NULL,
    risk_score      INTEGER NOT NULL DEFAULT 0,
    threat_category TEXT,
    redirect_chain  TEXT NOT NULL DEFAULT '[]',
    reasons         TEXT NOT NULL DEFAULT '[]',
    preview_image_url TEXT,
    virus_total_score INTEGER,
    scan_count      INTEGER NOT NULL DEFAULT 1,
    community_flags INTEGER NOT NULL DEFAULT 0,
    first_seen      TIMESTAMP NOT NULL DEFAULT NOW(),
    last_scanned    TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMP NOT NULL
  );

  -- user_domain_patterns: per-device domain frequency learning
  CREATE TABLE IF NOT EXISTS user_domain_patterns (
    device_id   TEXT NOT NULL,
    domain      TEXT NOT NULL,
    scan_count  INTEGER NOT NULL DEFAULT 1,
    last_seen   TIMESTAMP NOT NULL DEFAULT NOW(),
    is_trusted  BOOLEAN NOT NULL DEFAULT false,
    is_blocked  BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (device_id, domain)
  );

  -- community_reports: user-submitted threat flags
  CREATE TABLE IF NOT EXISTS community_reports (
    id               TEXT PRIMARY KEY,
    url_hash         TEXT NOT NULL,
    device_id_hash   TEXT NOT NULL,
    reported_verdict TEXT NOT NULL,
    reported_at      TIMESTAMP NOT NULL DEFAULT NOW()
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_url_cache_expires   ON url_cache (expires_at);
  CREATE INDEX IF NOT EXISTS idx_url_cache_verdict   ON url_cache (verdict);
  CREATE INDEX IF NOT EXISTS idx_udp_device_trusted  ON user_domain_patterns (device_id, is_trusted);
  CREATE INDEX IF NOT EXISTS idx_cr_url_hash         ON community_reports (url_hash);
`;

try {
  await client.query(sql);
  console.log('✅ Migration complete — url_cache, user_domain_patterns, community_reports tables created!');
} catch (err) {
  console.error('❌ Migration error:', err.message);
} finally {
  await client.end();
}
