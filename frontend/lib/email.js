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
    if (!tickets.length) return

    let htmlContent = `<h1>Hello ${user.username || ''}, here are your tickets 🎟</h1>`
    const attachments = []

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i]
      if (!ticket.ticket_code) continue

      const qrBuffer = await QRCode.toBuffer(ticket.ticket_code)
      const cid = `qrCode${i}`

      htmlContent += `
        <h2>${event.name} (${event.city || 'TBA'})</h2>
        <p>Date/Time: ${event.datetime ? new Date(event.datetime).toLocaleString() : 'TBA'}</p>
        <p>Venue: ${event.venue || 'TBA'}</p>
        <p>Please show this QR code at the entrance:</p>
        <p><img src="cid:${cid}" alt="QR Ticket" style="max-width:250px;"/></p>
        <p><small>QR Data: ${ticket.ticket_code}</small></p>
        <hr/>
      `

      attachments.push({
        content: qrBuffer.toString('base64'),
        name: `ticket_${i}.png`,
        contentId: cid
      })
    }

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.sender = { name: 'Edgy Events', email: MAIL_FROM }
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = `Your Tickets for ${event.name}`
    sendSmtpEmail.htmlContent = htmlContent
    sendSmtpEmail.attachment = attachments

    await apiInstance.sendTransacEmail(sendSmtpEmail)
    console.log('✅ Ticket email sent to', to, 'with', tickets.length, 'tickets')
  } catch (err) {
    console.error('❌ Failed to send ticket email:', err?.response?.body || err)
  }
}

