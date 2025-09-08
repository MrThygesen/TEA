// bot.js
import TelegramBot from 'node-telegram-bot-api';
import pkg from 'pg';
import dotenv from 'dotenv';
import express from 'express';
import { runMigrations } from './migrations.js';
import Stripe from 'stripe';
import crypto from 'crypto';


import {
  sendEmailVerification,
  sendEventConfirmed,
  sendPaymentConfirmed,
  isLikelyEmail,
} from "./email.js";


dotenv.config();
const { Pool } = pkg;

// ==== CONFIG ====
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) { console.error('❌ TELEGRAM_BOT_TOKEN missing'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL missing'); process.exit(1); }

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || 'https://edgy-dpnv.onrender.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Run migrations
await runMigrations();
console.log('✅ Database migrations complete.');

// ==== EXPRESS ====
const app = express();
app.use(express.json());

// ==== TELEGRAM BOT ====
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
const userStates = {};

// ==============================
// DB HELPERS (NEW SCHEMA: user_id)
// ==============================

/**
 * Get user row by telegram_user_id
 * @param {string} tgId
 * @returns user_profiles row or null
 */
async function getUserByTelegramId(tgId) {
  const res = await pool.query(
    'SELECT * FROM user_profiles WHERE telegram_user_id = $1',
    [tgId]
  );
  return res.rows[0] || null;
}

/**
 * Create a user row pre-populated with Telegram info (email optional).
 * Returns the created row.
 */
async function createUserWithTelegram(tgId, username, email = null) {
  const res = await pool.query(
    `INSERT INTO user_profiles (telegram_user_id, telegram_username, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_user_id) DO UPDATE SET
       telegram_username = EXCLUDED.telegram_username,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [tgId, username || null, email || null]
  );
  return res.rows[0];
}

/**
 * Ensure we have a user row for this Telegram user.
 * Returns user row with a valid integer "id".
 */
async function ensureUserForTelegram(tgId, username) {
  let user = await getUserByTelegramId(tgId);
  if (!user) {
    user = await createUserWithTelegram(tgId, username);
  } else if (username && user.telegram_username !== username) {
    // keep username in sync
    const upd = await pool.query(
      `UPDATE user_profiles SET telegram_username = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [username, user.id]
    );
    user = upd.rows[0];
  }
  return user; // has .id (PK), .telegram_user_id (optional)
}

/**
 * Get available cities for upcoming events
 */
async function getAvailableCities() {
  const res = await pool.query(
    'SELECT DISTINCT city FROM events WHERE datetime > NOW() ORDER BY city ASC'
  );
  return res.rows.map(r => r.city);
}

/**
 * Get open events by city
 */
async function getOpenEventsByCity(city) {
  const res = await pool.query(
    `SELECT id,name,datetime,min_attendees,max_attendees,is_confirmed,price
     FROM events
     WHERE datetime > NOW() AND LOWER(city)=LOWER($1)
     ORDER BY datetime ASC`,
    [city]
  );
  return res.rows;
}

/**
 * Get a user's events by user_id
 */
async function getUserEventsByUserId(userId) {
  const res = await pool.query(
    `SELECT e.id, e.name, e.datetime, e.price, r.has_paid
     FROM registrations r
     JOIN events e ON r.event_id = e.id
     WHERE r.user_id = $1
     ORDER BY e.datetime ASC`,
    [userId]
  );
  return res.rows;
}

/**
 * Register a user (by user_id) for an event.
 * Stores telegram_username/email/wallet if provided.
 * Confirms event if min_attendees reached.
 */
async function registerUserById(eventId, userId, telegramUsername, email, wallet) {
  // Fetch event
  const { rows: eventRows } = await pool.query(
    `SELECT id, name, city, datetime, min_attendees, max_attendees, is_confirmed
     FROM events WHERE id = $1`,
    [eventId]
  );
  const event = eventRows[0];
  if (!event) return { statusMsg: '⚠️ Event not found.', confirmed: false };

  // Count existing registrations
  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1',
    [eventId]
  );
  const count = countRows[0]?.count ?? 0;

  // Check capacity
  if (event.max_attendees && count >= event.max_attendees) {
    // But also check if this user is already registered (ON CONFLICT later would no-op)
    const { rows: already } = await pool.query(
      'SELECT 1 FROM registrations WHERE event_id=$1 AND user_id=$2',
      [eventId, userId]
    );
    if (!already.length) {
      return { statusMsg: '⚠️ Sorry, this event is full.', confirmed: false };
    }
  }

  // Insert (idempotent by unique (event_id, user_id))
  await pool.query(
    `INSERT INTO registrations (event_id, user_id, telegram_username, email, wallet_address)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (event_id, user_id) DO NOTHING`,
    [eventId, userId, telegramUsername || null, email || null, wallet || null]
  );

  // New count
  const { rows: newCountRows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1',
    [eventId]
  );
  const newCount = newCountRows[0]?.count ?? 0;

  let statusMsg = newCount !== count
    ? `👥 ${newCount} people registered.`
    : `ℹ️ You have already registered.\n👥 ${newCount} people registered.`;

  // Confirm event when threshold reached
  if (!event.is_confirmed && newCount >= event.min_attendees) {
    await pool.query('UPDATE events SET is_confirmed=TRUE WHERE id=$1', [eventId]);
    statusMsg += '\n✅ Event now confirmed!';

    // Send confirmation to all registered users via email helper
    const detailsRes = await pool.query(
      'SELECT name, city, datetime FROM events WHERE id=$1',
      [eventId]
    );
    const details = detailsRes.rows[0];
    const dtString = details ? new Date(details.datetime).toLocaleString() : '';
    await sendEventConfirmed(eventId, details.name, details.city, dtString);
  } else if (!event.is_confirmed) {
    statusMsg += '\n⌛ Awaiting confirmation.';
  } else {
    statusMsg += '\n✅ Already confirmed.';
  }

  return { confirmed: newCount >= event.min_attendees, eventName: event.name, statusMsg };
}

