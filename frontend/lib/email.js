// lib/email.js
const SibApiV3Sdk = require('@getbrevo/brevo')

// Initialize Brevo client
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()
apiInstance.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
)

/**
 * Send a verification email with a link pointing to the frontend.
 * The frontend (pages/email-verified.js) will grab the token and call /api/confirm-email.
 */
async function sendVerificationEmail(to, token) {
  try {
    // Make sure NEXT_PUBLIC_BASE_URL is set, e.g. https://yourapp.vercel.app
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const verifyUrl = `${baseUrl}/email-verified?token=${token}`

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.sender = {
      name: 'Edgy Events',
      email: process.env.MAIL_FROM || 'no-reply@teanet.xyz',
    }
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = 'Verify your email for Edgy Events'
    sendSmtpEmail.htmlContent = `
      <h1>Welcome to Edgy Events 🎉</h1>
      <p>Thanks for signing up! Please verify your email address by clicking below:</p>
      <p><a href="${verifyUrl}">Verify my email</a></p>
      <p>This link will expire in 24 hours.</p>
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

