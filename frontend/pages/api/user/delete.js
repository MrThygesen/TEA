// pages/api/user/delete.js
import { sql, pool } from '../../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId } = req.body
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' })
  }

  try {
    const result = await pool.query(
      `DELETE FROM user_profiles WHERE id = $1 RETURNING id, username, email`,
      [userId]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.status(200).json({
      success: true,
      message: 'User account deleted successfully',
      deletedUser: result.rows[0],
    })
  } catch (err) {
    console.error('❌ delete.js error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  }
}

