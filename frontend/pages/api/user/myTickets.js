
import { pool } from '../../../lib/postgres.js'
import { getUserFromJWT } from '../../../lib/auth.js'

export default async function handler(req, res) {
  const user = getUserFromJWT(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { rows } = await pool.query(`
      SELECT * FROM tickets
      WHERE user_id = $1 AND has_paid = true
    `, [user.id])

    res.json({ tickets: rows })
  } catch (err) {
    console.error('myTickets error:', err)
    res.status(500).json({ error: 'Database error' })
  }
}

