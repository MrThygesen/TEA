// lib/email.js
const SibApiV3Sdk = require('@getbrevo/brevo')

// Initialize Brevo API
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()
apiInstance.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
)

/**
 * Send email verification to a new user
 * @param {string} to - Recipient email
 * @param {string} token - Verification token
 * @param {string} [tgId] - Optional Telegram ID
 */
async function sendVerificationEmail(to, token, tgId) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}${tgId ? `&tgId=${encodeURIComponent(tgId)}` : ''}`

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.sender = {
      name: 'Edgy Events',
      email: process.env.MAIL_FROM || 'no-reply@teanet.xyz',
    }
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = 'Verify your email for Edgy Events'
    sendSmtpEmail.htmlContent = `
      <h1>Welcome to Edgy Events 🎉</h1>
      <p>Click the button below to verify your email:</p>
      <p style="margin: 20px 0;">
        <a href="${verifyUrl}" style="
          background-color: #4CAF50;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 5px;
          display: inline-block;
        ">Verify my email</a>
      </p>
      <p>This link will expire in 24 hours.</p>
      <p>If the button doesn’t work, copy and paste this URL into your browser:</p>
      <p>${verifyUrl}</p>
    `

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail)
    console.log('✅ Verification email sent to', to, 'response:', response)
    return true
  } catch (err) {
    console.error('❌ Failed to send verification email:', err?.response?.body || err)
    throw new Error('Failed to send verification email')
  }
}

/**
 * Send email to prebooked users when event is confirmed
 * @param {string} to - Recipient email
 * @param {object} event - Event object
 */
async function sendEventConfirmedEmail(to, event) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const eventUrl = `${baseUrl}/events/${event.id}`

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.sender = {
      name: 'Edgy Events',
      email: process.env.MAIL_FROM || 'no-reply@teanet.xyz',
    }
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = `Event confirmed: ${event.name}!`
    sendSmtpEmail.htmlContent = `
      <h1>Event Confirmed 🎉</h1>
      <p>The event <strong>${event.name}</strong> now has enough prebookings and is open for booking.</p>
      <p>Click below to book your spot:</p>
      <p style="margin:20px 0;">
        <a href="${eventUrl}" style="
          background-color: #4CAF50;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 5px;
          display: inline-block;
        ">Book my spot</a>
      </p>
    `

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail)
    console.log('✅ Event confirmation email sent to', to, 'response:', response)
  } catch (err) {
    console.error('❌ Failed to send event confirmation email:', err?.response?.body || err)
  }
}

module.exports = { sendVerificationEmail, sendEventConfirmedEmail }

