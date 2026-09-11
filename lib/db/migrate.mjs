import pg from 'pg';

const client = new pg.Client(process.env.DATABASE_URL);
await client.connect();
console.log('Connected to Neon DB ✅');

const sql = `
  ALTER TABLE scans
    ADD COLUMN IF NOT EXISTS device_id TEXT,
    ADD COLUMN IF NOT EXISTS device_name TEXT,
    ADD COLUMN IF NOT EXISTS virus_total_score INTEGER,
    ADD COLUMN IF NOT EXISTS google_safe_browsing BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS trigger_type TEXT NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS preview_image_url TEXT;
`;

try {
  await client.query(sql);
  console.log('✅ Migration complete — all missing columns added!');
} catch (err) {
  console.error('❌ Migration error:', err.message);
} finally {
  await client.end();
}
