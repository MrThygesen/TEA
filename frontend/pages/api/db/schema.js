// pages/api/db/schema.js
import { pool } from '../../../lib/postgres.js'

export default async function handler(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `)

    // Group by table name
    const schema = rows.reduce((acc, row) => {
      if (!acc[row.table_name]) acc[row.table_name] = []
      acc[row.table_name].push({
        column: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable,
        default: row.column_default,
      })
      return acc
    }, {})

    res.status(200).json({ schema })
  } catch (err) {
    console.error('❌ Schema fetch error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

