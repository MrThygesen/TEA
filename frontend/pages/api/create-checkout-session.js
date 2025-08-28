// pages/api/create-checkout-session.js
import Stripe from 'stripe';
import { pool } from '../../lib/postgres.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { eventId, email, telegramUserId } = req.body;

    if (!eventId || !telegramUserId || !email) {
      return res.status(400).json({ error: 'Missing required fields: eventId, email, telegramUserId' });
    }

    // Fetch event details
    const { rows } = await pool.query('SELECT name, price FROM events WHERE id = $1', [eventId]);
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });

    const event = rows[0];

    // Ensure registration exists
    await pool.query(
      `INSERT INTO registrations (event_id, telegram_user_id, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id, telegram_user_id) DO NOTHING`,
      [eventId, telegramUserId, email]
    );

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: event.name },
          unit_amount: Math.round(Number(event.price) * 100),
        },
        quantity: 1,
      }],
      success_url: `${process.env.FRONTEND_URL}/success?event=${eventId}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel?event=${eventId}`,
      metadata: {
        telegram_user_id: telegramUserId,
        event_id: eventId,
        email
      },
    });

    res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('[create-checkout-session] Error:', err);
    res.status(500).json({ error: 'Payment session creation failed', details: err.message });
  }
}

