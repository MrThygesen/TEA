// bot.js - final version
import TelegramBot from 'node-telegram-bot-api';
import pkg from 'pg';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import express from 'express';
import { runMigrations } from './migrations.js';

dotenv.config();
const { Pool } = pkg;

// ====== ENV CHECKS ======
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN missing');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL missing');
  process.exit(1);
}
const PORT = process.env.PORT || 3000;
const PUBLIC_URL =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.PUBLIC_URL ||
  'https://example.onrender.com';

// ====== DB POOL ======
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Run migrations
await runMigrations();
console.log('✅ Database migrations complete.');

// ====== EXPRESS APP ======
const app = express();
app.use(express.json());

// ====== TELEGRAM BOT ======
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
const userStates = {}; // ephemeral per-run state

// ====== HELPERS ======
function escapeMarkdownV2(text) {
  if (!text && text !== 0) return '';
  const s = String(text);
  return s.replace(/([_*\[\]()~>#+\-=|{}.!\\])/g, '\\$1');
}

function makePayload(prefix, value) {
  return `${prefix}|${encodeURIComponent(String(value))}`;
}

function parsePayload(data) {
  if (typeof data !== 'string') return { prefix: null, value: null };
  const idx = data.indexOf('|');
  if (idx === -1) return { prefix: data, value: null };
  const prefix = data.slice(0, idx);
  const encoded = data.slice(idx + 1);
  try {
    return { prefix, value: decodeURIComponent(encoded) };
  } catch (err) {
    return { prefix, value: encoded };
  }
}

// ====== WEBHOOK ======
async function setWebhook() {
  const webhookUrl = `${PUBLIC_URL}/bot${BOT_TOKEN}`;
  try {
    const info = await bot.getWebHookInfo();
    if (info.url !== webhookUrl) {
      await bot.setWebHook(webhookUrl);
      console.log(`✅ Webhook set to ${webhookUrl}`);
    } else {
      console.log(`ℹ️ Webhook already set to ${webhookUrl}`);
    }
  } catch (err) {
    if (err?.response && err.response.statusCode === 429) {
      const retryAfter = err.response.headers['retry-after'] || 1;
      console.warn(`⚠️ Telegram rate limited. Retry after ${retryAfter}s`);
    } else {
      throw err;
    }
  }
}

// Webhook endpoint (unchanged)
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health check
app.get('/', (_req, res) => res.send('✅ Telegram bot service is running'));

// ====== DB HELPERS ======
async function getUserProfile(tgId) {
  const res = await pool.query(
    'SELECT * FROM user_profiles WHERE telegram_user_id=$1',
    [tgId]
  );
  return res.rows[0] || null;
}

async function saveUserProfile(tgId, data = {}) {
  const keys = Object.keys(data);
  if (!keys.length) return;
  const values = Object.values(data);
  const setClause = keys.map((k, i) => `${k}=$${i + 2}`).join(', ');
  await pool.query(
    `INSERT INTO user_profiles (telegram_user_id, ${keys.join(', ')})
     VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')})
     ON CONFLICT (telegram_user_id) DO UPDATE SET ${setClause}, updated_at=CURRENT_TIMESTAMP`,
    [tgId, ...values]
  );
}

async function getAvailableCities() {
  const res = await pool.query(
    'SELECT DISTINCT city FROM events WHERE datetime > NOW() ORDER BY city ASC'
  );
  return res.rows.map((r) => (r.city ? r.city.trim() : r.city)).filter(Boolean);
}

async function getOpenEventsByCity(city) {
  const res = await pool.query(
    `SELECT id, name, datetime, city, group_id, min_attendees, max_attendees, is_confirmed, basic_perk, advanced_perk
     FROM events
     WHERE datetime > NOW() AND LOWER(city) = LOWER($1)
     ORDER BY datetime ASC`,
    [city]
  );
  return res.rows;
}

async function registerUser(eventId, tgId, username, email, wallet) {
  const regCheck = await pool.query(
    'SELECT * FROM registrations WHERE event_id=$1 AND telegram_user_id=$2',
    [eventId, tgId]
  );
  const alreadyRegistered = regCheck.rows.length > 0;

  const evRes = await pool.query(
    'SELECT * FROM events WHERE id=$1',
    [eventId]
  );
  const event = evRes.rows[0];
  if (!event) throw new Error('Event not found');

  if (event.max_attendees && !alreadyRegistered) {
    const countRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1',
      [eventId]
    );
    const count = countRes.rows[0]?.count || 0;
    if (count >= event.max_attendees) {
      return { confirmed: false, statusMsg: '❌ Registration full. Maximum attendees reached.' };
    }
  }

  if (!alreadyRegistered) {
    await pool.query(
      `INSERT INTO registrations
       (event_id, telegram_user_id, telegram_username, email, wallet_address)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id, telegram_user_id) DO NOTHING`,
      [eventId, tgId, username || null, email || null, wallet || null]
    );
  }

  const countRes = await pool.query(
    'SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1',
    [eventId]
  );
  const count = countRes.rows[0]?.count || 0;

  let statusMsg = '';
  if (alreadyRegistered) statusMsg = 'ℹ️ You have already registered this event.\n';

  if (!event.is_confirmed && count >= (event.min_attendees || 1)) {
    await pool.query('UPDATE events SET is_confirmed=TRUE, updated_at=CURRENT_TIMESTAMP WHERE id=$1', [eventId]);
    statusMsg += '✅ The event is now *confirmed*! You can generate your ticket.';
  } else if (!event.is_confirmed) {
    statusMsg += '⌛ We are awaiting confirmation.';
  } else {
    statusMsg += '✅ Event is already confirmed!';
  }

  if (event.max_attendees && count < event.max_attendees) {
    statusMsg += `\n👥 Current attendees: ${count}/${event.max_attendees}`;
  }

  return { confirmed: count >= (event.min_attendees || 1), statusMsg, eventName: event.name };
}

async function getUserEvents(tgId) {
  const res = await pool.query(
    `SELECT e.id, e.name, e.datetime, e.city, e.group_id, e.min_attendees, e.max_attendees,
            e.is_confirmed, e.basic_perk, e.advanced_perk,
            (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS current_attendees
     FROM events e
     JOIN registrations reg ON reg.event_id = e.id
     WHERE reg.telegram_user_id = $1
     ORDER BY e.datetime ASC`,
    [tgId]
  );
  return res.rows;
}

// ====== Ticket helper ======
async function sendTicket(chatId, tgId, eventId, eventName) {
  const qrData = JSON.stringify({ eventId, tgId });
  const qrImage = await QRCode.toBuffer(qrData);
  await bot.sendPhoto(chatId, qrImage, {
    caption: escapeMarkdownV2(`🎟 Ticket for ${eventName}`),
    parse_mode: 'MarkdownV2'
  });
}

// ====== showEvents with buttons ======
async function showEvents(chatId, city) {
  const events = await getOpenEventsByCity(city);
  if (!events.length) return bot.sendMessage(chatId, escapeMarkdownV2('📭 No upcoming events for this city.'), { parse_mode: 'MarkdownV2' });

  let text = `🎉 Upcoming events in *${escapeMarkdownV2(city)}*:\n`;
  const opts = { reply_markup: { inline_keyboard: [] } };

  events.forEach((e, i) => {
    const host = e.group_id || '';
    text += `\n${i + 1}. *${escapeMarkdownV2(e.name)}*${host ? ` — ${escapeMarkdownV2(host)}` : ''} — ${escapeMarkdownV2(new Date(e.datetime).toLocaleString())}`;
    opts.reply_markup.inline_keyboard.push([
      { text: '📝 Register', callback_data: makePayload('register', String(e.id)) },
      { text: 'ℹ️ Details', callback_data: makePayload('details', String(e.id)) }
    ]);
  });

  await bot.sendMessage(chatId, text, { parse_mode: 'MarkdownV2', ...opts });
}

// ====== Commands ======
bot.onText(/\/help/, (msg) => {
  const text = [
    '🤖 *Bot Commands*',
    '/start – Register & choose city',
    '/myevents – See your events & get QR codes',
    '/ticket – Get ticket for a specific event',
    '/user_edit – Edit email, wallet, tier',
    '/help – Show this message'
  ].join('\n');
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'MarkdownV2' });
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const tgId = String(msg.from.id);

  const cities = await getAvailableCities();
  if (!cities.length) return bot.sendMessage(chatId, '📭 No upcoming events available.');

  const keyboard = cities.map((c) => [{ text: c, callback_data: makePayload('city', c) }]);
  bot.sendMessage(chatId, '🌆 Select your city:', { reply_markup: { inline_keyboard: keyboard } });
});

