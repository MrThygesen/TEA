// pages/api/register.js
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { pool } from '../../lib/postgres.js'
import { sendVerificationEmail } from '../../lib/email.js'

export default async function handler(req, res) {
  console.log('Register API called')  // log API hit

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method)
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const { email, password } = req.body
  console.log('Request body:', req.body)

  if (!email || !password) {
    console.log('Missing email or password')
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  try {
    // Hash password
    console.log('Hashing password...')
    const hashedPassword = await bcrypt.hash(password, 10)
    console.log('Password hashed')

    // Insert user
    console.log('Inserting user into database...')
    const result = await pool.query(
      `INSERT INTO user_profiles (email, password_hash, email_verified)
       VALUES ($1, $2, FALSE)
       RETURNING id, email, role, tier`,
      [email, hashedPassword]
    )
    console.log('DB insert result:', result.rows)

    const user = result.rows[0]

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex')
    console.log('Generating email verification token:', token)

    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + interval '1 day')`,
      [user.id, token]
    )
    console.log('Verification token saved to DB')

    const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/verify-email?token=${token}`
    console.log('Sending verification email to:', email, 'URL:', verifyUrl)

    await sendVerificationEmail(email, verifyUrl)
    console.log('Verification email sent successfully')

    return res.status(201).json({
      user,
      message: 'Registration successful. Please check your email to verify your account.',
    })
  } catch (err) {
    console.error('Registration error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

