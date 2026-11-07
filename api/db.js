// Database pool. Works against any Postgres via DATABASE_URL
// (Neon, Supabase Postgres, or a local Postgres).
// Neon and Supabase both require SSL.
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set. See ../.env.example');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => console.error('Unexpected pool error:', err.message));

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
