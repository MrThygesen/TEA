// pages/api/setRole.js




/*
import { pool } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  let { telegram_username, telegram_user_id, role, group_id } = req.body

  if (!role || (!telegram_username && !telegram_user_id)) {
    return res.status(400).json({ error: 'Missing user ID/username or role' })
  }

  // Normalize username
  if (telegram_username) {
    telegram_username = telegram_username.replace(/^@/, '').toLowerCase()
  }

  // Ensure group_id is null if empty or invalid
  if (group_id === '' || group_id === undefined || group_id === null) {
    group_id = null
  } else {
    group_id = parseInt(group_id, 10)
    if (isNaN(group_id)) group_id = null
  }

  try {
    // Update existing profile
    const result = await pool.query(
      `UPDATE user_profiles
       SET role = $1,
           group_id = $2,
           updated_at = NOW()
       WHERE ($3::text IS NOT NULL AND LOWER(telegram_username) = LOWER($3))
          OR ($4::text IS NOT NULL AND telegram_user_id = $4)
       RETURNING *`,
      [role, group_id, telegram_username || null, telegram_user_id || null]
    )

    if (result.rowCount === 0) {
      // Insert if user not found
      const insert = await pool.query(
        `INSERT INTO user_profiles (telegram_user_id, telegram_username, role, group_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [telegram_user_id || null, telegram_username || null, role, group_id]
      )

      return res
        .status(201)
        .json({ success: true, user: insert.rows[0], message: 'User added as pending' })
    }

    return res.status(200).json({ success: true, user: result.rows[0] })
  } catch (err) {
    console.error('Database error in setRole:', err)
    return res
      .status(500)
      .json({ error: 'Database error', details: err.message })
  }
}
*/
