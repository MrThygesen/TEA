import Stripe from 'stripe';
import { buffer } from 'micro';
import { pool } from '../../lib/postgres.js';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  try {
    const event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      const telegramUserId = session.metadata?.telegram_user_id;
      const eventId = session.metadata?.event_id;

      if (telegramUserId && eventId) {
        await pool.query(
          `UPDATE registrations 
           SET has_paid = TRUE, paid_at = NOW()
           WHERE event_id = $1 AND telegram_user_id = $2`,
          [eventId, telegramUserId]
        );

        console.log(`✅ Payment confirmed for event ${eventId}, user ${telegramUserId}`);
      } else {
        console.warn('⚠ Missing metadata for session:', session.id);
      }
    }

    res.status(200).send('Webhook received');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}

