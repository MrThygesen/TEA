// pages/api/update-user.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  const { username, email } = req.body

  try {
    const result = await pool.query(
      `UPDATE user_profiles
       SET telegram_username=$1, email=$2, updated_at=NOW()
       WHERE telegram_username=$1
       RETURNING telegram_user_id, telegram_username, email, role`,
      [username, email]
    )

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' })
    res.status(200).json({ user: result.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Update failed', details: err.message })
  }
}

