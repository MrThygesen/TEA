// lib/email.js
async function sendVerificationEmail(to, verifyUrl) {
  try {
    // Lazy-load Brevo SDK to avoid build-time issues on Vercel
    const SibApiV3Sdk = require('@getbrevo/brevo')

    // Configure API key
    const defaultClient = SibApiV3Sdk.ApiClient.instance
    defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY

    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.sender = {
      name: 'Edgy Events',
      email: process.env.MAIL_FROM || 'no-reply@teanet.xyz',
    }
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = 'Verify your email for Edgy Events'
    sendSmtpEmail.htmlContent = `
      <h1>Welcome to Edgy Events</h1>
      <p>Please click the link below to verify your email:</p>
      <p><a href="${verifyUrl}">Verify my email</a></p>
      <p>This link expires in 24 hours.</p>
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

