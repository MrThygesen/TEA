// lib/sendEmailVerification.js
import crypto from 'crypto'
import { pool } from './postgres.js'
import SibApiV3Sdk from '@getbrevo/brevo'

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()
apiInstance.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
)

export async function sendEmailVerification(userId, email) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1h

  // Clean old token for same user
  await pool.query(`DELETE FROM email_verification_tokens WHERE user_id=$1`, [userId])

  // Insert fresh token
  await pool.query(
    `INSERT INTO email_verification_tokens (token, user_id, email, expires_at)
     VALUES ($1,$2,$3,$4)`,
    [token, userId, email, expiresAt]
  )

  const verifyUrl = `${process.env.FRONTEND_URL}/api/confirm-email?token=${token}`

  const emailData = {
    to: [{ email }],
    sender: { email: 'no-reply@tea-events.com', name: 'TEA Events' },
    subject: 'Verify your email',
    htmlContent: `
      <p>Hello,</p>
      <p>Please verify your email for TEA Events.</p>
      <p><a href="${verifyUrl}">Click here to confirm</a></p>
      <p>This link expires in 1 hour.</p>
    `,
  }

  await apiInstance.sendTransacEmail(emailData)
  console.log(`📧 Verification email sent to ${email}`)
}

