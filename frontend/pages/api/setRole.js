import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import { pool } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Wallet admin check
    const wallet = req.headers['x-wallet']?.toLowerCase()
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet not provided' })
    }
    if (wallet !== process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()) {
      return res.status(403).json({ error: 'Not authorized' })
    }



    const { email, role, event_id } = req.body
    if (!email || !role) {
      return res.status(400).json({ error: 'Missing email or role' })
    }

    // --- Upsert user profile ---
    const userRes = await pool.query(
      `UPDATE user_profiles 
       SET role = $2, updated_at = NOW()
       WHERE email = $1
       RETURNING *`,
      [email, role]
    )

    let updated = userRes.rows[0]
    if (!updated) {
      const insertRes = await pool.query(
        `INSERT INTO user_profiles (email, role, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         RETURNING *`,
        [email, role]
      )
      updated = insertRes.rows[0]
    }

    // --- Organizer assignment ---
    if (role === 'organizer' && event_id) {
      await pool.query(
        `INSERT INTO event_organizers (event_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (event_id, user_id) DO NOTHING`,
        [event_id, updated.id]
      )
    }

    return res.json({ success: true, updated })
  } catch (err) {
    console.error('[setRole] error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