bot.onText(/\/myevents/, async (msg) => {
  const chatId = msg.chat.id;
  const tgId = String(msg.from.id);

  const events = await getUserEvents(tgId);
  if (!events.length) return bot.sendMessage(chatId, '📭 You have no registered events.');

  for (const e of events) {
    let text = `🎫 *${escapeMarkdownV2(e.name)}*\n`;
    text += `📍 City: ${escapeMarkdownV2(e.city)}\n`;
    text += `📅 Date: ${escapeMarkdownV2(new Date(e.datetime).toLocaleString())}\n`;
    text += `👥 Attendees: ${e.current_attendees}/${e.max_attendees || '∞'}\n`;
    text += `✅ Confirmed: ${e.is_confirmed ? 'Yes' : 'No'}\n`;
    if (e.basic_perk) text += `🎁 Basic perk: ${escapeMarkdownV2(e.basic_perk)}\n`;
    if (e.advanced_perk) text += `🌟 Advanced perk: ${escapeMarkdownV2(e.advanced_perk)}\n`;

    const opts = {
      reply_markup: {
        inline_keyboard: [[{ text: '🎟 Show QR Ticket', callback_data: makePayload('ticket', e.id) }]]
      },
      parse_mode: 'MarkdownV2'
    };
    await bot.sendMessage(chatId, text, opts);
  }
});

