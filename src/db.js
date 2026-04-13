const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
});

async function ensureDatabase() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitor_counts (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_visits BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ
    )
  `);

  await pool.query(`
    INSERT INTO visitor_counts (id, total_visits, updated_at)
    VALUES (1, 0, NULL)
    ON CONFLICT (id) DO NOTHING
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_identities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (provider, provider_user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      csrf_token_hash TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE refresh_tokens
    ADD COLUMN IF NOT EXISTS csrf_token_hash TEXT
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
    ON refresh_tokens (user_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, type, target_type, target_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorite_teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      league TEXT NOT NULL,
      team_id TEXT NOT NULL,
      team_name TEXT NOT NULL,
      team_logo TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, league, team_id)
    )
  `);
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  ensureDatabase,
  closePool,
};
