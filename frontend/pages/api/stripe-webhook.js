import Stripe from 'stripe';
import { buffer } from 'micro';
import { pool } from '../../lib/postgres';

export const config = { api: { bodyParser: false } };
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  try {
    const event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { eventId, email } = session.metadata;

      await pool.query(
        `UPDATE registrations SET has_paid=true
         WHERE event_id=$1 AND email=$2`,
        [eventId, email]
      );
    }

    res.status(200).send('Received');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}

