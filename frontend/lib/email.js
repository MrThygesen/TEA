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

// --------------------------
// Ticket email (multi-ticket)
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
    if (!tickets.length) {
      console.warn('No tickets found for user', user.id, 'event', event.id)
      return
    }

    // Build attachments and HTML blocks
    const attachments = []
    let ticketsHtml = ''
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i]
      if (!ticket.ticket_code) continue

      // Generate QR buffer for this ticket
      const qrBuffer = await QRCode.toBuffer(ticket.ticket_code)

      // Unique contentId per ticket
      const cid = `qrCode${i}`
      attachments.push({
        content: qrBuffer.toString('base64'),
        name: `ticket-${i + 1}.png`,
        contentId: cid,
      })

      // HTML block for this ticket
      ticketsHtml += `
        <hr style="border:1px solid #ccc;margin:20px 0;">
        <h2>Ticket ${i + 1} 🎟</h2>
        <p><strong>${event.name}</strong> (${event.city || 'TBA'})</p>
        <p>Date/Time: ${event.datetime ? new Date(event.datetime).toLocaleString() : 'TBA'}</p>
        <p>Venue: ${event.venue || 'TBA'}</p>
        <p>Please show this QR code at the entrance:</p>
        <p><img src="cid:${cid}" alt="QR Ticket" style="max-width:250px;" /></p>
        <p><small>QR Data: ${ticket.ticket_code}</small></p>
        <p><a href="${BASE_URL}/tickets/${ticket.ticket_code}" style="color:#4CAF50;">View in app</a></p>
      `
    }

    if (!ticketsHtml) {
      console.warn('No valid tickets to send for user', user.id)
      return
    }

    // Compose and send email
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.sender = { name: 'Edgy Events', email: MAIL_FROM }
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = `Your Tickets: ${event.name}`
    sendSmtpEmail.htmlContent = `
      <h1>Your Tickets 🎫</h1>
      <p>Hello ${user.username || ''}, here are your tickets for the event:</p>
      ${ticketsHtml}
      <p>Thank you for attending Edgy Events!</p>
    `
    sendSmtpEmail.attachment = attachments

    await apiInstance.sendTransacEmail(sendSmtpEmail)
    console.log('✅ Ticket email sent to', to, 'tickets count:', tickets.length)
  } catch (err) {
    console.error('❌ Failed to send ticket emails:', err?.response?.body || err)
  }
}

module.exports = {
  generateTicketQRCode,
  sendVerificationEmail,
  sendTicketEmail,
}

