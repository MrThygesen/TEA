//import { sendEmailVerification } from './lib/sendEmailVerification.js'

import TelegramBot from 'node-telegram-bot-api';
import pkg from 'pg';
import dotenv from 'dotenv';
import express from 'express';
import { runMigrations } from './migrations.js';
import Stripe from 'stripe';
import bodyParser from 'body-parser';

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

// ==== EMAIL HELPERS ====
import {
  sendEmailVerification,
  sendEventConfirmed,
  sendPaymentConfirmed,
  isLikelyEmail,
} from "./email.js";

// ==== TELEGRAM BOT ====
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
const userStates = {};

// ==============================
// DB HELPERS
// ==============================
async function getUserByTelegramId(tgId) {
  const res = await pool.query('SELECT * FROM user_profiles WHERE telegram_user_id = $1', [tgId]);
  return res.rows[0] || null;
}

async function getUserByEmail(email) {
  const res = await pool.query('SELECT * FROM user_profiles WHERE email = $1', [email]);
  return res.rows[0] || null;
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
    const { rows: already } = await pool.query(
      'SELECT 1 FROM registrations WHERE event_id=$1 AND user_id=$2',
      [eventId, userId]
    );
    if (!already.length) {
      return { statusMsg: '⚠️ Sorry, this event is full.', confirmed: false };
    }
  }

  await pool.query(
    `INSERT INTO registrations (event_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (event_id, user_id) DO NOTHING`,
    [eventId, userId]
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

// All bot.onText handlers remain unchanged
// (Ensure every `for` loop and `if` inside them is properly closed)
// Example fix for /ticket:

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
}); // <-- closed properly

// ==============================
// CALLBACK QUERY, STRIPE WEBHOOK, EXPRESS SETUP
// ==============================

// All remaining handlers, webhook, and app.listen remain unchanged
// Ensure all nested try/catch, if/for, switch/case blocks are closed

app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.setWebHook(`${PUBLIC_URL}/webhook/${BOT_TOKEN}`);

app.listen(PORT, () => {
  console.log(`🚀 Bot running on port ${PORT}`);
});