/**
 * Show attendees for an organizer (uses new registrations.user_id)
 */
async function showAttendees(chatId, eventId, messageId = null) {
  const { rows: regs } = await pool.query(
    `SELECT r.id, u.telegram_username,
            r.has_arrived, r.voucher_applied,
            r.basic_perk_applied, r.advanced_perk_applied
     FROM registrations r
     JOIN user_profiles u ON u.id = r.user_id
     WHERE r.event_id=$1
     ORDER BY r.id ASC`,
    [eventId]
  );

  if (!regs.length) {
    const txt = '📭 No attendees yet.';
    if (messageId) {
      await bot.editMessageText(txt, { chat_id: chatId, message_id: messageId }).catch(()=>{});
    } else {
      await bot.sendMessage(chatId, txt);
    }
    return;
  }

  const headerRow = [
    { text: 'Guest', callback_data: 'noop_header_guest' },
    { text: 'Arr', callback_data: 'noop_header_arr' },
    { text: 'Vouch', callback_data: 'noop_header_vouch' },
    { text: 'Basic', callback_data: 'noop_header_basic' },
    { text: 'Advance', callback_data: 'noop_header_advance' },
  ];

  const attendeeRows = regs.map(r => ([
    { text: r.telegram_username ? `@${r.telegram_username}` : 'user', callback_data: `noop_${r.id}` },
    { text: r.has_arrived ? '✅' : '❌', callback_data: `toggle_${r.id}_has_arrived` },
    { text: r.voucher_applied ? '✅' : '❌', callback_data: `toggle_${r.id}_voucher_applied` },
    { text: r.basic_perk_applied ? '✅' : '❌', callback_data: `toggle_${r.id}_basic_perk_applied` },
    { text: r.advanced_perk_applied ? '✅' : '❌', callback_data: `toggle_${r.id}_advanced_perk_applied` },
  ]));

  const inline_keyboard = [headerRow, ...attendeeRows];
  const opts = { reply_markup: { inline_keyboard } };

  if (messageId) {
    await bot.editMessageText(`👥 Attendees for event ID ${eventId}:`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: opts.reply_markup
    }).catch(()=>{});
  } else {
    await bot.sendMessage(chatId, `👥 Attendees for event ID ${eventId}:`, opts);
  }
}

