import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { pool } from '../../lib/postgres.js'
import { sendVerificationEmail } from '../../lib/email.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const { email, username, password } = req.body

  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    const userResult = await pool.query(
      `INSERT INTO users (email, username, password_hash) 
       VALUES ($1,$2,$3) RETURNING id,email,username`,
      [email, username, hashedPassword]
    )
    const user = userResult.rows[0]

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)`,
      [user.id, token, expiresAt]
    )

    await sendVerificationEmail(email, token)

    res.status(201).json({ message: 'Verification email sent' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Registration failed' })
  }
}

