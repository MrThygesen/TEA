// telegram-bot/lib/sendEmailVerification.js
import crypto from 'crypto'
import { pool } from './postgres.js'
import SibApiV3Sdk from '@getbrevo/brevo'

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()
apiInstance.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
)

/**
 * Sends verification email for Telegram bot users
 * @param {number} userId - internal DB user ID
 * @param {string} email - user's email
 */
export async function sendEmailVerification(userId, email) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1h

  // Clean old token for this user
  await pool.query(`DELETE FROM email_verification_tokens WHERE user_id=$1`, [userId])

  // Insert fresh token
  await pool.query(
    `INSERT INTO email_verification_tokens (token, user_id, email, created_at, expires_at)
     VALUES ($1, $2, $3, NOW(), $4)`,
    [token, userId, email, expiresAt]
  )

  // Use Telegram bot server URL, not frontend
  const verifyUrl = `${process.env.PUBLIC_URL}/confirm-email?token=${token}`

  const emailData = {
    to: [{ email }],
    sender: { email: 'no-reply@tea-events.com', name: 'TEA Events' },
    subject: 'Verify your email for TEA Events',
    htmlContent: `
      <p>Hello,</p>
      <p>Please verify your email for TEA Events by clicking the link below:</p>
      <p><a href="${verifyUrl}">✅ Confirm Email</a></p>
      <p>This link expires in 1 hour.</p>
    `,
  }

  await apiInstance.sendTransacEmail(emailData)
  console.log(`📧 Verification email sent to ${email}`)
}

