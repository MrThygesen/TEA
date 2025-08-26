import { pool } from '../../lib/postgres.js';

export default async function handler(req, res) {
  const { tgId, token } = req.query;

  if (!tgId || !token) {
    return res.status(400).send('Invalid link');
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM email_verification_tokens
       WHERE telegram_user_id=$1 AND token=$2 AND expires_at > NOW()`,
      [tgId, token]
    );

    if (!rows.length) {
      return res.status(400).send('Invalid or expired token');
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

    res.status(200).send('✅ Email verified successfully!');
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).send('Server error, please try again later.');
  }
}

