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

  const userId = user.id || null
  const telegramUserId = user.telegram_user_id || null
  if (!userId && !telegramUserId) return res.status(400).json({ error: 'No valid user in token' })

  try {
    const { rows } = await pool.query(
      `
      SELECT r.*, e.name AS event_name, e.city, e.datetime, e.price, e.is_confirmed
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.user_id=$1 OR r.telegram_user_id=$2
      ORDER BY e.datetime DESC
      `,
      [userId, telegramUserId]
    )

    const tickets = await Promise.all(rows.map(async (t) => {
      const isBookStage = t.stage === 'book'
      const stage = isBookStage ? 'book' : 'prebook'
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
        registered_at: t.timestamp,
        is_free: isFree,
        stage,
        is_book_stage: isBookStage,
        qrData,
        qrImage,
      }
    }))

    return res.status(200).json({ tickets })

  } catch (err) {
    console.error('❌ myTickets error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

