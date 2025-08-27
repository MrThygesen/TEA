import Stripe from 'stripe';
import { buffer } from 'micro';
import { pool } from '../../lib/postgres.js';
import fetch from 'node-fetch';

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  try {
    const event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const telegramChatId = session.metadata?.telegram_chat_id;
      const eventId = session.metadata?.event_id;

      // Update database
      await pool.query(
        `UPDATE registrations 
         SET has_paid = true
         WHERE event_id = $1 AND telegram_user_id = $2`,
        [eventId, telegramChatId]
      );

      // Optionally trigger bot notification via Render API
      await fetch(`${process.env.RENDER_API_BASE}/notify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_chat_id: telegramChatId,
          event_id: eventId,
        }),
      });

      console.log(`✅ Payment confirmed for event ${eventId}, user ${telegramChatId}`);
    }

    res.status(200).send('Webhook received');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}

