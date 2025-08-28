// pages/api/registrations.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await pool.query(`
      SELECT 
        id,
        event_id,
        telegram_user_id,
        telegram_username,
        email,
        wallet_address,
        timestamp,
        has_arrived,
        voucher_applied,
        basic_perk_applied,
        advanced_perk_applied,
        ticket_validated,
        validated_by,
        validated_at,
        has_paid,
        paid_at
      FROM registrations
      ORDER BY timestamp ASC
    `)

    res.status(200).json({ registrations: result.rows })
  } catch (err) {
    console.error('[API /registrations] Error fetching registrations:', err)
    res.status(500).json({ error: 'Database query failed', details: err.message })
  }
}

