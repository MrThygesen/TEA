// tea-project/shared/email.js
import crypto from "crypto";
import pkg from "pg";
import dotenv from "dotenv";
import Brevo from "@getbrevo/brevo";

dotenv.config();
const { Pool } = pkg;

// ==== CONFIG ====
const client = new Brevo.TransactionalEmailsApi();
client.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const FROM_EMAIL = process.env.FROM_EMAIL || "no-reply@teanet.xyz";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// ==== HELPERS ====
export function isLikelyEmail(s) {
  return typeof s === "string" && s.includes("@") && s.includes(".");
}

export function generateEmailToken() {
  return crypto.randomBytes(20).toString("hex"); // 40-character token
}

// ==== SEND EMAIL VERIFICATION ====
export async function sendEmailVerification({ userId = null, tgId = null, email }) {
  if (!isLikelyEmail(email)) throw new Error("Invalid email");

  const token = generateEmailToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h expiration

  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, telegram_user_id, email, token, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, telegram_user_id)
     DO UPDATE SET email = EXCLUDED.email, token = EXCLUDED.token, expires_at = EXCLUDED.expires_at`,
    [userId, tgId, email, token, expiresAt]
  );

  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  const msg = {
    sender: { email: FROM_EMAIL },
    to: [{ email }],
    subject: "Confirm your email",
    htmlContent: `
      <p>Hi!</p>
      <p>Please confirm your email by clicking the link below:</p>
      <p><a href="${verificationUrl}">Confirm Email</a></p>
      <p>This link will expire in 24 hours.</p>
    `,
  };

  await client.sendTransacEmail(msg);
  console.log(`📧 Verification email sent to ${email}`);
  return token;
}

// ==== CONFIRM EMAIL TOKEN ====
export async function confirmEmailToken(token) {
  const res = await pool.query(
    `SELECT user_id, telegram_user_id, email, expires_at
     FROM email_verification_tokens
     WHERE token=$1`,
    [token]
  );

  if (!res.rows.length) throw new Error("Invalid token");
  const { user_id, telegram_user_id, email, expires_at } = res.rows[0];

  if (new Date() > expires_at) throw new Error("Token expired");

  // Update user_profiles if user exists
  if (user_id) {
    await pool.query(
      `UPDATE user_profiles
       SET email=$1, is_verified=TRUE
       WHERE id=$2`,
      [email, user_id]
    );
  } else if (telegram_user_id) {
    await pool.query(
      `UPDATE user_profiles
       SET email=$1, is_verified=TRUE
       WHERE telegram_user_id=$2`,
      [email, telegram_user_id]
    );
  }

  // Delete token
  await pool.query(
    `DELETE FROM email_verification_tokens WHERE token=$1`,
    [token]
  );

  console.log(`✅ Email verified: ${email}`);
  return { email, userId: user_id, tgId: telegram_user_id };
}

// ==== SEND EVENT CONFIRMATION ====
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
            <p>See you there!</p>
          `,
        };
        await client.sendTransacEmail(msg);
      })
    );

    console.log(`📧 Event confirmation sent to ${attendees.length} attendees`);
  } catch (err) {
    console.error("❌ Failed to send event confirmation email", err);
  }
}

// ==== SEND PAYMENT CONFIRMATION ====
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
        <p>We have received your payment for the event "<strong>${eventName}</strong>". ✅</p>
        <p>Thank you! See you at the event.</p>
      `,
    };

    await client.sendTransacEmail(msg);
    console.log(`📧 Payment confirmation sent to ${attendee.email}`);
  } catch (err) {
    console.error("❌ Failed to send payment confirmation email", err);
  }
}

