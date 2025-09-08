// telegram-bot/email-optin.js
// telegram-bot/email-optin1.js
import crypto from 'crypto'
import pkg from 'pg'
import dotenv from 'dotenv'
import Brevo from '@getbrevo/brevo'

dotenv.config()
const { Pool } = pkg

// ==== CONFIG ====
const brevo = new Brevo.TransactionalEmailsApi()
brevo.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@teanet.xyz'
const PUBLIC_URL =
  process.env.FRONTEND_URL ||
  process.env.PUBLIC_URL ||
  'https://edgy-dpnv.onrender.com'

// ==== HELPER: EMAIL CHECK ====
export function isLikelyEmail(s) {
  return typeof s === 'string' && s.includes('@') && s.includes('.')
}

// ==== GENERATE TOKEN ====
export function generateEmailToken() {
  return crypto.randomBytes(20).toString('hex') // 40-character token
}

// ==== SEND VERIFICATION EMAIL ====
export async function sendEmailVerification(tgId, email) {
  const token = generateEmailToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

  await pool.query(
    `INSERT INTO email_verification_tokens (telegram_user_id, email, token, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telegram_user_id)
     DO UPDATE SET email = EXCLUDED.email, token = EXCLUDED.token, expires_at = EXCLUDED.expires_at`,
    [tgId, email, token, expiresAt]
  )

  const verificationUrl = `${PUBLIC_URL}/verify-email?tgId=${tgId}&token=${token}`

  const sendSmtpEmail = {
    sender: { email: FROM_EMAIL, name: 'EDGY EVENTS' },
    to: [{ email }],
    subject: 'Confirm your email',
    htmlContent: `
      <p>Hi!</p>
      <p>Please confirm your email by clicking the link below:</p>
      <p><a href="${verificationUrl}">Confirm Email</a></p>
      <p>This link will expire in 24 hours.</p>
    `,
  }

  await brevo.sendTransacEmail(sendSmtpEmail)
  console.log(`📧 Verification email sent to ${email}`)
  return token
}

// ==== SEND EVENT CONFIRMATION EMAIL ====
export async function sendEventConfirmed(eventId, eventName, eventCity, eventDateTime) {
  try {
    const res = await pool.query(
      `SELECT email, telegram_username
       FROM registrations
       WHERE event_id=$1 AND email IS NOT NULL`,
      [eventId]
    )

    const attendees = res.rows
    if (!attendees.length) return

    await Promise.all(
      attendees.map(async (attendee) => {
        const sendSmtpEmail = {
          sender: { email: FROM_EMAIL, name: 'EDGY EVENTS' },
          to: [{ email: attendee.email }],
          subject: `Event Confirmed: ${eventName}`,
          htmlContent: `
            <p>Hi ${attendee.telegram_username || ''},</p>
            <p>Your event "<strong>${eventName}</strong>" is now confirmed! 🎉</p>
            <p><strong>Date/Time:</strong> ${eventDateTime || 'TBA'}</p>
            <p><strong>City:</strong> ${eventCity || 'TBA'}</p>
            <p>See you there!</p>
          `,
        }
        await brevo.sendTransacEmail(sendSmtpEmail)
      })
    )

    console.log(`📧 Event confirmation sent to ${attendees.length} attendees`)
  } catch (err) {
    console.error('❌ Failed to send event confirmation email', err)
  }
}

// ==== OPTIONAL: SEND PAYMENT CONFIRMATION EMAIL ====
export async function sendPaymentConfirmed(eventId, eventName, tgId) {
  try {
    const res = await pool.query(
      `SELECT email, telegram_username
       FROM registrations r
       JOIN user_profiles u ON u.id=r.user_id
       WHERE r.event_id=$1 AND u.telegram_user_id=$2 AND r.email IS NOT NULL`,
      [eventId, tgId]
    )

    if (!res.rows.length) return
    const attendee = res.rows[0]

    const sendSmtpEmail = {
      sender: { email: FROM_EMAIL, name: 'EDGY EVENTS' },
      to: [{ email: attendee.email }],
      subject: `Payment Confirmed: ${eventName}`,
      htmlContent: `
        <p>Hi ${attendee.telegram_username || ''},</p>
        <p>We have received your payment for the event "<strong>${eventName}</strong>". ✅</p>
        <p>Thank you! See you at the event.</p>
      `,
    }

    await brevo.sendTransacEmail(sendSmtpEmail)
    console.log(`📧 Payment confirmation sent to ${attendee.email}`)
  } catch (err) {
    console.error('❌ Failed to send payment confirmation email', err)
  }
}

