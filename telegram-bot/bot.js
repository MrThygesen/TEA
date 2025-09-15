// bot.js

import TelegramBot from 'node-telegram-bot-api';
import pkg from 'pg';
import dotenv from 'dotenv';
import express from 'express';
import { runMigrations } from './migrations.js';
//import { sendEmailVerification } from './lib/sendEmailVerification.js'
import Stripe from 'stripe';

const app = express();
app.use(express.json());


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


// ==== TELEGRAM BOT ====
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
const userStates = {};
// ==============================
// DB HELPERS
// ==============================
// ==============================
// DB HELPERS
// ==============================

// Fetch by email
async function getUserByEmail(email) {
  if (!email) return null;
  const res = await pool.query(
    `SELECT * FROM user_profiles WHERE email=$1 LIMIT 1`,
    [email]
  );
  return res.rows[0] || null;
}

// Fetch by telegram ID
async function getUserByTelegramId(tgId) {
  if (!tgId) return null;
  const res = await pool.query(
    `SELECT * FROM user_profiles WHERE telegram_user_id=$1 LIMIT 1`,
    [tgId]
  );
  return res.rows[0] || null;
}

/**
 * Safe upsert for Telegram + web/email user
 */
async function upsertUser({ tgId, tgUsername, email, webUsername }) {
  if (!email && !tgId) throw new Error("No identifier provided");

  // Attempt to update by Telegram ID first
  if (tgId) {
    const user = await getUserByTelegramId(tgId);
    if (user) {
      await pool.query(
        `UPDATE user_profiles
         SET telegram_username = $1,
             email = COALESCE($2, email),
             updated_at = NOW()
         WHERE id=$3`,
        [tgUsername || user.telegram_username, email, user.id]
      );
      return { ...user, telegram_username: tgUsername || user.telegram_username, email: user.email || email };
    }
  }

  // Attempt to update by email
  if (email) {
    const user = await getUserByEmail(email);
    if (user) {
      // Link Telegram ID if missing
      if (!user.telegram_user_id && tgId) {
        await pool.query(
          `UPDATE user_profiles
           SET telegram_user_id=$1,
               telegram_username=COALESCE($2, telegram_username),
               updated_at=NOW()
           WHERE id=$3`,
          [tgId, tgUsername || null, user.id]
        );
      }
      return { ...user, telegram_user_id: tgId || user.telegram_user_id, telegram_username: tgUsername || user.telegram_username };
    }
  }

  // Insert new or update existing by email (safe)
  const res = await pool.query(
    `INSERT INTO user_profiles (telegram_user_id, telegram_username, email, username)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET
       telegram_user_id = COALESCE(EXCLUDED.telegram_user_id, user_profiles.telegram_user_id),
       telegram_username = COALESCE(EXCLUDED.telegram_username, user_profiles.telegram_username),
       username = COALESCE(EXCLUDED.username, user_profiles.username),
       updated_at = NOW()
     RETURNING *`,
    [tgId || null, tgUsername || null, email || null, webUsername || null]
  );

  return res.rows[0];
}


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

