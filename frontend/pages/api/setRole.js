// pages/api/setRole.js
import { pool } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let { telegram_username, role } = req.body
  if (!telegram_username || !role) return res.status(400).json({ error: 'Missing username or role' })

  // Remove leading @ if present
  telegram_username = telegram_username.replace(/^@/, '').toLowerCase()

  try {
    const result = await pool.query(
      `UPDATE user_profiles
       SET role = $1, updated_at = NOW()
       WHERE LOWER(telegram_username) = $2
       RETURNING *`,
      [role, telegram_username]
    )

    if (result.rowCount === 0) {
      // User not in DB yet – optionally insert as pending
      const insert = await pool.query(
        `INSERT INTO user_profiles (telegram_username, role)
         VALUES ($1, $2)
         RETURNING *`,
        [telegram_username, role]
      )
      return res.status(201).json({ success: true, user: insert.rows[0], message: 'User added as pending' })
    }

    res.status(200).json({ success: true, user: result.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Database error', details: err.message })
  }
}

