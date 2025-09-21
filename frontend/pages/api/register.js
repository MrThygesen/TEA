// pages/api/events/register.js
import crypto from 'crypto'
import { pool } from '../../lib/postgres.js'


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const { eventId, userId, telegramUserId, email, walletAddress } = req.body

  if (!eventId || (!userId && !telegramUserId)) {
    return res.status(400).json({ error: 'eventId and either userId or telegramUserId are required' })
  }

  try {
    // Generate a globally unique ticket code
    const ticketCode = `ticket:${eventId}:${userId || telegramUserId}:${crypto.randomUUID()}`

    let query, values

    if (userId) {
      // Web user registration
      query = `
        INSERT INTO registrations (event_id, user_id, email, wallet_address, ticket_code)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (event_id, user_id)
        DO UPDATE SET email = EXCLUDED.email,
                      wallet_address = EXCLUDED.wallet_address,
                      ticket_code = EXCLUDED.ticket_code,
                      timestamp = CURRENT_TIMESTAMP
        RETURNING *
      `
      values = [eventId, userId, email || null, walletAddress || null, ticketCode]
    } else {
      // Telegram user registration
      query = `
        INSERT INTO registrations (event_id, telegram_user_id, email, wallet_address, ticket_code)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (event_id, telegram_user_id)
        DO UPDATE SET email = EXCLUDED.email,
                      wallet_address = EXCLUDED.wallet_address,
                      ticket_code = EXCLUDED.ticket_code,
                      timestamp = CURRENT_TIMESTAMP
        RETURNING *
      `
      values = [eventId, telegramUserId, email || null, walletAddress || null, ticketCode]
    }

    const result = await pool.query(query, values)

    return res.status(200).json({
      message: '✅ Registered successfully',
      registration: result.rows[0],
    })
  } catch (err) {
    console.error('❌ Event registration error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

