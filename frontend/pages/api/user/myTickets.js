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
    let ticketsQuery = ''
    let params = []

    if (user.id) {
      ticketsQuery = `
        SELECT r.id, r.has_paid, r.ticket_sent, r.ticket_code, r.timestamp AS registered_at,
               e.id AS event_id, e.name AS event_name, e.city, e.datetime, e.price, e.is_confirmed
        FROM registrations r
        JOIN events e ON r.event_id = e.id
        WHERE r.user_id = $1
        ORDER BY e.datetime DESC
      `
      params = [user.id]
    } else if (user.telegram_user_id) {
      ticketsQuery = `
        SELECT r.id, r.has_paid, r.ticket_sent, r.ticket_code, r.timestamp AS registered_at,
               e.id AS event_id, e.name AS event_name, e.city, e.datetime, e.price, e.is_confirmed
        FROM registrations r
        JOIN events e ON r.event_id = e.id
        WHERE r.telegram_user_id = $1
        ORDER BY e.datetime DESC
      `
      params = [user.telegram_user_id]
    } else {
      return res.status(400).json({ error: 'No user ID found in token' })
    }

    const { rows } = await pool.query(ticketsQuery, params)

    const tickets = await Promise.all(
      rows.map(async (t) => {
        const isBookStage = !!t.is_confirmed
let stage
if (t.ticket_sent || t.has_paid) {
  stage = 'book'
} else {
  stage = 'guestlist'
}


        const isFree = !t.price || Number(t.price) === 0

        let qrData = null
        let qrImage = null
        if (t.ticket_sent && (isFree || t.has_paid)) {
          qrData = t.ticket_code
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
          is_free: isFree,
          stage,
          is_book_stage: isBookStage,
          qrData,
          qrImage,
        }
      })
    )

    return res.json({ tickets })
  } catch (err) {
    console.error('❌ myTickets error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

