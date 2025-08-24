// pages/api/users.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await pool.query(`
      SELECT 
        telegram_user_id,
        telegram_username,
        email,
        role,
        group_id,
        created_at,
        updated_at
      FROM user_profiles
      ORDER BY telegram_user_id ASC
    `)

    res.status(200).json({ users: result.rows })
  } catch (err) {
    console.error('[API /users] Error fetching user profiles:', err)
    res.status(500).json({ error: 'Database query failed', details: err.message })
  }
}

