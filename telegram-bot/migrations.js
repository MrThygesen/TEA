// scripts/migrations.js
import pkg from 'pg'
import dotenv from 'dotenv'
dotenv.config()
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function runMigrations() {
  console.log('🔹 Running migrations...')

  try {
    // Ensure stage column exists in registrations
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='registrations' AND column_name='stage'
        ) THEN
          ALTER TABLE registrations
          ADD COLUMN stage TEXT CHECK (stage IN ('prebook','book')) DEFAULT 'prebook';
        END IF;
      END
      $$;
    `)

    console.log('✅ Migrations applied successfully.')
  } catch (err) {
    console.error('❌ Migration error:', err)
    throw err
  }
}

