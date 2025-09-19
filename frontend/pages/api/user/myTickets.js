// pages/api/user/myTickets.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'
import QRCode from 'qrcode'

export default async function handler(req, res) {
  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  let user
  try {
    user = auth.verifyToken(token)
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }

  try {
    const { rows } = await pool.query(
      `SELECT r.id,
              r.has_paid,
              r.ticket_sent,
              r.timestamp AS registered_at,
              e.id AS event_id,
              e.name AS event_name,
              e.city,
              e.datetime,
              e.price,
              e.is_confirmed
       FROM registrations r
       JOIN events e ON r.event_id = e.id
       WHERE r.user_id = $1
       ORDER BY e.datetime DESC`,
      [user.id]
    )

    // Attach computed fields + QR if applicable
    const tickets = await Promise.all(
      rows.map(async (t) => {
        // is the event itself in "book" stage?
        const isBookStage = !!t.is_confirmed

        // determine whether this registration actually resulted in a ticket/paid
        // if the registration has a ticket_sent or has_paid -> consider it a "book" registration
        const stage = t.ticket_sent || t.has_paid ? 'book' : 'guestlist'

        const isFree = !t.price || Number(t.price) === 0

        // only generate QR for issued tickets
        let qrData = null
        let qrImage = null
        if (t.ticket_sent && (isFree || t.has_paid)) {
          qrData = `ticket:${t.event_id}:${user.id}`
          qrImage = await QRCode.toDataURL(qrData)
        }

        return {
          id: t.id,
          event_id: t.event_id,
          event_name: t.event_name,
          city: t.city,
          datetime: t.datetime,
          price: t.price,
          has_paid: t.has_paid,
          ticket_sent: t.ticket_sent,
          registered_at: t.registered_at,
          // computed flags for the frontend
          is_free: isFree,
          stage, // 'guestlist' or 'book' — derived from registration state (not from event)
          is_book_stage: isBookStage, // whether the event itself is in book stage (event.is_confirmed)
          qrData,
          qrImage,
        }
      })
    )

    return res.json({ tickets })
  } catch (err) {
    console.error('❌ myTickets error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

