// pages/api/setRole.js
import { pool } from '../../lib/postgres.js'
import { auth } from '../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const token = auth.getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const decoded = auth.verifyToken(token)
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' })
}

const decoded = auth.verifyToken(token)
if (!decoded || decoded.role !== 'admin') {
  return res.status(403).json({ error: 'Forbidden: only admins can set roles' })



    const { telegram_username, telegram_user_id, email, group_id, role } = req.body
    if (!role) return res.status(400).json({ error: 'Role is required' })

    const result = await pool.query(
      `INSERT INTO roles (telegram_username, telegram_user_id, email, group_id, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email, group_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [telegram_username || null, telegram_user_id || null, email || null, group_id || null, role]
    )

    return res.status(200).json({ success: true, role: result.rows[0] })
  } catch (err) {
    console.error('[setRole] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

