// bot.js
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
const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || 'https://example.onrender.com';

// ====== DB POOL ======
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Run migrations before bot starts
await runMigrations();
console.log('✅ Database migrations complete.');

// ====== EXPRESS APP ======
const app = express();
app.use(express.json());

// ====== TELEGRAM BOT ======
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
const userStates = {}; // in-memory session

// ====== ESCAPE HELPER FOR MARKDOWN V2 ======
function escapeMarkdownV2(text) {
  if (!text) return '';
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
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
  const res = await pool.query(`SELECT * FROM user_profiles WHERE telegram_user_id=$1`, [tgId]);
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
     ON CONFLICT (telegram_user_id) DO UPDATE
     SET ${setClause}, updated_at=CURRENT_TIMESTAMP`,
    [tgId, ...values]
  );
}

async function getAvailableCities() {
  const res = await pool.query(`
    SELECT DISTINCT city
    FROM events
    WHERE datetime > NOW()
    ORDER BY city ASC
  `);
  return res.rows.map(r => r.city);
}

async function getOpenEventsByCity(city) {
  const res = await pool.query(`
    SELECT id, name, datetime, min_attendees, max_attendees, is_confirmed
    FROM events
    WHERE datetime > NOW()
      AND LOWER(city) = LOWER($1)
    ORDER BY datetime ASC
  `, [city]);
  return res.rows;
}

async function registerUser(eventId, tgId, username, email, wallet) {
  const regCheck = await pool.query(
    `SELECT * FROM registrations WHERE event_id=$1 AND telegram_user_id=$2`,
    [eventId, tgId]
  );
  const alreadyRegistered = regCheck.rows.length > 0;

  if (!alreadyRegistered) {
    await pool.query(`
      INSERT INTO registrations (event_id, telegram_user_id, telegram_username, email, wallet_address)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (event_id, telegram_user_id) DO NOTHING
    `, [eventId, tgId, username, email, wallet || null]);
  }

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1`,
    [eventId]
  );
  const count = countRes.rows[0]?.count || 0;

  const eventRes = await pool.query(
    `SELECT name, min_attendees, max_attendees, is_confirmed FROM events WHERE id=$1`,
    [eventId]
  );
  const event = eventRes.rows[0];

  let statusMsg = `👥 *${count}* people registered.\n`;
  if (alreadyRegistered) {
    statusMsg = `ℹ️ You have already registered the event.\n${statusMsg}`;
  }
  if (!event.is_confirmed && count >= event.min_attendees) {
    await pool.query(`UPDATE events SET is_confirmed=TRUE WHERE id=$1`, [eventId]);
    statusMsg += `✅ The event is now *confirmed*! You can generate your ticket and show it at the venue.`;
  } else if (!event.is_confirmed) {
    statusMsg += `⌛ We are awaiting confirmation.`;
  } else {
    statusMsg += `✅ This event is already confirmed!`;
  }

  if (event.max_attendees && count < event.max_attendees) {
    statusMsg += `\n📢 Please invite friends to come along!`;
  }

  return { confirmed: count >= event.min_attendees, eventName: event.name, statusMsg };
}

async function getUserEvents(tgId) {
  const res = await pool.query(`
    SELECT e.id, e.name, e.datetime
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.telegram_user_id=$1
    ORDER BY e.datetime ASC
  `, [tgId]);
  return res.rows;
}

async function showEvents(chatId, city) {
  const events = await getOpenEventsByCity(city);
  if (!events.length) return bot.sendMessage(chatId, '📭 No upcoming events for this city.');
  
  let msg = `🎉 Upcoming events in *${escapeMarkdownV2(city)}*:\n`;
  events.forEach((e, i) => {
    msg += `\n${i + 1}. *${escapeMarkdownV2(e.name)}* — ${escapeMarkdownV2(new Date(e.datetime).toLocaleString())}`;
  });
  msg += '\n\nReply with event number to register.';
  bot.sendMessage(chatId, msg, { parse_mode: 'MarkdownV2' });
}

// ====== COMMANDS ======

// /help
bot.onText(/\/help/, msg => {
  const text = `
🤖 *Bot Commands*
/start – Register & choose city
/myevents – See your events & get QR codes
/ticket – Get ticket for a specific event
/user_edit – Edit your profile
/city-event – Browse events by city
/help – Show this help message

🎯 *Tiers*
1️⃣ Networking & perks (Email only)
2️⃣ Networking & more perks (Email + Wallet)
  `;
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'MarkdownV2' });
});

// /start
bot.onText(/\/start/, async msg => {
  const chatId = msg.chat.id;
  const profile = await getUserProfile(chatId);
  if (profile && profile.city && profile.email && (profile.tier === 1 || (profile.tier === 2 && profile.wallet_address))) {
    await showEvents(chatId, profile.city);
    return;
  }
  userStates[chatId] = { step: 'tier' };
  const buttons = [
    [{ text: '📩 Tier 1 (Email only)', callback_data: 'tier1' }],
    [{ text: '💼 Tier 2 (Email + Wallet)', callback_data: 'tier2' }]
  ];
  bot.sendMessage(chatId, 'Choose your package:', { reply_markup: { inline_keyboard: buttons } });
});

// /user_edit
bot.onText(/\/user_edit/, async msg => {
  const chatId = msg.chat.id;
  userStates[chatId] = { step: 'tier' };
  const buttons = [
    [{ text: '📩 Tier 1 (Email only)', callback_data: 'tier1' }],
    [{ text: '💼 Tier 2 (Email + Wallet)', callback_data: 'tier2' }]
  ];
  bot.sendMessage(chatId, 'Update your package selection:', { reply_markup: { inline_keyboard: buttons } });
});

