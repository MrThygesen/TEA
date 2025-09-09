// pages/api/register.js
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { pool } from '../../lib/postgres.js'
import { sendVerificationEmail } from '../../lib/email.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const { email, password, username } = req.body
  console.log('Register request body:', req.body)

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  try {
    console.log('Hashing password...')
    const hashedPassword = await bcrypt.hash(password, 10)
    console.log('Password hashed.')

    console.log('Inserting user into database...')
    const result = await pool.query(
      `INSERT INTO user_profiles (email, password_hash, telegram_user_id, telegram_username, email_verified)
       VALUES ($1, $2, NULL, NULL, FALSE)
       RETURNING id, email, role, tier`,
      [email, hashedPassword]
    )
    console.log('User inserted:', result.rows[0])

    const user = result.rows[0]

    console.log('Generating verification token...')
    const token = crypto.randomBytes(32).toString('hex')
    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + interval '1 day')`,
      [user.id, token]
    )
    console.log('Token inserted.')

    const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/verify-email?token=${token}`
    console.log('Sending verification email to:', email)
    await sendVerificationEmail(email, verifyUrl)
    console.log('Email sent.')

    return res.status(201).json({
      user,
      message: 'Registration successful. Please check your email to verify your account.',
    })
  } catch (err) {
    console.error('Registration error:', err)
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already registered' })
    }
    return res.status(500).json({ error: 'Internal server error' })
  }
}

