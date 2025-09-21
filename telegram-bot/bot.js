// bot.js
import TelegramBot from 'node-telegram-bot-api';
import pkg from 'pg';
import dotenv from 'dotenv';
import express from 'express';
import { runMigrations } from './migrations.js';
import Stripe from 'stripe';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import bodyParser from 'body-parser';

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

async function getWebUserByEmail(email) {
  if (!email) return null;
  const res = await pool.query(`SELECT * FROM user_profiles WHERE email=$1 LIMIT 1`, [email]);
  return res.rows[0] || null;
}

async function getTgUserById(tgId) {
  if (!tgId) return null;
  const res = await pool.query(`SELECT * FROM telegram_user_profiles WHERE username=$1 OR id::text=$1 LIMIT 1`, [tgId]);
  return res.rows[0] || null;
}

// -----------------------------
// Safe upsert for Telegram user
// -----------------------------
async function upsertTelegramUser({ tgId, tgUsername, email }) {
  if (!tgId) throw new Error("No Telegram ID provided");

  const existing = await getTgUserById(tgId);

  if (existing) {
    const res = await pool.query(
      `UPDATE telegram_user_profiles
       SET username = COALESCE($1, username),
           email = COALESCE($2, email),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *;`,
      [tgUsername || null, email || null, existing.id]
    );
    return res.rows[0];
  }

  const res = await pool.query(
    `INSERT INTO telegram_user_profiles (username, email)
     VALUES ($1, $2)
     RETURNING *;`,
    [tgUsername || null, email || null]
  );
  return res.rows[0];
}

async function ensureTelegramUser(tgId, tgUsername) {
  let user = await getTgUserById(tgId);
  if (!user) {
    user = await upsertTelegramUser({ tgId, tgUsername });
  } else if (tgUsername && user.username !== tgUsername) {
    const upd = await pool.query(
      `UPDATE telegram_user_profiles SET username=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [tgUsername, user.id]
    );
    user = upd.rows[0];
  }
  return user;
}

// -----------------------------
// Events + Registrations
// -----------------------------
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

async function getUserEvents(userId, tgId) {
  const res = await pool.query(
    `SELECT e.id, e.name, e.datetime, e.price, r.has_paid
     FROM registrations r
     JOIN events e ON r.event_id = e.id
     WHERE r.user_id = $1 OR r.telegram_user_id = $2
     ORDER BY e.datetime ASC`,
    [userId || null, tgId || null]
  );
  return res.rows;
}

import crypto from "crypto"; // already imported at top

async function registerUserById(eventId, userId = null, tgId = null) {
  const { rows: eventRows } = await pool.query(
    `SELECT id, name, city, datetime, min_attendees, max_attendees, is_confirmed
     FROM events WHERE id=$1`,
    [eventId]
  );
  const event = eventRows[0];
  if (!event) return { statusMsg: '⚠️ Event not found.', confirmed: false };

  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1',
    [eventId]
  );
  const count = countRows[0]?.count ?? 0;

  if (event.max_attendees && count >= event.max_attendees) {
    return { statusMsg: '⚠️ Sorry, this event is full.', confirmed: false };
  }

  // Always generate a ticket_code at registration
  const ticketCode = `ticket:${event.id}:${userId || tgId}:${crypto.randomUUID()}`;

  await pool.query(
    `INSERT INTO registrations (event_id, user_id, telegram_user_id, ticket_code)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_id, user_id, telegram_user_id) DO NOTHING`,
    [eventId, userId || null, tgId || null, ticketCode]
  );

  const { rows: newCountRows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1',
    [eventId]
  );
  const newCount = newCountRows[0]?.count ?? 0;

  let statusMsg = newCount !== count
    ? `👥 ${newCount} people registered.`
    : `ℹ️ You have already registered.\n👥 ${newCount} people registered.`;

  if (!event.is_confirmed && newCount >= event.min_attendees) {
    await pool.query('UPDATE events SET is_confirmed=TRUE WHERE id=$1', [eventId]);
    statusMsg += '\n✅ Event now confirmed!';
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
    `SELECT r.id,
            COALESCE(u.telegram_username, u.username, tu.username, 'user') AS display_name,
            r.has_arrived, r.voucher_applied,
            r.basic_perk_applied, r.advanced_perk_applied
     FROM registrations r
     LEFT JOIN user_profiles u ON u.id = r.user_id
     LEFT JOIN telegram_user_profiles tu ON tu.id = r.telegram_user_id
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

  const attendeeRows = regs.map(r => ([
  ];
    { text: r.display_name, callback_data: `noop_${r.id}` },
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


// -----------------------------
// /events command
// -----------------------------
bot.onText(/\/events/, async (msg) => {
  const chatId = msg.chat.id;
  const cities = await getAvailableCities();

  if (!cities.length) {
    return bot.sendMessage(chatId, "📭 No upcoming events available.");
  }

  const keyboard = cities.map(city => ([{ text: city, callback_data: `city_${city}` }]));
  bot.sendMessage(chatId, "🌍 Choose a city to see upcoming events:", {
    reply_markup: { inline_keyboard: keyboard }
  });
});

// Handle city selection
bot.on("callback_query", async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;

  if (data.startsWith("city_")) {
    const city = data.replace("city_", "");
    const events = await getOpenEventsByCity(city);

    if (!events.length) {
      return bot.sendMessage(chatId, `📭 No upcoming events in ${city}.`);
    }

    for (const e of events) {
      const dateStr = new Date(e.datetime).toLocaleString();

      // Determine button label based on stage
      let buttonText = "✍️ Guestlist";
      if (e.is_confirmed && e.price > 0) buttonText = "💳 Pay Access";
      else if (e.is_confirmed && e.price == 0) buttonText = "✅ Confirm Access";

      const inline_keyboard = [[
        { text: buttonText, callback_data: `register_${e.id}` }
      ]];

      await bot.sendMessage(chatId,
        `📌 *${e.name}*\n📅 ${dateStr}\n🏙 ${e.city}\n💰 ${e.price > 0 ? e.price + " USD" : "Free"}\n👥 Min: ${e.min_attendees}, Max: ${e.max_attendees || "∞"}\n${e.is_confirmed ? "✅ Confirmed" : "⌛ Not confirmed yet"}`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard } }
      );
    }
  }
});



// -----------------------------
// /myevents command
// -----------------------------
bot.onText(/\/myevents/, async (msg) => {
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  const user = await ensureTelegramUser(tgId, username);

  const myEvents = await getUserEvents(null, user.id);
  if (!myEvents.length) {
    return bot.sendMessage(msg.chat.id, "📭 You have not joined any events yet.");
  }

  for (const e of myEvents) {
    const dateStr = new Date(e.datetime).toLocaleString();

    let status = "✍️ On Guestlist";
    let buttonText = null;

    if (e.has_paid) {
      status = "🎟 Ticket booked";
      buttonText = "🎟 My Ticket";
    } else if (e.price > 0 && e.is_confirmed) {
      status = "💳 Payment required";
      buttonText = "💳 Pay Access";
    } else if (e.price == 0 && e.is_confirmed) {
      status = "✅ Confirmed access";
      buttonText = "✅ Confirm Access";
    }

    const inline_keyboard = buttonText ? [[{ text: buttonText, callback_data: `register_${e.id}` }]] : [];

    await bot.sendMessage(msg.chat.id,
      `📌 *${e.name}*\n📅 ${dateStr}\n💰 ${e.price > 0 ? e.price + " USD" : "Free"}\n📍 ${e.city}\nStatus: ${status}`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard } }
    );
  }
});



