// lib/email.js
import * as brevo from '@getbrevo/brevo'

const apiInstance = new brevo.TransactionalEmailsApi()
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY)

export async function sendVerificationEmail(to, verifyUrl) {
  const email = {
    to: [{ email: to }],
    sender: { email: process.env.MAIL_FROM || 'noreply@edgy.com', name: 'Edgy Events' },
    subject: 'Verify your email for Edgy Events',
    htmlContent: `
      <h1>Welcome to Edgy Events</h1>
      <p>Please click the link below to verify your email:</p>
      <p><a href="${verifyUrl}">Verify my email</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  }
  await apiInstance.sendTransacEmail(email)
}

