// pages/api/email.js
import crypto from "crypto";
import pkg from "pg";
import dotenv from "dotenv";
import Brevo from "@getbrevo/brevo";

dotenv.config();
const { Pool } = pkg;

// ===== CONFIG =====
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
const FRONTEND_URL = process.env.FRONTEND_URL || "https://teanet.xyz";

// ===== HELPERS =====
export function isLikelyEmail(email) {
  return typeof email === "string" && email.includes("@") && email.includes(".");
}

export function generateEmailToken() {
  return crypto.randomBytes(20).toString("hex"); // 40 chars
}

// ===== SEND EMAIL VERIFICATION =====
export async function sendEmailVerification({ userId, tgId, email }) {
  if (!isLikelyEmail(email)) throw new Error("Invalid email");

  const token = generateEmailToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, telegram_user_id, email, token, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (telegram_user_id)
     DO UPDATE SET email = EXCLUDED.email, token = EXCLUDED.token, expires_at = EXCLUDED.expires_at`,
    [userId || null, tgId || null, email, token, expiresAt]
  );

  const verificationUrl = `${FRONTEND_URL}/verify-email?userId=${userId || ""}&tgId=${tgId || ""}&token=${token}`;

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
  return token;
}

// ===== SEND EVENT CONFIRMATION =====
export async function sendEventConfirmed(eventId, eventName, eventCity, eventDateTime) {
  try {
    const res = await pool.query(
      `SELECT email, telegram_username
       FROM registrations
       WHERE event_id=$1 AND email IS NOT NULL`,
      [eventId]
    );

    const attendees = res.rows;
    if (!attendees.length) return;

    await Promise.all(
      attendees.map(async (attendee) => {
        const msg = {
          sender: { email: FROM_EMAIL },
          to: [{ email: attendee.email }],
          subject: `Event Confirmed: ${eventName}`,
          htmlContent: `
            <p>Hi ${attendee.telegram_username || ""},</p>
            <p>Your event "<strong>${eventName}</strong>" is now confirmed! 🎉</p>
            <p><strong>Date/Time:</strong> ${eventDateTime || "TBA"}</p>
            <p><strong>City:</strong> ${eventCity || "TBA"}</p>
          `,
        };
        await client.sendTransacEmail(msg);
      })
    );

    console.log(`📧 Event confirmation sent to ${attendees.length} attendees`);
  } catch (err) {
    console.error("❌ Failed to send event confirmation emails", err);
  }
}

// ===== SEND PAYMENT CONFIRMATION =====
export async function sendPaymentConfirmed(eventId, eventName, tgId) {
  try {
    const res = await pool.query(
      `SELECT email, telegram_username
       FROM registrations
       WHERE event_id=$1 AND telegram_user_id=$2 AND email IS NOT NULL`,
      [eventId, tgId]
    );

    if (!res.rows.length) return;

    const attendee = res.rows[0];
    const msg = {
      sender: { email: FROM_EMAIL },
      to: [{ email: attendee.email }],
      subject: `Payment Confirmed: ${eventName}`,
      htmlContent: `
        <p>Hi ${attendee.telegram_username || ""},</p>
        <p>We have received your payment for "<strong>${eventName}</strong>". ✅</p>
      `,
    };

    await client.sendTransacEmail(msg);
    console.log(`📧 Payment confirmation sent to ${attendee.email}`);
  } catch (err) {
    console.error("❌ Failed to send payment confirmation email", err);
  }
}

// ===== API ROUTE HANDLER =====
export default async function handler(req, res) {
  const { action } = req.query;

  try {
    if (action === "verify") {
      const { userId, tgId, token } = req.query;
      if (!token || (!userId && !tgId)) {
        return res.status(400).json({ error: "Missing params" });
      }

      const result = await pool.query(
        `SELECT * FROM email_verification_tokens
         WHERE token=$1
           AND expires_at > NOW()
           AND ((user_id IS NOT NULL AND user_id=$2) OR (telegram_user_id IS NOT NULL AND telegram_user_id=$3))`,
        [token, userId || null, tgId || null]
      );

      if (!result.rows.length) return res.status(400).json({ error: "Invalid or expired token" });

      // Mark user as verified
      if (userId) {
        await pool.query(`UPDATE user_profiles SET is_verified = TRUE, updated_at = NOW() WHERE id=$1`, [userId]);
      } else {
        await pool.query(`UPDATE user_profiles SET is_verified = TRUE, updated_at = NOW() WHERE telegram_user_id=$1`, [tgId]);
      }

      // Delete token
      await pool.query(`DELETE FROM email_verification_tokens WHERE token=$1`, [token]);

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("Email API error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

