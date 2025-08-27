import Stripe from 'stripe';
import { pool } from '../../lib/postgres';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { eventId, email } = req.body;
  try {
    // Fetch event details from DB
    const { rows } = await pool.query('SELECT name, price FROM events WHERE id=$1', [eventId]);
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });

    const event = rows[0];

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: event.name },
          unit_amount: Math.round(Number(event.price) * 100), // convert to cents
        },
        quantity: 1,
      }],
      success_url: `${process.env.FRONTEND_URL}/success?event=${eventId}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel?event=${eventId}`,
      metadata: { eventId, email },
    });

    res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Payment session failed' });
  }
}