// ====== CALLBACK QUERIES ======
bot.on('callback_query', async (query) => {
  if (!query || !query.data) return;
  const chatId = query.message.chat.id;
  const tgId = String(query.from.id);
  const { prefix, value } = parsePayload(query.data);

  await bot.answerCallbackQuery(query.id).catch(() => {});

  try {
    if (prefix === 'city') {
      await showEvents(chatId, value);
    } else if (prefix === 'register') {
      const profile = await getUserProfile(tgId);
      const { statusMsg } = await registerUser(value, tgId, profile?.telegram_username, profile?.email, profile?.wallet_address);
      await bot.sendMessage(chatId, escapeMarkdownV2(statusMsg), { parse_mode: 'MarkdownV2' });
    } else if (prefix === 'details') {
      const res = await pool.query('SELECT * FROM events WHERE id=$1', [value]);
      const e = res.rows[0];
      if (!e) return bot.sendMessage(chatId, '❌ Event not found.');
      let text = `📄 *${escapeMarkdownV2(e.name)}*\n📍 City: ${escapeMarkdownV2(e.city)}\n📅 Date: ${escapeMarkdownV2(new Date(e.datetime).toLocaleString())}\n`;
      if (e.venue) text += `🏛 Venue: ${escapeMarkdownV2(e.venue)}\n`;
      if (e.description) text += `📝 Description: ${escapeMarkdownV2(e.description)}\n`;
      if (e.basic_perk) text += `🎁 Basic perk: ${escapeMarkdownV2(e.basic_perk)}\n`;
      if (e.advanced_perk) text += `🌟 Advanced perk: ${escapeMarkdownV2(e.advanced_perk)}\n`;
      bot.sendMessage(chatId, text, { parse_mode: 'MarkdownV2' });
    } else if (prefix === 'ticket') {
      const res = await pool.query('SELECT name FROM events WHERE id=$1', [value]);
      const e = res.rows[0];
      if (!e) return bot.sendMessage(chatId, '❌ Event not found.');
      await sendTicket(chatId, tgId, value, e.name);
    }
  } catch (err) {
    console.error('callback_query error:', err);
    bot.sendMessage(chatId, '❌ An error occurred.');
  }
});

// ====== START SERVER ======
app.listen(PORT, async () => {
  console.log(`✅ Bot server listening on port ${PORT}`);
  await setWebhook();
});

