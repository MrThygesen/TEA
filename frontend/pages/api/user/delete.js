// pages/api/user/delete.js
import pkg from 'pg'
import dotenv from 'dotenv'
dotenv.config()
const { Pool } = pkg

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

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
    console.error('❌ Delete user error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  } finally {
    await pool.end()
  }
}

