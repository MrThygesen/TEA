// bot.js - updated for new events schema
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

app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

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
    `SELECT * FROM events WHERE datetime > NOW() AND LOWER(city) = LOWER($1) ORDER BY datetime ASC`,
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

  const eventRes = await pool.query(
    'SELECT name, min_attendees, max_attendees, is_confirmed FROM events WHERE id=$1',
    [eventId]
  );
  const event = eventRes.rows[0];

  let statusMsg = `👥 *${count}* people registered.\n`;
  if (alreadyRegistered) statusMsg = `ℹ️ You have already registered the event.\n${statusMsg}`;
  if (!event.is_confirmed && count >= (event.min_attendees || 1)) {
    await pool.query('UPDATE events SET is_confirmed=TRUE WHERE id=$1', [eventId]);
    statusMsg += '✅ The event is now *confirmed*! You can generate your ticket.';
  } else if (!event.is_confirmed) {
    statusMsg += '⌛ We are awaiting confirmation.';
  } else {
    statusMsg += '✅ This event is already confirmed!';
  }
  if (event.max_attendees && count < event.max_attendees) {
    statusMsg += '\n📢 Please invite friends to come along!';
  }

  return {
    confirmed: count >= (event.min_attendees || 1),
    eventName: event.name,
    statusMsg,
  };
}

async function getUserEvents(tgId) {
  const res = await pool.query(
    `SELECT e.id, e.name, e.datetime, e.city, e.group_id
     FROM registrations r
     JOIN events e ON r.event_id = e.id
     WHERE r.telegram_user_id=$1
     ORDER BY e.datetime ASC`,
    [tgId]
  );
  return res.rows;
}

async function sendTicket(chatId, tgId, eventId, eventName) {
  const qrData = JSON.stringify({ eventId, tgId });
  const qrImage = await QRCode.toBuffer(qrData);
  await bot.sendPhoto(chatId, qrImage, {
    caption: escapeMarkdownV2(`🎟 Ticket for ${eventName}`),
    parse_mode: 'MarkdownV2'
  });
}

