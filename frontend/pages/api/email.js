// pages/api/email.js

export default async function handler(req, res) {
  try {
    // Dynamic imports to avoid Next.js build errors
    const pkg = await import("pg");
    const dotenv = await import("dotenv");
    const Brevo = await import("@getbrevo/brevo");

    dotenv.config();
    const { Pool } = pkg;

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    const client = new Brevo.TransactionalEmailsApi();
    client.setApiKey(
      Brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );

    const FROM_EMAIL = process.env.FROM_EMAIL || "no-reply@teanet.xyz";
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

    // ===== HELPERS =====
    const isLikelyEmail = (email) =>
      typeof email === "string" && email.includes("@") && email.includes(".");

    const generateEmailToken = () =>
      crypto.randomBytes(20).toString("hex"); // 40 chars

    // ===== ROUTE LOGIC =====
    const { action } = req.query;

    if (action === "verify") {
      if (req.method !== "POST")
        return res.status(405).json({ error: "POST only" });

      const { userId, tgId, email } = req.body;
      if (!email || (!userId && !tgId))
        return res.status(400).json({ error: "Missing params" });

      if (!isLikelyEmail(email)) return res.status(400).json({ error: "Invalid email" });

      const token = generateEmailToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      await pool.query(
        `
        INSERT INTO email_verification_tokens (user_id, telegram_user_id, email, token, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id)
        DO UPDATE SET email = EXCLUDED.email, token = EXCLUDED.token, expires_at = EXCLUDED.expires_at
        `,
        [userId || null, tgId || null, email, token, expiresAt]
      );

      const verificationUrl = `${FRONTEND_URL}/verify-email?token=${token}&userId=${userId || ""}&tgId=${tgId || ""}`;

      const msg = {
        sender: { email: FROM_EMAIL },
        to: [{ email }],
        subject: "Confirm your email",
        htmlContent: `
          <p>Hi!</p>
          <p>Please confirm your email by clicking the link below:</p>
          <p><a href="${verificationUrl}">Confirm Email</a></p>
          <p>This link expires in 24 hours.</p>
        `,
      };

      await client.sendTransacEmail(msg);
      console.log(`📧 Verification email sent to ${email}`);
      return res.status(200).json({ token });
    }

    if (action === "confirm") {
      if (req.method !== "POST")
        return res.status(405).json({ error: "POST only" });

      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Missing token" });

      const result = await pool.query(
        `
        SELECT user_id, telegram_user_id, email, expires_at
        FROM email_verification_tokens
        WHERE token=$1
        `,
        [token]
      );

      if (!result.rows.length) return res.status(400).json({ error: "Invalid token" });

      const { user_id, telegram_user_id, email, expires_at } = result.rows[0];
      if (new Date() > expires_at) return res.status(400).json({ error: "Token expired" });

      if (user_id) {
        await pool.query(
          `UPDATE user_profiles SET email=$1, is_verified=TRUE, updated_at=NOW() WHERE id=$2`,
          [email, user_id]
        );
      } else if (telegram_user_id) {
        await pool.query(
          `UPDATE user_profiles SET email=$1, is_verified=TRUE, updated_at=NOW() WHERE telegram_user_id=$2`,
          [email, telegram_user_id]
        );
      }

      // Delete token
      await pool.query(`DELETE FROM email_verification_tokens WHERE token=$1`, [token]);
      console.log(`✅ Email verified: ${email}`);
      return res.status(200).json({ email, userId: user_id, tgId: telegram_user_id });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("Email API error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

