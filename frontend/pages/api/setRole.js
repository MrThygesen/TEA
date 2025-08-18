// pages/api/setRole.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  const { method, body } = req

  if (method === 'POST') {
    const { telegram_username, role } = body
    if (!telegram_username || !role) {
      return res.status(400).json({ error: 'Missing username or role' })
    }

    try {
      const result = await pool.query(
        `UPDATE user_profiles
         SET role = $1, updated_at = CURRENT_TIMESTAMP
         WHERE telegram_username = $2
         RETURNING *`,
        [role, telegram_username]
      )

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User not found for role update' })
      }

      console.log('[POST] Role updated:', result.rows[0])
      return res.status(200).json(result.rows[0])
    } catch (err) {
      console.error('[POST] Error updating role:', err)
      return res.status(500).json({ error: 'Failed to update role', details: err.message })
    }
  }

  if (method === 'GET') {
    try {
      const result = await pool.query(
        'SELECT telegram_user_id, telegram_username, role FROM user_profiles ORDER BY telegram_username ASC'
      )
      console.log('[GET] Users fetched:', result.rows.length)
      return res.status(200).json(result.rows)
    } catch (err) {
      console.error('[GET] Error fetching users:', err)
      return res.status(500).json({ error: 'Failed to fetch users', details: err.message })
    }
  }

  return res.status(405).json({ error: `Method ${method} Not Allowed` })
}

