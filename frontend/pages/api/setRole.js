// pages/api/setRole.js
import { pool } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { telegram_username, role } = req.body
  if (!telegram_username || !role) return res.status(400).json({ error: 'Missing username or role' })

  try {
    const result = await pool.query(
      'UPDATE user_profiles SET role = $1 WHERE telegram_username = $2 RETURNING *',
      [role, telegram_username]
    )
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' })
    res.status(200).json({ success: true, user: result.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Database error', details: err.message })
  }
}