async function ensureUserForTelegram(tgId, username) {
  let user = await getUserByTelegramId(tgId);
  if (!user) {
    user = await createUserWithTelegram(tgId, username);
  } else if (username && user.telegram_username !== username) {
    const upd = await pool.query(
      `UPDATE user_profiles SET telegram_username=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [username, user.id]
    );
    user = upd.rows[0];
  }
  return user;
}

async function getAvailableCities() {
  const res = await pool.query('SELECT DISTINCT city FROM events WHERE datetime > NOW() ORDER BY city ASC');
  return res.rows.map(r => r.city);
}

async function getOpenEventsByCity(city) {
  const res = await pool.query(
    `SELECT id,name,datetime,min_attendees,max_attendees,is_confirmed,price,city
     FROM events
     WHERE datetime > NOW() AND LOWER(city)=LOWER($1)
     ORDER BY datetime ASC`,
    [city]
  );
  return res.rows;
}

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

async function registerUserById(eventId, userId) {
  // Fetch event
  const { rows: eventRows } = await pool.query(
    `SELECT id, name, city, datetime, min_attendees, max_attendees, is_confirmed
     FROM events WHERE id=$1`,
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
    const { rows: already } = await pool.query(
      'SELECT 1 FROM registrations WHERE event_id=$1 AND user_id=$2',
      [eventId, userId]
    );
    if (!already.length) {
      return { statusMsg: '⚠️ Sorry, this event is full.', confirmed: false };
    }
  }

  // Insert registration (idempotent)
  await pool.query(
    `INSERT INTO registrations (event_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (event_id, user_id) DO NOTHING`,
    [eventId, userId]
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

    // Send confirmation emails
    const detailsRes = await pool.query('SELECT name, city, datetime FROM events WHERE id=$1', [eventId]);
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
      await bot.editMessageText(txt, { chat_id: chatId, message_id: messageId }).catch(() => {});
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
    }).catch(() => {});
  } else {
    await bot.sendMessage(chatId, `👥 Attendees for event ID ${eventId}:`, opts);
  }
}

// ==============================
// COMMANDS
// ==============================

// ==============================
// /start command
// ==============================
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  const payload = match?.[1];

  let user = await ensureUserForTelegram(tgId, username);

  // Option E: Telegram-only user without email → prompt via modal (force reply)
  if (!user.email) {
    const prompt = await bot.sendMessage(
      tgId,
      `📧 Welcome ${username || ''}! To enable web login, please provide your email:`,
      { reply_markup: { force_reply: true, input_field_placeholder: 'you@example.com' } }
    );
    userStates[tgId] = { step: 'editingProfile', field: 'email', replyTo: prompt.message_id };
  }

  // Deep-link registration
  if (payload && !isNaN(payload)) {
    const eventId = parseInt(payload, 10);
    const res = await registerUserById(eventId, user.id);
    await bot.sendMessage(tgId, `🔗 Deep link detected: Event ${eventId}\n${res.statusMsg}`);
    return;
  }

  return bot.sendMessage(
    tgId,
    `👋 Hello ${username || 'there'}!\nCommands available:\n` +
    `/events - Browse events\n` +
    `/myevents - Your registrations\n` +
    `/user_edit - Update email & set web password\n` +
    `/help - More commands`
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
const inline_keyboard = cities.map(city => [
  { text: city, callback_data: `city_${encodeURIComponent(city)}` } // encode spaces & special chars
]);
const opts = { reply_markup: { inline_keyboard } };


  bot.sendMessage(chatId, '📍 Select your city:', opts);
});


// ==============================
// /user_edit command
// ==============================
bot.onText(/\/user_edit(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const tgId = String(msg.from.id);
  const tgUsername = msg.from.username || '';
  const inlineEmail = match?.[1]?.trim();

  if (!inlineEmail) {
    const prompt = await bot.sendMessage(
      chatId,
      `📧 Reply with your email to link your web account or update it:`,
      { reply_markup: { force_reply: true, input_field_placeholder: 'you@example.com' } }
    );
    userStates[tgId] = { step: 'editingProfile', field: 'email', replyTo: prompt.message_id };
    return;
  }

  if (!isLikelyEmail(inlineEmail)) {
    return bot.sendMessage(chatId, '❌ Invalid email.');
  }

  // Upsert user safely
  const user = await upsertUser({ tgId, tgUsername, email: inlineEmail });
  await bot.sendMessage(chatId, `✅ Your email is now linked/updated: ${user.email}`);

  // Optional password setup for web login
  if (!user.password_hash) {
    const promptPwd = await bot.sendMessage(
      chatId,
      `🔑 Optional: Set a password for web login (8+ chars). Reply with your desired password or type 'skip':`,
      { reply_markup: { force_reply: true, input_field_placeholder: 'Enter password or skip' } }
    );
    userStates[tgId] = { step: 'editingProfile', field: 'password', replyTo: promptPwd.message_id };
  }

  await sendEmailVerification({ userId: user.id, tgId, email: user.email });
});


// ==============================
// Capture replies for email/password
// ==============================
bot.on('message', async (msg) => {
  const tgId = String(msg.from.id);
  const state = userStates[tgId];
  if (!state || !msg.text) return;
  if (msg.text.startsWith('/')) return;

  // Only accept reply to our prompt
  if (state.replyTo && (!msg.reply_to_message || msg.reply_to_message.message_id !== state.replyTo)) return;

  let user = await getUserByTelegramId(tgId);

  if (state.field === 'email') {
    const email = msg.text.trim();
    if (!isLikelyEmail(email)) return bot.sendMessage(msg.chat.id, '❌ Invalid email.');

    user = await upsertUser({ tgId, tgUsername: msg.from.username || '', email });
    await bot.sendMessage(msg.chat.id, `✅ Linked/updated email: ${user.email}`);

    if (!user.password_hash) {
      const promptPwd = await bot.sendMessage(
        msg.chat.id,
        `🔑 Optional: Set a password for web login (8+ chars) or type 'skip':`,
        { reply_markup: { force_reply: true } }
      );
      userStates[tgId] = { step: 'editingProfile', field: 'password', replyTo: promptPwd.message_id };
    }

    await sendEmailVerification({ userId: user.id, tgId, email: user.email });
    delete userStates[tgId];
  }

  else if (state.field === 'password') {
    const password = msg.text.trim();
    if (password.toLowerCase() === 'skip') {
      await bot.sendMessage(msg.chat.id, 'ℹ️ Password setup skipped.');
      delete userStates[tgId];
      return;
    }

    if (password.length < 8) return bot.sendMessage(msg.chat.id, '❌ Password must be 8+ chars.');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 12);
    await pool.query(`UPDATE user_profiles SET password_hash=$1, updated_at=NOW() WHERE id=$2`, [hash, user.id]);

    await bot.sendMessage(msg.chat.id, '✅ Password set! You can now log in on the web.');
    delete userStates[tgId];
  }
});


// ==============================
// STRIPE WEBHOOK
// ==============================
import bodyParser from 'body-parser';

app.post('/stripe-webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const eventId = session.metadata?.eventId;

      if (userId && eventId) {
        try {
          await pool.query(
            `UPDATE registrations
             SET has_paid = TRUE, updated_at = NOW()
             WHERE user_id = $1 AND event_id = $2`,
            [userId, eventId]
          );

          // ✅ Corrected: fetch tgId & eventName
          const { rows: userRows } = await pool.query(
            'SELECT telegram_user_id FROM user_profiles WHERE id=$1',
            [userId]
          );
          const tgId = userRows[0]?.telegram_user_id;

          const { rows: eventRows } = await pool.query(
            'SELECT name FROM events WHERE id=$1',
            [eventId]
          );
          const eventName = eventRows[0]?.name;

          if (tgId && eventName) {
            await sendPaymentConfirmed(eventId, eventName, tgId);
          }

          console.log(`✅ Payment confirmed for user ${userId}, event ${eventId}`);
        } catch (err) {
          console.error('❌ Error updating payment status:', err);
        }
      }
      break;

    default:
      console.log(`ℹ️ Unhandled Stripe event type: ${event.type}`);
  }

  res.json({ received: true });
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
      `📌 Show this ticket at the entrance/staff.`;

    const buttons = [
      [{ text: '📌 Event Details', callback_data: `details_${e.id}` }],
    ];

    await bot.sendMessage(msg.chat.id, ticketText, {
      reply_markup: { inline_keyboard: buttons },
    });
  }
}); // <-- closing the bot.onText




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
  const city = decodeURIComponent(data.slice(5)); // decode back to original
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
const eventId = parseInt(data.split('_')[1], 10);
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
  payment_method_types: ['card'],
  mode: 'payment',
  line_items: [{
    price_data: {
      currency: 'usd',
      product_data: { name: event.name },
      unit_amount: Math.round(Number(event.price) * 100),
    },
    quantity: 1,
  }],
  success_url: `${FRONTEND_URL}/success?event=${eventId}&user=${user.id}`,
  cancel_url: `${FRONTEND_URL}/cancel?event=${eventId}`,
  metadata: {
    eventId: String(eventId),
    userId: String(user.id),
    telegramId: String(tgId),
  },
  customer_email: user.email || undefined,
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
  const res = await registerUserById(eventId, user.id);

  await bot.sendMessage(
    chatId,
    `📌 Registration for event: ${res.eventName}\n${res.statusMsg}`
  );

  try {
    await bot.answerCallbackQuery(query.id);
  } catch {}
  return;
}

} catch (err) {
  console.error('❌ Callback query error:', err);
  try {
    await bot.answerCallbackQuery(query.id, { text: 'Error occurred ❌', show_alert: true });
  } catch {}
}
}); 


// ==============================
// EXPRESS APP SETUP FOR TELEGRAM WEBHOOK
// ==============================

app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.setWebHook(`${PUBLIC_URL}/webhook/${BOT_TOKEN}`);
app.listen(PORT, () => {
  console.log(`🚀 Bot running on port ${PORT}`);
//export default bot;
});  
