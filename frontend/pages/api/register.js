// pages/api/register.js
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { pool } = require('../../lib/postgres.js')
const { sendVerificationEmail } = require('../../lib/email.js')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })

  const { email, password, username } = req.body
  if (!email || !password || !username)
    return res.status(400).json({ error: 'Email, username and password required' })

  try {
    console.log('🔹 Registration started for:', email)

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Insert user
    const result = await pool.query(
      `INSERT INTO user_profiles (email, password_hash, username, email_verified)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, username, role, tier`,
      [email, hashedPassword, username]
    )

    if (!result.rows.length)
      return res.status(400).json({ error: 'Email already registered' })

    const user = result.rows[0]
    console.log('✅ User inserted:', user)

    // Create verification token
    const token = crypto.randomBytes(32).toString('hex')
    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at, email)
       VALUES ($1, $2, NOW() + interval '1 day', $3)
       ON CONFLICT (user_id) 
       DO UPDATE SET token = EXCLUDED.token,
                     expires_at = EXCLUDED.expires_at,
                     email = EXCLUDED.email`,
      [user.id, token, email]
    )
    console.log('✅ Verification token created for user_id:', user.id)

    // Send email (fail gracefully)
    const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/confirm-email?token=${token}`
    try {
      await sendVerificationEmail(email, verifyUrl)
    } catch (e) {
      console.warn('⚠️ Email failed, but user created:', e.message)
    }

    return res.status(201).json({
      user,
      message: '✅ Registration successful. Please check your email to verify your account.',
    })
  } catch (err) {
    console.error('❌ Registration error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

