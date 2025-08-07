import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config() // optional on Vercel, but useful locally

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // for most managed services
  },
})

