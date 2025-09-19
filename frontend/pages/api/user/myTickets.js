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
      `SELECT r.id, r.has_paid, r.ticket_sent, e.id AS event_id, e.name AS event_name,
              e.city, e.datetime, e.price, e.is_confirmed,
              r.created_at
       FROM registrations r
       JOIN events e ON r.event_id = e.id
       WHERE r.user_id = $1
       ORDER BY e.datetime DESC`,
      [user.id]
    )

    // Attach computed fields + QR if applicable
    const tickets = await Promise.all(
      rows.map(async (t) => {
        const isFree = !t.price || Number(t.price) === 0
        const stage = t.is_confirmed ? 'book' : 'guestlist'

        let qrData = null
        let qrImage = null

        if (t.ticket_sent && (isFree || t.has_paid)) {
          qrData = `ticket:${t.event_id}:${user.id}`
          qrImage = await QRCode.toDataURL(qrData)
        }

        return {
          ...t,
          is_free: isFree,
          stage,
          is_book_stage: !!t.is_confirmed,
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

