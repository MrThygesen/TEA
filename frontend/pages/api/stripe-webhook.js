import Stripe from 'stripe';
import { buffer } from 'micro';
import { pool } from '../../lib/postgres.js';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      const telegramUserId = session.metadata?.telegramId; // <--- match Stripe metadata
      const eventId = session.metadata?.eventId;           // <--- match Stripe metadata

      if (!telegramUserId || !eventId) {
        console.warn('⚠ Missing metadata:', session.id, session.metadata);
        return res.status(400).send('Missing metadata');
      }

      // Ensure registration exists
      await pool.query(
        `INSERT INTO registrations (event_id, telegram_user_id, email)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id, telegram_user_id) DO NOTHING`,
        [eventId, telegramUserId, session.customer_details?.email || null]
      );

      // Update payment status
      const result = await pool.query(
        `UPDATE registrations
         SET has_paid = TRUE, paid_at = NOW()
         WHERE event_id = $1 AND telegram_user_id = $2
         RETURNING *`,
        [eventId, telegramUserId]
      );

      if (result.rowCount > 0) {
        console.log(`✅ Payment recorded for event ${eventId}, user ${telegramUserId}`);
      } else {
        console.warn(`⚠ Could not update payment for event ${eventId}, user ${telegramUserId}`);
      }
    }

    res.status(200).send('Webhook received');
  } catch (err) {
    console.error('❌ Error processing webhook:', err);
    res.status(500).send('Internal Server Error');
  }
}

