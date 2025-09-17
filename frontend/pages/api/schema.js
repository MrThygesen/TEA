// schema.js
import pkg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool } = pkg

async function showSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // important for Render
  })

  try {
    console.log('🔍 Fetching schema info...')

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

    // Group by table name
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

    console.log(JSON.stringify(schema, null, 2))
  } catch (err) {
    console.error('❌ Error fetching schema:', err)
  } finally {
    await pool.end()
  }
}

showSchema()

