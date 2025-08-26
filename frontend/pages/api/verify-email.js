// pages/api/verify-email.js
import { pool } from '../../lib/postgres.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { tgId, token } = req.query;

  if (!tgId || !token) {
    return res.status(400).json({ error: 'Invalid link' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT email FROM email_verification_tokens
       WHERE telegram_user_id=$1 AND token=$2 AND expires_at > NOW()`,
      [tgId, token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const email = rows[0].email;

    await pool.query(
      `UPDATE user_profiles
       SET email=$1, updated_at=NOW()
       WHERE telegram_user_id=$2`,
      [email, tgId]
    );

    await pool.query(
      `DELETE FROM email_verification_tokens WHERE telegram_user_id=$1`,
      [tgId]
    );

    return res.status(200).json({ success: true, message: '✅ Email verified successfully!' });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ error: 'Server error, please try again later.' });
  }
}

