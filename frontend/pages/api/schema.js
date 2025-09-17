// pages/api/schema.js
import pkg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool } = pkg

export default async function handler(req, res) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    const query = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `
    const { rows } = await pool.query(query)

    const schema = {}
    rows.forEach(row => {
      if (!schema[row.table_name]) schema[row.table_name] = []
      schema[row.table_name].push({
        column: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable,
        default: row.column_default,
      })
    })

    res.status(200).json(schema)
  } catch (err) {
    console.error('❌ Error fetching schema:', err)
    res.status(500).json({ error: 'Failed to fetch schema' })
  } finally {
    await pool.end()
  }
}

