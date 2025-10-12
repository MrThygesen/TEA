import pkg from 'pg'
import dotenv from 'dotenv'
dotenv.config()
const { Pool } = pkg

import { auth } from '../../../lib/auth.js'
import { sendVerificationEmail } from '../../../lib/email.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    const token = auth.getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    let payload
    try {
      payload = auth.verifyToken(token)
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const { email: newEmail } = req.body
    if (!newEmail) return res.status(400).json({ error: 'Missing newEmail' })

    // Update main profile: set email and mark as unverified
    const result = await pool.query(
      `UPDATE user_profiles 
       SET email = $1, email_verified = FALSE, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, email, email_verified, updated_at`,
      [newEmail, payload.id]
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
      [payload.id, newEmail]
    )

    // Create verification token (same behavior as register.js / login flow)
    const crypto = await import('crypto')
    const verificationToken = crypto.randomBytes(32).toString('hex')

    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at, email)
       VALUES ($1, $2, NOW() + interval '1 day', $3)
       ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token,
                                          expires_at = EXCLUDED.expires_at,
                                          email = EXCLUDED.email`,
      [payload.id, verificationToken, newEmail]
    )

    // Send verification email
    await sendVerificationEmail(newEmail, verificationToken)

    res.status(200).json({
      success: true,
      message: 'Email updated. Verification sent to the new address.',
      user: result.rows[0],
    })
  } catch (err) {
    console.error('❌ Update email error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  } finally {
    await pool.end()
  }
}