// ==============================
// COMMANDS
// ==============================

bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  const payload = match?.[1];

  const user = await ensureUserForTelegram(tgId, username);

  if (payload && !isNaN(payload)) {
    const eventId = parseInt(payload, 10);
    const res = await registerUserById(eventId, user.id, user.telegram_username, user.email, user.wallet_address);
    return bot.sendMessage(msg.chat.id, `🔗 Deep link detected: Event ${eventId}\n${res.statusMsg}`);
  }

  return bot.sendMessage(
    msg.chat.id,
    `👋 Welcome ${username || 'there'}! Use /events to see events, /myevents for your registrations, /user_edit to add email, /help for commands.`
  );
});

bot.onText(/\/help/, async (msg) => {
  bot.sendMessage(msg.chat.id,
`ℹ️ Commands:
- /start - Welcome message
- /help - This message
- /events - List events by city
- /myevents - Your registered events
- /ticket - Show your ticket
- /user_edit - Add/update email (verification sent)
- /myid - Show your Telegram ID
- /event_admin - Organizer dashboard`);
});

bot.onText(/\/myid/, async (msg) => {
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  bot.sendMessage(msg.chat.id, `🆔 Your Telegram ID: ${tgId}\nUsername: @${username}`);
});

bot.onText(/\/events/, async (msg) => {
  const chatId = msg.chat.id;
  const cities = await getAvailableCities();
  if (!cities.length) return bot.sendMessage(chatId, '📭 No upcoming events.');
  const opts = { reply_markup: { inline_keyboard: cities.map(city => [{ text: city, callback_data: `city_${city}` }]) } };
  bot.sendMessage(chatId, '📍 Select your city:', opts);
});

// /user_edit (email) — leaves verification flow intact (by telegram_user_id)
bot.onText(/\/user_edit(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  const user = await ensureUserForTelegram(tgId, username);

  const inlineEmail = match?.[1]?.trim();
  if (inlineEmail) {
    if (!isLikelyEmail(inlineEmail)) {
      return bot.sendMessage(chatId, '❌ Invalid email. Must include "@" and "."');
    }

    await pool.query(
      `UPDATE user_profiles SET email=$1, updated_at=NOW() WHERE id=$2`,
      [inlineEmail, user.id]
    );
    // Keep your helper contract: verification still by telegram_user_id (your table)
    await sendEmailVerification(tgId, inlineEmail);

    return bot.sendMessage(chatId, `✅ Email updated to: ${inlineEmail}. Please check your inbox to verify.`);
  }

  const prompt = await bot.sendMessage(
    chatId,
    `📧 Current email: ${user?.email || 'N/A'}\nReply to this message with your new email (must include '@' and '.').`,
    { reply_markup: { force_reply: true, input_field_placeholder: 'you@example.com' } }
  );

  userStates[tgId] = { step: 'editingProfile', field: 'email', replyTo: prompt.message_id };
});

bot.onText(/\/cancel/, async (msg) => {
  const tgId = String(msg.from.id);
  delete userStates[tgId];
  bot.sendMessage(msg.chat.id, '✖️ Email update canceled.');
});

// Capture reply to /user_edit prompt
bot.on('message', async (msg) => {
  const tgId = String(msg.from.id);
  const state = userStates[tgId];
  if (!state) return;
  if (!msg.text) return;
  if (msg.text.startsWith('/')) return;

  if (state.replyTo && (!msg.reply_to_message || msg.reply_to_message.message_id !== state.replyTo)) {
    return;
  }

  if (state.field === 'email') {
    const email = msg.text.trim();
    if (!isLikelyEmail(email)) {
      return bot.sendMessage(msg.chat.id, '❌ Invalid email. Please include both "@" and "."');
    }
    const user = await ensureUserForTelegram(tgId, msg.from.username || '');
    await pool.query(
      `UPDATE user_profiles SET email=$1, updated_at=NOW() WHERE id=$2`,
      [email, user.id]
    );
    await sendEmailVerification(tgId, email);
    delete userStates[tgId];
    bot.sendMessage(msg.chat.id, `✅ Email updated to: ${email}. Please check your inbox to verify.`);
  }
});

