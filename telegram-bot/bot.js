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
const pool = new Pool({
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
const userStates = {};

// ====== ESCAPE HELPER ======
function escapeMarkdownV2(text) {
  if (!text) return '';
  return text.replace(/([_*\[\]()~>#+\-=|{}.!\\])/g, '\\$1');
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
    if (err.response && err.response.statusCode === 429) {
      const retryAfter = err.response.headers['retry-after'] || 1;
      console.warn(`⚠️ Telegram rate limited. Retry after ${retryAfter}s`);
    } else {
      throw err;
    }
  }
}

// Webhook endpoint
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
  return res.rows.map((r) => r.city);
}

async function getOpenEventsByCity(city) {
  const res = await pool.query(
    `SELECT id, name, datetime, city, venue, min_attendees, max_attendees, is_confirmed
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
  if (!alreadyRegistered) {
    await pool.query(
      `INSERT INTO registrations
       (event_id, telegram_user_id, telegram_username, email, wallet_address)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id, telegram_user_id) DO NOTHING`,
      [eventId, tgId, username, email, wallet || null]
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
  if (!event.is_confirmed && count >= event.min_attendees) {
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
    confirmed: count >= event.min_attendees,
    eventName: event.name,
    statusMsg,
  };
}

async function getUserEvents(tgId) {
  const res = await pool.query(
    `SELECT e.id, e.name, e.datetime, e.city, e.venue, e.host
     FROM registrations r
     JOIN events e ON r.event_id = e.id
     WHERE r.telegram_user_id=$1
     ORDER BY e.datetime ASC`,
    [tgId]
  );
  return res.rows;
}

// ====== Ticket helper ======
async function sendTicket(chatId, tgId, eventId, eventName) {
  const qrData = JSON.stringify({ eventId, tgId });
  const qrImage = await QRCode.toBuffer(qrData);
  bot.sendPhoto(chatId, qrImage, {
    caption: escapeMarkdownV2(`🎟 Ticket for ${eventName}`),
    parse_mode: 'MarkdownV2'
  });
}

// ====== showEvents with buttons ======
async function showEvents(chatId, city) {
  const events = await getOpenEventsByCity(city);
  if (!events.length) {
    return bot.sendMessage(chatId, escapeMarkdownV2('📭 No upcoming events for this city.'), { parse_mode: 'MarkdownV2' });
  }

  let text = `🎉 Upcoming events in *${escapeMarkdownV2(city)}*:\n`;
  const opts = { reply_markup: { inline_keyboard: [] } };

  events.forEach((e, i) => {
    text += `\n${i + 1}. *${escapeMarkdownV2(e.name)}* — ${escapeMarkdownV2(e.venue || e.city)} — ${escapeMarkdownV2(new Date(e.datetime).toLocaleString())}`;
    opts.reply_markup.inline_keyboard.push([
      { text: '📝 Register', callback_data: `register_${e.id}` },
      { text: 'ℹ️ Details', callback_data: `details_${e.id}` }
    ]);
  });

  bot.sendMessage(chatId, text, { parse_mode: 'MarkdownV2', ...opts });
}

// ====== /help ======
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

// ====== /myevents ======
bot.onText(/\/myevents/, async (msg) => {
  const tgId = String(msg.from.id);
  const events = await getUserEvents(tgId);
  if (!events.length) return bot.sendMessage(msg.chat.id, escapeMarkdownV2('📭 You are not registered for any events yet.'), { parse_mode: 'MarkdownV2' });

  let text = '📅 *Your upcoming events*:\n';
  const opts = { reply_markup: { inline_keyboard: [] } };

  events.forEach((e) => {
    text += `\n• *${escapeMarkdownV2(e.name)}* — ${escapeMarkdownV2(e.venue || e.city)} — ${escapeMarkdownV2(new Date(e.datetime).toLocaleString())}`;
    opts.reply_markup.inline_keyboard.push([
      { text: `🎟 Get Ticket`, callback_data: `ticket_${e.id}` }
    ]);
  });

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'MarkdownV2', ...opts });
});

// ====== /ticket ======
bot.onText(/\/ticket/, async (msg) => {
  const tgId = String(msg.from.id);
  const events = await getUserEvents(tgId);
  if (!events.length) return bot.sendMessage(msg.chat.id, escapeMarkdownV2('📭 You have no tickets available.'), { parse_mode: 'MarkdownV2' });
  if (events.length === 1) return sendTicket(msg.chat.id, tgId, events[0].id, events[0].name);

  return bot.sendMessage(msg.chat.id, escapeMarkdownV2('Please use /myevents to select a ticket.'), { parse_mode: 'MarkdownV2' });
});

// ====== /start with inline city buttons ======
bot.onText(/\/start/, async (msg) => {
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  const profile = await getUserProfile(tgId);

  if (profile) return bot.sendMessage(msg.chat.id, escapeMarkdownV2(`👋 Welcome back, ${username || 'friend'}! Use /myevents or /events to see what's on.`), { parse_mode: 'MarkdownV2' });

  await saveUserProfile(tgId, { telegram_username: username });
  const cities = await getAvailableCities();
  if (!cities.length) return bot.sendMessage(msg.chat.id, escapeMarkdownV2('No cities available yet. Please check back later.'), { parse_mode: 'MarkdownV2' });

  const opts = { reply_markup: { inline_keyboard: cities.map(c => [{ text: c, callback_data: `setstartcity_${c}` }]) } } };
  userStates[tgId] = { step: 'choosingStartCity' };
  bot.sendMessage(msg.chat.id, escapeMarkdownV2('🌍 Please choose your city:'), { parse_mode: 'MarkdownV2', ...opts });
});

// ====== /events ======
bot.onText(/\/events/, async (msg) => {
  const tgId = String(msg.from.id);
  const profile = await getUserProfile(tgId);

  if (!profile || !profile.city) {
    const cities = await getAvailableCities();
    if (!cities.length) return bot.sendMessage(msg.chat.id, escapeMarkdownV2('No cities available yet.'), { parse_mode: 'MarkdownV2' });
    const opts = { reply_markup: { inline_keyboard: cities.map(c => [{ text: c, callback_data: `choose_event_city_${c}` }]) } };
    userStates[tgId] = { step: 'choosingEventCity' };
    return bot.sendMessage(msg.chat.id, escapeMarkdownV2('🌍 Choose a city to see events:'), { parse_mode: 'MarkdownV2', ...opts });
  }

  return showEvents(msg.chat.id, profile.city);
});

// ====== /user_edit with inline buttons ======
bot.onText(/\/user_edit/, async (msg) => {
  const tgId = String(msg.from.id);
  const profile = await getUserProfile(tgId);
  if (!profile) return bot.sendMessage(msg.chat.id, escapeMarkdownV2('⚠️ You do not have a profile yet. Use /start first.'), { parse_mode: 'MarkdownV2' });

  const fields = ['Tier', 'Email', 'Wallet', 'City'];
  const opts = { reply_markup: { inline_keyboard: fields.map(f => [{ text: f, callback_data: `edit_${f.toLowerCase()}` }]) } };

  userStates[tgId] = { step: 'editingProfile' };
  bot.sendMessage(msg.chat.id, escapeMarkdownV2('What do you want to edit?'), { parse_mode: 'MarkdownV2', ...opts });
});

// ====== Handle inline button presses ======
bot.on('callback_query', async (query) => {
  const tgId = String(query.from.id);
  const state = userStates[tgId];
  const data = query.data;

  // /start city selection
  if (state?.step === 'choosingStartCity' && data.startsWith('setstartcity_')) {
    const city = data.split('_')[1];
    await saveUserProfile(tgId, { city });
    delete userStates[tgId];
    return bot.sendMessage(query.message.chat.id, escapeMarkdownV2(`✅ City set to ${city}. You can now use /events to browse events.`), { parse_mode: 'MarkdownV2' });
  }

  // /events city selection
  if (data.startsWith('choose_event_city_')) {
    const city = data.replace('choose_event_city_', '');
    delete userStates[tgId];
    return showEvents(query.message.chat.id, city);
  }

  // /user_edit field selection
  if (state?.step === 'editingProfile' && data.startsWith('edit_')) {
    const field = data.split('_')[1];
    if (field === 'city') {
      const cities = await getAvailableCities();
      const opts = { reply_markup: { inline_keyboard: cities.map(c => [{ text: c, callback_data: `setcity_${c}` }]) } };
      userStates[tgId].editField = 'city';
      return bot.sendMessage(query.message.chat.id, escapeMarkdownV2('Select a city:'), { parse_mode: 'MarkdownV2', ...opts });
    } else {
      userStates[tgId].editField = field;
      return bot.sendMessage(query.message.chat.id, escapeMarkdownV2(`Enter new value for ${field}:`), { parse_mode: 'MarkdownV2' });
    }
  }

  // /user_edit city update
  if (state?.editField === 'city' && data.startsWith('setcity_')) {
    const city = data.split('_')[1];
    await saveUserProfile(tgId, { city });
    delete userStates[tgId];
    return bot.sendMessage(query.message.chat.id, escapeMarkdownV2(`✅ City updated to ${city}.`), { parse_mode: 'MarkdownV2' });
  }

  // Event buttons
  if (data.startsWith('register_')) {
    const eventId = parseInt(data.split('_')[1], 10);
    const profile = await getUserProfile(tgId);
    if (!profile) return bot.sendMessage(query.message.chat.id, escapeMarkdownV2('⚠️ Please use /start first.'), { parse_mode: 'MarkdownV2' });
    const result = await registerUser(eventId, tgId, profile.telegram_username, profile.email, profile.wallet_address);
    return bot.sendMessage(query.message.chat.id, escapeMarkdownV2(result.statusMsg), { parse_mode: 'MarkdownV2' });
  }

  if (data.startsWith('details_')) {
    const eventId = parseInt(data.split('_')[1], 10);
    const res = await pool.query('SELECT * FROM events WHERE id=$1', [eventId]);
    const e = res.rows[0];
    if (!e) return;
    let detailsMsg = `ℹ️ *Event Details*\n`;
    detailsMsg += `*Name:* ${escapeMarkdownV2(e.name)}\n`;
    detailsMsg += `*City:* ${escapeMarkdownV2(e.city)}\n`;
    detailsMsg += `*Venue:* ${escapeMarkdownV2(e.venue || 'N/A')}\n`;
    detailsMsg += `*Host:* ${escapeMarkdownV2(e.host || 'N/A')}\n`;
    detailsMsg += `*Date/Time:* ${escapeMarkdownV2(new Date(e.datetime).toLocaleString())}\n`;
    detailsMsg += `*Min attendees:* ${e.min_attendees}\n`;
    detailsMsg += `*Max attendees:* ${e.max_attendees || 'No limit'}\n`;
    detailsMsg += `*Confirmed:* ${e.is_confirmed ? '✅ Yes' : '⌛ No'}`;
    return bot.sendMessage(query.message.chat.id, detailsMsg, { parse_mode: 'MarkdownV2' });
  }

  if (data.startsWith('ticket_')) {
    const eventId = parseInt(data.split('_')[1], 10);
    const eventRes = await pool.query('SELECT name FROM events WHERE id=$1', [eventId]);
    const eventName = eventRes.rows[0]?.name || 'Event';
    return sendTicket(query.message.chat.id, tgId, eventId, eventName);
  }

  bot.answerCallbackQuery(query.id);
});

// ====== Start HTTP server ======
app.listen(PORT, async () => {
  console.log(`🌐 HTTP server on port ${PORT}`);
  await setWebhook();
  console.log('🤖 Bot running with webhook mode...');
});

// ====== Handle text input for inline-free fields ======
bot.on('message', async (msg) => {
  const tgId = String(msg.from.id);
  const state = userStates[tgId];
  if (!state || !state.editField) return;

  const fieldMap = { wallet: 'wallet_address', tier: 'tier', email: 'email' };
  const column = fieldMap[state.editField] || state.editField;
  await saveUserProfile(tgId, { [column]: msg.text });
  delete userStates[tgId];
  bot.sendMessage(msg.chat.id, escapeMarkdownV2(`✅ ${state.editField} updated.`), { parse_mode: 'MarkdownV2' });
});

