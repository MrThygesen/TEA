// /pages/api/setRole.js
import { pool } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { telegram_username, telegram_user_id, role } = req.body
  if (!role || (!telegram_username && !telegram_user_id)) 
    return res.status(400).json({ error: 'Missing identifier or role' })

  try {
    const result = await pool.query(
      `UPDATE user_profiles 
       SET role = $1, updated_at = NOW()
       WHERE telegram_username = COALESCE($2, telegram_username)
          OR telegram_user_id = COALESCE($3, telegram_user_id)
       RETURNING *`,
      [role, telegram_username || null, telegram_user_id || null]
    )

    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' })
    res.status(200).json({ success: true, user: result.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Database error', details: err.message })
  }
}

