// pages/api/setRole.js 
import { pool } from '../../lib/postgres.js'
import { auth } from '../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const token = auth.getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const decoded = auth.verifyToken(token)
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' })

    const { email, telegram_username, telegram_user_id, role, group_id } = req.body
    if (!role) return res.status(400).json({ error: 'Role is required' })
    if (!email && !telegram_username && !telegram_user_id)
      return res.status(400).json({ error: 'Provide email, Telegram username, or user ID' })

    // Build WHERE clause dynamically
    const whereClauses = []
    const values = [role]
    let i = 2

    if (email) {
      whereClauses.push(`email = $${i}`)
      values.push(email)
      i++
    }
    if (telegram_username) {
      whereClauses.push(`username = $${i}`)
      values.push(telegram_username)
      i++
    }
    if (telegram_user_id) {
      whereClauses.push(`id = $${i}`)
      values.push(telegram_user_id)
      i++
    }

    const setClause = group_id ? `role = $1, group_id = ${group_id}` : `role = $1`
    const whereClause = whereClauses.join(' OR ')

    const result = await pool.query(
      `UPDATE user_profiles SET ${setClause} WHERE ${whereClause} RETURNING *`,
      values
    )

    if (result.rowCount === 0)
      return res.status(404).json({ error: 'No user found with provided identifier(s)' })

    return res.status(200).json({ success: true, updated: result.rows })
  } catch (err) {
    console.error('[setRole] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