// /myevents
bot.onText(/\/myevents/, async msg => {
  const chatId = msg.chat.id;
  const events = await getUserEvents(chatId);
  if (!events.length) return bot.sendMessage(chatId, '📭 You have no registered events.');

  for (const e of events) {
    const qrData = `Event: ${e.name}\nUser: ${msg.from.username}\nTicket: ${e.id}-${chatId}`;
    const qrImage = await QRCode.toBuffer(qrData);
    bot.sendPhoto(chatId, qrImage, {
      caption: `🎟 *${escapeMarkdownV2(e.name)}* — ${escapeMarkdownV2(new Date(e.datetime).toLocaleString())}`,
      parse_mode: 'MarkdownV2'
    });
  }
});

// /ticket
bot.onText(/\/ticket/, async msg => {
  const chatId = msg.chat.id;
  const events = await getUserEvents(chatId);
  if (!events.length) return bot.sendMessage(chatId, '📭 No tickets found.');

  for (const e of events) {
    const qrData = `Event: ${e.name}\nUser: ${msg.from.username}\nTicket: ${e.id}-${chatId}`;
    const qrImage = await QRCode.toBuffer(qrData);
    bot.sendPhoto(chatId, qrImage, {
      caption: `🎟 Ticket #${e.id}-${chatId} — ${escapeMarkdownV2(e.name)}`,
      parse_mode: 'MarkdownV2'
    });
  }
});

// /city-event
bot.onText(/\/city-event/, async msg => {
  const chatId = msg.chat.id;
  const cities = await getAvailableCities();
  if (!cities.length) return bot.sendMessage(chatId, '📭 No cities with upcoming events.');

  const buttons = cities.map(c => [{ text: escapeMarkdownV2(c), callback_data: `viewcity_${c}` }]);
  bot.sendMessage(chatId, '🏙 Select a city to see upcoming events:', { reply_markup: { inline_keyboard: buttons } });
});

// CALLBACKS
bot.on('callback_query', async query => {
  const chatId = query.message.chat.id;
  if (!userStates[chatId]) userStates[chatId] = {};

  // Tier selection
  if (query.data === 'tier1' || query.data === 'tier2') {
    userStates[chatId].tier = query.data === 'tier1' ? 1 : 2;
    userStates[chatId].step = 'city';
    const cities = await getAvailableCities();
    const defaultCity = cities.includes('Copenhagen') ? 'Copenhagen' : cities[0] || 'Copenhagen';
    const buttons = cities.map(c => [{ text: escapeMarkdownV2(c), callback_data: `city_${c}` }]);
    bot.sendMessage(chatId, `🏙 Select your city (default is ${escapeMarkdownV2(defaultCity)}):`, { reply_markup: { inline_keyboard: buttons } });
  }

  // City selection during registration
  if (query.data.startsWith('city_')) {
    const city = query.data.replace('city_', '');
    userStates[chatId].city = city;
    userStates[chatId].step = 'email';
    bot.sendMessage(chatId, '📧 Please enter your email address:');
  }

  // City-event selection
  if (query.data.startsWith('viewcity_')) {
    const city = query.data.replace('viewcity_', '');
    const events = await getOpenEventsByCity(city);
    if (!events.length) return bot.sendMessage(chatId, `📭 No upcoming events in ${escapeMarkdownV2(city)}`);

    let msgText = `🎉 Upcoming events in *${escapeMarkdownV2(city)}*:\n`;
    events.forEach((e, i) => {
      msgText += `\n${i + 1}. *${escapeMarkdownV2(e.name)}* — ${escapeMarkdownV2(new Date(e.datetime).toLocaleString())}`;
    });

    bot.sendMessage(chatId, msgText, { parse_mode: 'MarkdownV2' });
  }
});

// MESSAGE HANDLER
bot.on('message', async msg => {
  const chatId = msg.chat.id;
  const state = userStates[chatId];
  if (!state) return;

  if (state.step === 'email') {
    if (!msg.text.includes('@')) return bot.sendMessage(chatId, '❌ Invalid email.');
    state.email = msg.text;
    if (state.tier === 2) {
      state.step = 'wallet';
      bot.sendMessage(chatId, '💳 Enter your Ethereum wallet address:');
    } else {
      await saveUserProfile(chatId, { tier: state.tier, city: state.city, email: state.email });
      state.step = 'event';
      await showEvents(chatId, state.city);
    }
  } else if (state.step === 'wallet') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(msg.text)) return bot.sendMessage(chatId, '❌ Invalid wallet address.');
    state.wallet = msg.text;
    await saveUserProfile(chatId, { tier: state.tier, city: state.city, email: state.email, wallet_address: state.wallet });
    state.step = 'event';
    await showEvents(chatId, state.city);
  } else if (state.step === 'event') {
    const choice = parseInt(msg.text);
    const events = await getOpenEventsByCity(state.city);
    if (isNaN(choice) || choice < 1 || choice > events.length)
      return bot.sendMessage(chatId, '❌ Invalid choice.');

    const selected = events[choice - 1];
    const { statusMsg } = await registerUser(selected.id, chatId, msg.from.username, state.email, state.wallet);

    bot.sendMessage(chatId, `🎟 Registered for *${escapeMarkdownV2(selected.name)}*`, { parse_mode: 'MarkdownV2' });
    bot.sendMessage(chatId, escapeMarkdownV2(statusMsg), { parse_mode: 'MarkdownV2' });

    delete userStates[chatId];
  }
});

// ====== START SERVER ======
app.listen(PORT, async () => {
  console.log(`🌐 HTTP server on port ${PORT}`);
  await setWebhook();
  console.log('🤖 Bot running with webhook mode...');
});