bot.onText(/\/ticket/, async (msg) => {
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  const user = await ensureTelegramUser(tgId, username);

  // Fetch paid events for this user
  const { rows: events } = await pool.query(
    `SELECT e.id, e.name, e.datetime, e.price, r.ticket_code
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     WHERE r.telegram_user_id = $1 AND r.has_paid = TRUE
     ORDER BY e.datetime ASC`,
    [user.id]
  );

  if (!events.length) {
    return bot.sendMessage(msg.chat.id, '💳 You have not completed payment for any events yet.');
  }

for (const e of events) {
  const dateStr = new Date(e.datetime).toLocaleString();

  // ticket_code is guaranteed
  const ticketCode = e.ticket_code;

  const qrBuffer = await QRCode.toBuffer(ticketCode, { width: 300 });

  const caption =
    `🎫 Ticket for event: ${e.name}\n` +
    `🆔 Ticket: ${ticketCode}\n` +
    `👤 User: @${username}\n` +
    `📅 ${dateStr}\n` +
    `💰 ${e.price ? `${e.price} USD` : 'Free'}`;

  await bot.sendPhoto(msg.chat.id, qrBuffer, { caption });
}
});


// ==============================
// EXPRESS + STRIPE
// ==============================
const app = express();
app.use(express.json());

app.post('/stripe-webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Stripe webhook verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const tgId = session.metadata?.telegramId;
    const eventId = session.metadata?.eventId;

    if (eventId) {
      await pool.query(
        `UPDATE registrations
         SET has_paid = TRUE, updated_at = NOW()
         WHERE (user_id = $1 OR telegram_user_id = $2) AND event_id = $3`,
        [userId || null, tgId || null, eventId]
      );

      const { rows: eventRows } = await pool.query('SELECT name FROM events WHERE id=$1', [eventId]);
      const eventName = eventRows[0]?.name;
      if (tgId && eventName) {
        await sendPaymentConfirmed(eventId, eventName, tgId);
      }
      console.log(`✅ Payment confirmed for event ${eventId}`);
    }
  }
  res.json({ received: true });
});

// ==============================
// TELEGRAM WEBHOOK SETUP
// ==============================

app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.setWebHook(`${PUBLIC_URL}/webhook/${BOT_TOKEN}`);
app.listen(PORT, () => {
  console.log(`🚀 Bot running on port ${PORT}`);
});


