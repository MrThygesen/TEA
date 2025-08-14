// telegram-bot/postgres.js
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.DATABASE_URL) {
  throw new Error('❌ DATABASE_URL not defined in environment variables')
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

pool.on('connect', () => {
  console.log('✅ Connected to Postgres database')
})

pool.on('error', (err) => {
  console.error('❌ Postgres pool error:', err)
})