bot.onText(/\/myevents/, async (msg) => {
  const tgId = String(msg.from.id);
  const user = await ensureUserForTelegram(tgId, msg.from.username || '');
  const events = await getUserEventsByUserId(user.id);
  if (!events.length) {
    return bot.sendMessage(msg.chat.id, '📭 You are not registered for any events.');
  }

  for (const e of events) {
    const dateStr = new Date(e.datetime).toLocaleString();
    const text = `📅 ${e.name} — ${dateStr} — ${e.price ? `${e.price} USD` : 'Free'}\n` +
                 `Status: ${e.has_paid ? '✅ Paid' : '💳 Not Paid'}`;

    const buttons = [
      [{ text: '📄 Details', callback_data: `details_${e.id}` }],
      [{ text: '❌ Deregister', callback_data: `deregister_${e.id}` }],
    ];

    if (e.price && !e.has_paid) {
      buttons.push([{ text: '💳 Pay Now', callback_data: `pay_${e.id}` }]);
    }

    await bot.sendMessage(msg.chat.id, text, { reply_markup: { inline_keyboard: buttons } });
  }
});

bot.onText(/\/ticket/, async (msg) => {
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  const user = await ensureUserForTelegram(tgId, username);
  const events = await getUserEventsByUserId(user.id);
  if (!events.length) {
    return bot.sendMessage(msg.chat.id, '📭 Not registered for any events.');
  }

  const paidEvents = events.filter(e => e.has_paid);
  if (!paidEvents.length) {
    return bot.sendMessage(msg.chat.id, '💳 You have not completed payment for any events yet.');
  }

  for (const e of paidEvents) {
    const dateStr = new Date(e.datetime).toLocaleString();
    const ticketText =
      `🎫 Ticket for event: ${e.name}\n` +
      `🆔 Ticket ID: ${e.id}\n` +
      `👤 Username: @${username}\n` +
      `📅 Date/Time: ${dateStr}\n` +
      `💰 Price: ${e.price ? `${e.price} USD` : 'Free'}\n` +
      `📌 Show this ticket at the entrance/staff.\n` +
      `/event_detail_${e.id}`;
    await bot.sendMessage(msg.chat.id, ticketText);
  }
});

bot.onText(/\/event_detail_(\d+)/, async (msg, match) => {
  const eventId = parseInt(match[1], 10);
  const res = await pool.query('SELECT * FROM events WHERE id=$1', [eventId]);
  const event = res.rows[0];
  if (!event) return bot.sendMessage(msg.chat.id, '⚠️ Event not found.');
  const dateStr = new Date(event.datetime).toLocaleString();
  const text = `📌 Event: ${event.name}\nCity: ${event.city}\nDate/Time: ${dateStr}\nMin/Max attendees: ${event.min_attendees}/${event.max_attendees}\nConfirmed: ${event.is_confirmed ? '✅' : '⌛'}\nDescription: ${event.description || 'N/A'}\nVenue: ${event.venue || 'N/A'}\nBasic perk: ${event.basic_perk || 'N/A'}\nAdvanced perk: ${event.advanced_perk || 'N/A'}`;
  bot.sendMessage(msg.chat.id, text);
});

