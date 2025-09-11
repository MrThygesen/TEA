import { pool } from '../../lib/postgres.js'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  const { token } = req.query
  if (!token) return res.status(400).json({ error: 'Token is required' })

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.role, t.expires_at
       FROM users u
       JOIN email_verification_tokens t ON t.user_id = u.id
       WHERE t.token = $1`,
      [token]
    )
    const row = result.rows[0]
    if (!row) return res.status(400).json({ error: 'Invalid token' })

    if (new Date() > row.expires_at) {
      return res.status(400).json({ error: 'Token expired' })
    }

    // Mark user as verified
    await pool.query(`UPDATE users SET is_verified=true WHERE id=$1`, [row.id])
    await pool.query(`DELETE FROM email_verification_tokens WHERE user_id=$1`, [row.id])

    // Sign JWT
    const payload = { id: row.id, email: row.email, username: row.username, role: row.role }
    const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.status(200).json({ token: jwtToken, user: payload })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Email verification failed' })
  }
}

