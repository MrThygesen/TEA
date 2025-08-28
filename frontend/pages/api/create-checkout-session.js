// pages/api/create-checkout-session.js
import Stripe from 'stripe';
import { pool } from '../../lib/postgres.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { eventId, telegramUserId, telegramUsername, email } = req.body;

  if (!eventId || !telegramUserId || !email) {
    return res.status(400).json({ error: 'Missing required fields: eventId, telegramUserId, email' });
  }

  try {
    // 1️⃣ Ensure registration row exists
    await pool.query(
      `INSERT INTO registrations (event_id, telegram_user_id, telegram_username, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id, telegram_user_id) DO NOTHING`,
      [eventId, telegramUserId, telegramUsername || null, email]
    );

    // 2️⃣ Fetch event details
    const { rows } = await pool.query('SELECT name, price FROM events WHERE id=$1', [eventId]);
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });

    const event = rows[0];

    // 3️⃣ Create Stripe checkout session
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
        event_id: eventId,
        telegram_user_id: telegramUserId,  // webhook reads this exact key
        email
      },
    });

    res.status(200).json({ id: session.id, url: session.url });

  } catch (err) {
    console.error('[create-checkout-session] Error:', err);
    res.status(500).json({ error: 'Payment session failed', details: err.message });
  }
}

