import { pool } from '../../lib/postgres.js';

export default async function handler(req, res) {
  const { tgId, token } = req.query;
  if (!tgId || !token) return res.status(400).send('Invalid link');

  const { rows } = await pool.query(
    `SELECT * FROM email_verification_tokens
     WHERE telegram_user_id=$1 AND token=$2 AND expires_at > NOW()`,
    [tgId, token]
  );

  if (!rows.length) return res.status(400).send('Invalid or expired token');

  const email = rows[0].email;

  // Save verified email in user_profiles
  await pool.query(
    `UPDATE user_profiles SET email=$1, updated_at=NOW() WHERE telegram_user_id=$2`,
    [email, tgId]
  );

  // Delete token
  await pool.query(
    `DELETE FROM email_verification_tokens WHERE telegram_user_id=$1`,
    [tgId]
  );

  res.send('<h2>✅ Email verified successfully!</h2><p>You can now close this page.</p>');

}

