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

// --------------------------
// Generate QR Code for ticket
// --------------------------
async function generateTicketQRCode(eventId, userId) {
  if (!eventId || !userId) throw new Error('Missing eventId or userId for QR code')
  const qrData = `ticket:${eventId}:${userId}`
  const qrImage = await QRCode.toDataURL(qrData) // base64 image
  return { qrData, qrImage }
}

// --------------------------
// Send verification email
// --------------------------
async function sendVerificationEmail(to, token) {
  if (!to) throw new Error('Missing recipient email')
  try {
    const verifyUrl = `${BASE_URL}/verify-email?token=${encodeURIComponent(token)}`
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
  } catch (err) {
    console.error('❌ Failed to send verification email:', err?.response?.body || err)
    throw new Error('Failed to send verification email')
  }
}
/*
// --------------------------
// Prebook email
// --------------------------
async function sendPrebookEmail(to, event) {
  if (!to || !event) return
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.sender = { name: 'Edgy Events', email: MAIL_FROM }
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = `Prebook Confirmed: ${event.name}`
    sendSmtpEmail.htmlContent = `
      <h1>Prebook Confirmed ✅</h1>
      <p>You are first in line to get info on the event confirmation:</p>
      <p><strong>${event.name}</strong> (${event.city || 'TBA'})</p>
      <p>Date/Time: ${event.datetime ? new Date(event.datetime).toLocaleString() : 'TBA'}</p>
      <p>We’ll notify you once the event is confirmed.</p>
    `
    await apiInstance.sendTransacEmail(sendSmtpEmail)
    console.log('✅ Prebook email sent to', to)
  } catch (err) {
    console.error('❌ Failed to send prebook email:', err?.response?.body || err)
  }
}

// --------------------------
// Upgrade prebook → book email
// --------------------------
async function sendUpgradeToBookEmail(to, event, user) {
  if (!to || !event) return
  try {
    // Link goes to event preview with pay option
    const buyUrl = `${BASE_URL}/events/${event.id}?action=buy`

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.sender = { name: 'Edgy Events', email: MAIL_FROM }
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = `Event Confirmed: ${event.name}`
    sendSmtpEmail.htmlContent = `
      <h1>Great news 🎉</h1>
      <p>The event you prebooked is now confirmed and ready for booking:</p>
      <p><strong>${event.name}</strong> (${event.city || 'TBA'})</p>
      <p>Date/Time: ${event.datetime ? new Date(event.datetime).toLocaleString() : 'TBA'}</p>
      <p>Venue: ${event.venue || 'TBA'}</p>
      <p style="margin: 20px 0;">
        <a href="${buyUrl}" style="background-color:#4CAF50;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;display:inline-block;">Book Now</a>
      </p>
      <p>If the button doesn’t work, copy this link:</p>
      <p>${buyUrl}</p>
    `
    await apiInstance.sendTransacEmail(sendSmtpEmail)
    console.log('✅ Upgrade-to-book email sent to', to)
  } catch (err) {
    console.error('❌ Failed to send upgrade-to-book email:', err?.response?.body || err)
  }
}

*/

// --------------------------
// Ticket email
// --------------------------
async function sendTicketEmail(to, event, user, pool) {
  if (!to || !event || !user || !user.id) {
    console.warn('Skipping ticket email: missing data', { to, eventId: event?.id, userId: user?.id })
    return
  }

  try {
    // Fetch all tickets for this user and event
    const ticketsRes = await pool.query(
      `SELECT * FROM registrations WHERE (user_id=$1 OR telegram_user_id=$2) AND event_id=$3`,
      [user.id, user.id, event.id]
    )
    const tickets = ticketsRes.rows

    for (const ticket of tickets) {
      if (!ticket.ticket_code) continue
      const qrBuffer = await QRCode.toBuffer(ticket.ticket_code)

      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
      sendSmtpEmail.sender = { name: 'Edgy Events', email: MAIL_FROM }
      sendSmtpEmail.to = [{ email: to }]
      sendSmtpEmail.subject = `Your Ticket: ${event.name}`

      let htmlContent = `
        <h1>Your Ticket 🎟</h1>
        <p>Hello ${user.username || ''}, here is your ticket for:</p>
        <p><strong>${event.name}</strong> (${event.city || 'TBA'})</p>
        <p>Date/Time: ${event.datetime ? new Date(event.datetime).toLocaleString() : 'TBA'}</p>
        <p>Venue: ${event.venue || 'TBA'}</p>
        <p>Please show this QR code at the entrance:</p>
        <p><img src="cid:qrCode" alt="QR Ticket" style="max-width:250px;"/></p>
        <p><small>QR Data: ${ticket.ticket_code}</small></p>
      `
      if (event.detailsBlock) htmlContent += event.detailsBlock

      sendSmtpEmail.htmlContent = htmlContent
      sendSmtpEmail.attachment = [
        { content: qrBuffer.toString('base64'), name: 'ticket.png', contentId: 'qrCode' }
      ]

      await apiInstance.sendTransacEmail(sendSmtpEmail)
      console.log('✅ Ticket email sent to', to, 'ticket_code:', ticket.ticket_code)
    }
  } catch (err) {
    console.error('❌ Failed to send ticket emails:', err?.response?.body || err)
  }
}

module.exports = {
  generateTicketQRCode,
  sendVerificationEmail,
  sendPrebookEmail,
  sendTicketEmail,
  sendUpgradeToBookEmail,
}

