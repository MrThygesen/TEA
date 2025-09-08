// tea-project/frontend/pages/api/verify-email.js
import { pool } from "../../lib/postgres.js";

export default async function handler(req, res) {
  const { userId, tgId, token } = req.query;
  if (!token || (!userId && !tgId)) {
    return res.redirect(302, "https://teanet.xyz?status=error&reason=missing");
  }

  try {
    const result = await pool.query(
      `SELECT * FROM email_verification_tokens
       WHERE token=$1
         AND expires_at > NOW()
         AND ((user_id IS NOT NULL AND user_id=$2) OR (telegram_user_id IS NOT NULL AND telegram_user_id=$3))`,
      [token, userId || null, tgId || null]
    );

    if (!result.rows.length) {
      return res.redirect(302, "https://teanet.xyz?status=error&reason=invalid");
    }

    // ✅ Mark verified (updates timestamp only — email already stored)
    if (userId) {
      await pool.query(
        `UPDATE user_profiles SET updated_at=NOW() WHERE id=$1`,
        [userId]
      );
    } else if (tgId) {
      await pool.query(
        `UPDATE user_profiles SET updated_at=NOW() WHERE telegram_user_id=$1`,
        [tgId]
      );
    }

    // 🔒 Delete token (one-time use)
    await pool.query(`DELETE FROM email_verification_tokens WHERE token=$1`, [token]);

    return res.redirect(302, "https://teanet.xyz?status=success");
  } catch (err) {
    console.error("Verification error:", err);
    return res.redirect(302, "https://teanet.xyz?status=error&reason=server");
  }
}