bot.onText(/\/event_admin/, async (msg) => {
  const chatId = msg.chat.id;
  const tgId = String(msg.from.id);
  const user = await ensureUserForTelegram(tgId, msg.from.username || '');

  try {
    if (!user || user.role !== 'organizer') {
      return bot.sendMessage(chatId, '❌ You are not assigned as an organizer.');
    }

    const groupId = user.group_id;
    if (!groupId) {
      return bot.sendMessage(chatId, '❌ You are not assigned to any group. Ask admin to assign you.');
    }

    const { rows: events } = await pool.query(
      `SELECT e.id, e.name, e.datetime, e.is_confirmed, e.min_attendees,
              COUNT(r.id) FILTER (WHERE r.has_arrived = TRUE) AS arrived_count
       FROM events e
       LEFT JOIN registrations r ON r.event_id = e.id
       WHERE e.group_id = $1
       GROUP BY e.id
       ORDER BY e.datetime ASC`,
      [groupId]
    );

    if (!events.length) {
      return bot.sendMessage(chatId, '📭 No events for your group yet.');
    }

    for (const e of events) {
      const dateStr = new Date(e.datetime).toLocaleString();
      const keyboard = [
        [{ text: '👥 Show Attendees', callback_data: `showattendees_${e.id}` }],
      ];

      if (Number(e.arrived_count) >= Number(e.min_attendees)) {
        keyboard.push([{ text: '🎁 Activate Perks', callback_data: `activate_perks_${e.id}` }]);
      } else {
        keyboard.push([{
          text: `⏳ Perks locked: ${e.arrived_count}/${e.min_attendees} arrived`,
          callback_data: 'noop_perks_locked'
        }]);
      }

      await bot.sendMessage(
        chatId,
        `📅 ${e.name} — ${dateStr}\nConfirmed: ${e.is_confirmed ? '✅' : '⌛'}`,
        { reply_markup: { inline_keyboard: keyboard } }
      );
    }
  } catch (err) {
    console.error('❌ /event_admin error:', err);
    bot.sendMessage(chatId, '❌ Failed to fetch your events. Try again later.');
  }
});

// ==============================
// CALLBACK QUERIES
// ==============================
bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const tgId = String(query.from.id);

  try {
    if (data.startsWith('noop_')) {
      try { await bot.answerCallbackQuery(query.id); } catch {}
      return;
    }

    if (data.startsWith('city_')) {
      const city = data.split('_')[1];
      const events = await getOpenEventsByCity(city);
      if (!events.length) return bot.sendMessage(chatId, `📭 No upcoming events in ${city}.`);

      const opts = { reply_markup: { inline_keyboard: [] } };
      let text = `📅 Upcoming events in ${city}:\n`;

      events.forEach(e => {
        const dateStr = new Date(e.datetime).toLocaleString();
        text += `\n• ${e.name} — ${dateStr} — ${e.price ? `${e.price} USD` : 'Free'}`;
        opts.reply_markup.inline_keyboard.push([
          { text: 'Details', callback_data: `details_${e.id}` },
          { text: 'Register', callback_data: `register_${e.id}` }
        ]);
      });

      await bot.sendMessage(chatId, text, opts);
      return;
    }

    // --- PAY (Stripe) ---
    if (data.startsWith('pay_')) {
      const eventId = data.split('_')[1];
      try {
        const { rows } = await pool.query('SELECT name, price FROM events WHERE id=$1', [eventId]);
        if (!rows.length) {
          await bot.answerCallbackQuery(query.id, { text: 'Event not found ❌', show_alert: true });
          return;
        }
        const event = rows[0];

        // Ensure user row
        const user = await ensureUserForTelegram(tgId, query.from.username || '');

        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: { name: event.name },
              unit_amount: Math.round(Number(event.price) * 100),
            },
            quantity: 1,
          }],
          success_url: `${FRONTEND_URL}/success?event=${eventId}`,
          cancel_url: `${FRONTEND_URL}/cancel?event=${eventId}`,
          metadata: { eventId: String(eventId), userId: String(user.id), telegramId: String(chatId) },
        });

        await bot.sendMessage(chatId, `💳 Complete your payment here:\n${session.url}`);
        await bot.answerCallbackQuery(query.id);
      } catch (err) {
        console.error('Stripe error:', err);
        await bot.answerCallbackQuery(query.id, { text: 'Payment setup failed ⚠️', show_alert: true });
      }
      return;
    }

    // --- TOGGLE (organizer only) ---
    if (data.startsWith('toggle_')) {
      const user = await ensureUserForTelegram(tgId, query.from.username || '');
      if (user?.role !== 'organizer') {
        try {
          await bot.answerCallbackQuery(query.id, { text: 'Organizer role required', show_alert: true });
        } catch {}
        return;
      }

      const parts = data.split('_');
      const regId = parseInt(parts[1], 10);
      const field = parts.slice(2).join('_');

      const allowedFields = ['has_arrived', 'voucher_applied', 'basic_perk_applied', 'advanced_perk_applied'];
      if (!allowedFields.includes(field)) return;

      const currentRes = await pool.query(`SELECT ${field} FROM registrations WHERE id=$1`, [regId]);
      if (!currentRes.rows.length) return;
      const current = currentRes.rows[0][field];
      const newValue = !current;

      await pool.query(`UPDATE registrations SET ${field}=$1 WHERE id=$2`, [newValue, regId]);

      const eventRes = await pool.query('SELECT event_id FROM registrations WHERE id=$1', [regId]);
      const eventId = eventRes.rows[0]?.event_id;
      if (!eventId) return;

      await showAttendees(chatId, eventId, query.message.message_id);

      try { await bot.answerCallbackQuery(query.id); } catch {}
      return;
    }

    // --- DETAILS ---
    if (data.startsWith('details_')) {
      const eventId = parseInt(data.split('_')[1], 10);
      const res = await pool.query('SELECT * FROM events WHERE id=$1', [eventId]);
      const event = res.rows[0];
      if (!event) {
        await bot.sendMessage(chatId, '⚠️ Event not found.');
        return;
      }
      const dateStr = new Date(event.datetime).toLocaleString();
      const text = `📌 Event: ${event.name}\nCity: ${event.city}\nDate/Time: ${dateStr}\nMin/Max attendees: ${event.min_attendees}/${event.max_attendees}\nConfirmed: ${event.is_confirmed ? '✅' : '⌛'}\nDescription: ${event.description || 'N/A'}\nVenue: ${event.venue || 'N/A'}\nBasic perk: ${event.basic_perk || 'N/A'}\nAdvanced perk: ${event.advanced_perk || 'N/A'}`;
      await bot.sendMessage(chatId, text);
      return;
    }

    // --- REGISTER ---
    if (data.startsWith('register_')) {
      const eventId = parseInt(data.split('_')[1], 10);
      const user = await ensureUserForTelegram(tgId, query.from.username || '');
      const res = await registerUserById(eventId, user.id, user.telegram_username, user.email, user.wallet_address);
      await bot.sendMessage(chatId, res.statusMsg);
      return;
    }

    // --- SHOW ATTENDEES (organizer only) ---
    if (data.startsWith('showattendees_')) {
      const user = await ensureUserForTelegram(tgId, query.from.username || '');
      if (user?.role !== 'organizer') {
        try {
          await bot.answerCallbackQuery(query.id, { text: 'Organizer role required', show_alert: true });
        } catch {}
        return;
      }
      const eventId = parseInt(data.split('_')[1], 10);
      await showAttendees(chatId, eventId);
      return;
    }
  } catch (error) {
    console.error('Callback query error:', error);
    await bot.answerCallbackQuery(query.id, { text: '⚠️ Something went wrong', show_alert: true });
  }
});

