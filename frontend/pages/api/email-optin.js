import sgMail from '@sendgrid/mail';
import { pool } from '../../lib/postgres.js'; // adjust path if needed
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@teanet.xyz';
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'https://teanet.xyz';

if (!SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY missing in environment');
sgMail.setApiKey(SENDGRID_API_KEY);

// Generate a random verification token
function generateEmailToken() {
  return crypto.randomBytes(20).toString('hex'); // 40-character token
}

export default async function handler(req, res) {
  const { method } = req;

  if (method === 'POST') {
    try {
      let { email, wallet, firstname, lastname, eventName, eventCity, eventDateTime } = req.body;

      if (!email && !wallet) {
        return res.status(400).json({ error: 'Missing email or wallet' });
      }

      // If firstname missing → try to fetch from DB via wallet
      if (!firstname && wallet) {
        const userRes = await pool.query(
          'SELECT telegram_username FROM registrations WHERE wallet_address=$1 LIMIT 1',
          [wallet]
        );
        firstname = userRes.rows[0]?.telegram_username || '';
      }

      lastname = lastname || '';

      // --- EVENT CONFIRMATION EMAIL ---
      if (eventName) {
        const msg = {
          to: email,
          from: FROM_EMAIL,
          subject: `Event Confirmed: ${eventName}`,
          html: `
            <p>Hi ${firstname},</p>
            <p>Your event <strong>${eventName}</strong> is now confirmed! 🎉</p>
            <p><strong>Date/Time:</strong> ${eventDateTime || 'TBA'}</p>
            <p><strong>City:</strong> ${eventCity || 'TBA'}</p>
            <p>We look forward to seeing you there.</p>
          `,
        };
        await sgMail.send(msg);
        return res.status(200).json({ message: 'Event confirmation email sent' });
      }

      // --- DOUBLE OPT-IN SUBSCRIPTION ---
      if (!email) {
        return res.status(400).json({ error: 'Email required for subscriber' });
      }

      // Generate token & expiration
      const token = generateEmailToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      // Store token for verification
      await pool.query(
        `INSERT INTO email_verification_tokens (telegram_user_id, email, token, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (telegram_user_id)
         DO UPDATE SET email = EXCLUDED.email, token = EXCLUDED.token, expires_at = EXCLUDED.expires_at`,
        [wallet || `guest-${Date.now()}`, email, token, expiresAt]
      );

      // Send verification email
      const verificationUrl = `${FRONTEND_BASE_URL}/verify-email?tgId=${wallet}&token=${token}`;

      const msg = {
        to: email,
        from: FROM_EMAIL,
        subject: 'Confirm your email subscription',
        html: `
          <p>Hi!</p>
          <p>Please confirm your email by clicking the link below:</p>
          <p><a href="${verificationUrl}">Confirm Email</a></p>
          <p>This link will expire in 24 hours.</p>
        `,
      };
      await sgMail.send(msg);

      return res.status(200).json({ message: `Verification email sent to ${email}` });

    } catch (err) {
      console.error('❌ /api/email-optin error:', err);
      return res.status(500).json({ error: 'Failed', details: err.message });
    }
  }

  return res.status(405).json({ error: `Method ${method} not allowed` });
}

