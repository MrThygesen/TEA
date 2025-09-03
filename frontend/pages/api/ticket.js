// pages/api/ticket.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  const { email, event } = req.query
  if (!email || !event) {
    return res.status(400).json({ error: 'Email and event ID required' })
  }

  try {
    const query = `
      SELECT e.id, e.name, e.datetime, e.price, r.has_paid
      FROM registrations r
      JOIN events e ON e.id = r.event_id
      WHERE LOWER(r.email) = LOWER($1) AND e.id = $2
      LIMIT 1
    `
    const { rows } = await pool.query(query, [email, event])

    if (!rows.length) {
      return res.status(404).json({ error: 'No ticket found for this email' })
    }

    const record = rows[0]
    if (!record.has_paid) {
      return res.status(403).json({ error: 'Payment not completed for this event' })
    }

    const ticketCode = `TEA-${record.id}-${email.split('@')[0]}-${record.datetime
      .toISOString()
      .slice(0, 10)}`

    res.status(200).json({
      id: record.id,
      name: record.name,
      datetime: record.datetime,
      ticketCode,
    })
  } catch (err) {
    console.error('Error fetching ticket:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

