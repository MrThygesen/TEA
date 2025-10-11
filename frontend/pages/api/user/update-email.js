// pages/api/user/update-email.js
import pkg from 'pg'
import dotenv from 'dotenv'
dotenv.config()
const { Pool } = pkg

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  const { userId, newEmail } = req.body

  if (!userId || !newEmail) {
    return res.status(400).json({ error: 'Missing userId or newEmail' })
  }

  try {
    // Update main profile
    const result = await pool.query(
      `UPDATE user_profiles 
       SET email = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, email, email_verified, updated_at`,
      [newEmail, userId]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Upsert into user_emails table
    await pool.query(
      `INSERT INTO user_emails (user_id, email, subscribed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET email = EXCLUDED.email, subscribed_at = NOW()`,
      [userId, newEmail]
    )

    res.status(200).json({
      success: true,
      message: 'Email updated successfully',
      user: result.rows[0],
    })
  } catch (err) {
    console.error('❌ Update email error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  } finally {
    await pool.end()
  }
}