// ==============================
// EXPRESS WEBHOOK
// ==============================
app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.setWebHook(`${PUBLIC_URL}/webhook/${BOT_TOKEN}`);
app.listen(PORT, () => console.log(`🚀 Bot running on port ${PORT}`));

/**
 * OPTIONAL: Stripe webhook (if you want to auto-mark r.has_paid=true)
 * Be sure to set STRIPE_WEBHOOK_SECRET; otherwise you can mark payment in your frontend success handler.
 *
 * Example:
 *
 * app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
 *   const sig = req.headers['stripe-signature'];
 *   let event;
 *   try {
 *     event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
 *   } catch (err) {
 *     console.error('Webhook signature verification failed.', err.message);
 *     return res.sendStatus(400);
 *   }
 *   if (event.type === 'checkout.session.completed') {
 *     const session = event.data.object;
 *     const eventId = parseInt(session.metadata.eventId, 10);
 *     const userId = parseInt(session.metadata.userId, 10);
 *     await pool.query(
 *       'UPDATE registrations SET has_paid=TRUE, paid_at=NOW() WHERE event_id=$1 AND user_id=$2',
 *       [eventId, userId]
 *     );
 *     try { await sendPaymentConfirmed(userId, eventId); } catch {}
 *   }
 *   res.sendStatus(200);
 * });
 */

