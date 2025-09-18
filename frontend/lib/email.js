// lib/email.js
const SibApiV3Sdk = require('@getbrevo/brevo')
const QRCode = require('qrcode')

// Initialize Brevo API
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()
apiInstance.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
)

const MAIL_FROM = process.env.MAIL_FROM || 'no-reply@teanet.xyz'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

/**
 * Generate QR data + base64 QR code for a ticket
 */
async function generateTicketQRCode(eventId, userId) {
  const qrData = `ticket:${eventId}:${userId}`
  const qrImage = await QRCode.toDataURL(qrData) // base64 image
  return { qrData, qrImage }
}

/**
 * Send email verification to a new user
 */
async function sendVerificationEmail(to, token, tgId) {
  try {
    const verifyUrl = `${BASE_URL}/verify-email?token=${encodeURIComponent(token)}${
      tgId ? `&tgId=${encodeURIComponent(tgId)}` : ''
    }`

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.sender = { name: 'Edgy Events', email: MAIL_FROM }
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = 'Verify your email for Edgy Events'
    sendSmtpEmail.htmlContent = `
      <h1>Welcome to Edgy Events 🎉</h1>
      <p>Click the button below to verify your email:</p>
      <p style="margin: 20px 0;">
        <a href="${verifyUrl}" style="background-color:#4CAF50;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;display:inline-block;">Verify my email</a>
      </p>
      <p>This link will expire in 24 hours.</p>
      <p>If the button doesn’t work, copy and paste this URL into your browser:</p>
      <p>${verifyUrl}</p>
    `
    await apiInstance.sendTransacEmail(sendSmtpEmail)
    console.log('✅ Verification email sent to', to)
    return true
  } catch (err) {
    console.error('❌ Failed to send verification email:', err?.response?.body || err)
    throw new Error('Failed to send verification email')
  }
}

/**
 * Send email to prebooked user immediately
 */
async function sendPrebookEmail(to, event) {
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.sender = { name: 'Edgy Events', email: MAIL_FROM }
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = `Prebooked: ${event.name}`
    sendSmtpEmail.htmlContent = `
      <h1>Prebook Confirmed ✅</h1>
      <p>You have successfully prebooked a spot for:</p>
      <p><strong>${event.name}</strong> (${event.city})</p>
      <p>Date/Time: ${new Date(event.datetime).toLocaleString()}</p>
      <p>We’ll notify you once the event is confirmed.</p>
    `
    await apiInstance.sendTransacEmail(sendSmtpEmail)
    console.log('✅ Prebook email sent to', to)
  } catch (err) {
    console.error('❌ Failed to send prebook email:', err?.response?.body || err)
  }
}

/**
 * Send booking reminder when event is confirmed
 */
async function sendBookingReminderEmail(to, event) {
  try {
    const eventUrl = `${BASE_URL}/events/${event.id}`
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.sender = { name: 'Edgy Events', email: MAIL_FROM }
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = `Event confirmed: ${event.name}!`
    sendSmtpEmail.htmlContent = `
      <h1>Event Confirmed 🎉</h1>
      <p>The event <strong>${event.name}</strong> now has enough prebookings and is open for booking.</p>
      <p><strong>Date/Time:</strong> ${new Date(event.datetime).toLocaleString()}</p>
      <p><a href="${eventUrl}" style="background-color:#4CAF50;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;display:inline-block;">Book my spot</a></p>
    `
    await apiInstance.sendTransacEmail(sendSmtpEmail)
    console.log('✅ Booking reminder email sent to', to)
  } catch (err) {
    console.error('❌ Failed to send booking reminder email:', err?.response?.body || err)
  }
}


/**
 * Send ticket email with embedded QR code (as attachment with CID)
 */
async function sendTicketEmail(to, event, user) {
  try {
    const qrData = `ticket:${event.id}:${user.id}`
    const qrBuffer = await QRCode.toBuffer(qrData) // PNG buffer

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.sender = { name: 'Edgy Events', email: MAIL_FROM }
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = `Your Ticket: ${event.name}`

    // build main body
    let htmlContent = `
      <h1>Your Ticket 🎟</h1>
      <p>Hello ${user.username || ''}, here is your ticket for:</p>
      <p><strong>${event.name}</strong> (${event.city})</p>
      <p>Date/Time: ${new Date(event.datetime).toLocaleString()}</p>
      <p>Venue: ${event.venue || 'TBA'}</p>
      <p>Please show this QR code at the entrance:</p>
      <p><img src="cid:qrCode" alt="QR Ticket" style="max-width:250px;"/></p>
      <p><small>QR Data: ${qrData}</small></p>
      <p>You can also save this into Google Wallet or Apple Wallet.</p>
    `

    // append event.detailsBlock if present
    if (event.detailsBlock) {
      htmlContent += event.detailsBlock
    }

    sendSmtpEmail.htmlContent = htmlContent

    sendSmtpEmail.attachment = [
      {
        content: qrBuffer.toString('base64'),
        name: 'ticket.png',
        contentId: 'qrCode',
      }
    ]

    await apiInstance.sendTransacEmail(sendSmtpEmail)
    console.log('✅ Ticket email sent to', to)
    return true
  } catch (err) {
    console.error('❌ Failed to send ticket email:', err?.response?.body || err)
    throw new Error('Failed to send ticket email')
  }
}

module.exports = {
  generateTicketQRCode,
  sendVerificationEmail,
  sendPrebookEmail,
  sendBookingReminderEmail,
  sendTicketEmail,
}