// ====== showEvents ======
async function showEvents(chatId, city) {
  const events = await getOpenEventsByCity(city);
  if (!events.length) {
    return bot.sendMessage(chatId, escapeMarkdownV2('📭 No upcoming events for this city.'), { parse_mode: 'MarkdownV2' });
  }

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

// /help
bot.onText(/\/help/, (msg) => {
  const text = [
    '🤖 *Bot Commands*',
    '/start – Register & choose city',
    '/myevents – See your events & get QR codes',
    '/ticket – Get ticket for a specific event',
    '/user_edit – Edit your profile',
    '/events – Browse events by city',
    '/help – Show this help message',
    '',
    '🎯 *Tiers*',
    '1️⃣ Networking & perks (Email only)',
    '2️⃣ Networking & more perks (Email + Wallet)',
  ].join('\n');

  bot.sendMessage(msg.chat.id, escapeMarkdownV2(text), { parse_mode: 'MarkdownV2' });
});

// /start
bot.onText(/\/start/, async (msg) => {
  const tgId = String(msg.from.id);
  const username = msg.from?.username || '';
  const profile = await getUserProfile(tgId);

  if (profile) {
    return bot.sendMessage(msg.chat.id, escapeMarkdownV2(`👋 Welcome back, ${username || 'friend'}! Use /myevents or /events to see what's on.`), { parse_mode: 'MarkdownV2' });
  }

  await saveUserProfile(tgId, { telegram_username: username });
  const cities = await getAvailableCities();
  if (!cities.length) return bot.sendMessage(msg.chat.id, escapeMarkdownV2('No cities available yet. Please check back later.'), { parse_mode: 'MarkdownV2' });

  const opts = {
    reply_markup: { inline_keyboard: cities.map(c => [{ text: c, callback_data: makePayload('setstartcity', c) }]) }
  };

  userStates[tgId] = { step: 'choosingStartCity' };
  await bot.sendMessage(msg.chat.id, escapeMarkdownV2('🌍 Please choose your city:'), { parse_mode: 'MarkdownV2', ...opts });
});

// /events
bot.onText(/\/events/, async (msg) => {
  const tgId = String(msg.from.id);
  const profile = await getUserProfile(tgId);

  if (!profile || !profile.city) {
    const cities = await getAvailableCities();
    if (!cities.length) return bot.sendMessage(msg.chat.id, escapeMarkdownV2('No cities available yet.'), { parse_mode: 'MarkdownV2' });
    const opts = { reply_markup: { inline_keyboard: cities.map(c => [{ text: c, callback_data: makePayload('choose_event_city', c) }]) } };
    userStates[tgId] = { step: 'choosingEventCity' };
    return bot.sendMessage(msg.chat.id, escapeMarkdownV2('🌍 Choose a city to see events:'), { parse_mode: 'MarkdownV2', ...opts });
  }

  return showEvents(msg.chat.id, profile.city);
});

// /myevents
bot.onText(/\/myevents/, async (msg) => {
  const tgId = String(msg.from.id);
  const events = await getUserEvents(tgId);
  if (!events.length) return bot.sendMessage(msg.chat.id, escapeMarkdownV2('📭 You are not registered for any events yet.'), { parse_mode: 'MarkdownV2' });

  let text = '📅 *Your upcoming events*:\n';
  const opts = { reply_markup: { inline_keyboard: [] } };

  events.forEach((e) => {
    const hostOrCity = e.group_id || e.city || 'N/A';
    text += `\n• *${escapeMarkdownV2(e.name)}* — ${escapeMarkdownV2(hostOrCity)} — ${escapeMarkdownV2(new Date(e.datetime).toLocaleString())}`;
    opts.reply_markup.inline_keyboard.push([
      { text: `🎟 Get Ticket`, callback_data: makePayload('ticket', String(e.id)) }
    ]);
  });

  await bot.sendMessage(msg.chat.id, text, { parse_mode: 'MarkdownV2', ...opts });
});

// /ticket
bot.onText(/\/ticket/, async (msg) => {
  const tgId = String(msg.from.id);
  const events = await getUserEvents(tgId);
  if (!events.length) return bot.sendMessage(msg.chat.id, escapeMarkdownV2('📭 You have no events to get tickets for.'), { parse_mode: 'MarkdownV2' });

  const opts = { reply_markup: { inline_keyboard: events.map(e => [{ text: e.name, callback_data: makePayload('ticket', e.id) }]) } };
  await bot.sendMessage(msg.chat.id, escapeMarkdownV2('🎫 Select an event to get your ticket:'), { parse_mode: 'MarkdownV2', ...opts });
});

// ====== CALLBACK HANDLER ======
bot.on('callback_query', async (ctx) => {
  const tgId = String(ctx.from.id);
  const username = ctx.from?.username || '';
  const { prefix, value } = parsePayload(ctx.callbackQuery.data);

  try {
    if (prefix === 'setstartcity') {
      await saveUserProfile(tgId, { city: value });
      userStates[tgId] = null;
      await ctx.editMessageText(escapeMarkdownV2(`🌍 Your city has been set to *${value}*`), { parse_mode: 'MarkdownV2' });
      return showEvents(ctx.chat.id, value);
    }

    if (prefix === 'choose_event_city') {
      return showEvents(ctx.chat.id, value);
    }

    if (prefix === 'register') {
      const { statusMsg, eventName } = await registerUser(value, tgId, username);
      await ctx.answerCbQuery();
      return ctx.reply(escapeMarkdownV2(statusMsg), { parse_mode: 'MarkdownV2' });
    }

    if (prefix === 'ticket') {
      const eventRes = await pool.query('SELECT name FROM events WHERE id=$1', [value]);
      if (!eventRes.rows.length) return ctx.answerCbQuery('Event not found', { show_alert: true });
      await sendTicket(ctx.chat.id, tgId, value, eventRes.rows[0].name);
      return ctx.answerCbQuery();
    }

    if (prefix === 'details') {
      const evRes = await pool.query('SELECT * FROM events WHERE id=$1', [value]);
      if (!evRes.rows.length) return ctx.answerCbQuery('Event not found', { show_alert: true });
      const ev = evRes.rows[0];
      let text = `📅 *${escapeMarkdownV2(ev.name)}*\n🏙 ${escapeMarkdownV2(ev.city)}\n🗓 ${escapeMarkdownV2(new Date(ev.datetime).toLocaleString())}\n👥 ${ev.min_attendees}-${ev.max_attendees} attendees\n\n`;
      if (ev.description) text += `📝 ${escapeMarkdownV2(ev.description)}\n\n`;
      if (ev.venue) text += `📍 Venue: ${escapeMarkdownV2(ev.venue)}\n`;
      if (ev.basic_perk) text += `🎁 Basic perk: ${escapeMarkdownV2(ev.basic_perk)}\n`;
      if (ev.advanced_perk) text += `💎 Advanced perk: ${escapeMarkdownV2(ev.advanced_perk)}\n`;

      const buttons = [[{ text: '✅ Register', callback_data: makePayload('register', ev.id) }]];
      await ctx.editMessageText(text, { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: buttons } });
      return ctx.answerCbQuery();
    }
  } catch (err) {
    console.error('Callback error:', err);
    await ctx.answerCbQuery('⚠️ An error occurred', { show_alert: true });
  }
});

// ====== START SERVER ======
app.listen(PORT, async () => {
  console.log(`✅ Bot server listening on port ${PORT}`);
  await setWebhook();
});

