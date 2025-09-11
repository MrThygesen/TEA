// lib/email.js
const SibApiV3Sdk = require('@getbrevo/brevo')

// Initialize Brevo client
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()
apiInstance.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
)

/**
 * Send a verification email that calls the backend directly.
 * Clicking the link immediately triggers /api/confirm-email with the token.
 */
async function sendVerificationEmail(to, token) {
  try {
    // Backend verification URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const verifyUrl = `${baseUrl}/api/confirm-email?token=${encodeURIComponent(token)}`

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.sender = {
      name: 'Edgy Events',
      email: process.env.MAIL_FROM || 'no-reply@teanet.xyz',
    }
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = 'Verify your email for Edgy Events'
    sendSmtpEmail.htmlContent = `
      <h1>Welcome to Edgy Events 🎉</h1>
      <p>Thanks for signing up! Click the button below to verify your email:</p>
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

module.exports = { sendVerificationEmail }

