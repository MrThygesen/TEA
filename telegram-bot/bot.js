import TelegramBot from 'node-telegram-bot-api';
import pkg from 'pg';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import express from 'express';
dotenv.config();

const { Pool } = pkg;

// ====== ENV CHECK ======
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

// ====== DB POOL ======
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
 
// ====== BOT ======
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const userStates = {}; // in-memory session

// ====== KEEP ALIVE FOR RENDER ======
const app = express();
app.get('/', (req, res) => res.send('✅ Bot service is running'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 HTTP server running on port ${PORT}`));

// ====== INIT TABLES ======
await pool.query(`
CREATE TABLE IF NOT EXISTS user_settings (
  telegram_user_id TEXT PRIMARY KEY,
  city TEXT DEFAULT 'Copenhagen',
  tier INTEGER DEFAULT 1,
  email TEXT,
  wallet_address TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
`);
console.log('✅ user_settings table ready');

// ====== HELPERS ======
async function getAvailableCities() {
  const res = await pool.query(`
    SELECT DISTINCT city FROM events
    WHERE datetime > NOW()
    ORDER BY city ASC
  `);
  return res.rows.map(r => r.city);
}

async function getUserSettings(tgId) {
  const res = await pool.query(`SELECT * FROM user_settings WHERE telegram_user_id=$1`, [tgId]);
  return res.rows[0] || null;
}

async function saveUserSettings(tgId, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((k, i) => `${k}=$${i + 2}`).join(', ');
  await pool.query(
    `INSERT INTO user_settings (telegram_user_id, ${keys.join(', ')})
     VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')})
     ON CONFLICT (telegram_user_id) DO UPDATE SET ${setClause}, updated_at=CURRENT_TIMESTAMP`,
    [tgId, ...values]
  );
}

async function getOpenEventsByCity(city) {
  const res = await pool.query(`
    SELECT id, name, datetime, min_attendees, is_confirmed
    FROM events
    WHERE datetime > NOW()
    AND LOWER(city) = LOWER($1)
    ORDER BY datetime ASC
  `, [city]);
  return res.rows;
}

// ====== FLOW ======
bot.onText(/\/start/, async msg => {
  const chatId = msg.chat.id;
  let settings = await getUserSettings(chatId);

  // if no city, pick first available
  const cities = await getAvailableCities();
  const defaultCity = cities[0] || 'Copenhagen';
  if (!settings) {
    await saveUserSettings(chatId, { city: defaultCity });
    settings = { city: defaultCity, tier: null };
  }

  userStates[chatId] = { city: settings.city, tier: settings.tier };

  // if no tier set in DB → ask for tier first
  if (!settings.tier) {
    return showTierSelection(chatId);
  } else {
    bot.sendMessage(chatId, `Welcome back! Your tier: ${settings.tier} and city: ${settings.city}`);
    await showEvents(chatId);
  }
});

bot.on('callback_query', async query => {
  const chatId = query.message.chat.id;
  if (!userStates[chatId]) userStates[chatId] = {};

  if (query.data.startsWith('city_')) {
    const city = query.data.replace('city_', '');
    userStates[chatId].city = city;
    await saveUserSettings(chatId, { city });
    await bot.answerCallbackQuery(query.id, { text: `City set to ${city}` });
    await showTierSelection(chatId);
  }

  if (query.data === 'tier1' || query.data === 'tier2') {
    const tierNum = query.data === 'tier1' ? 1 : 2;
    userStates[chatId].tier = tierNum;
    userStates[chatId].step = 'email';
    await saveUserSettings(chatId, { tier: tierNum }); // persist tier
    bot.sendMessage(chatId, '📧 Please enter your email:');
  }
});

bot.on('message', async msg => {
  const chatId = msg.chat.id;
  const state = userStates[chatId];
  if (!state) return;

  if (state.step === 'email') {
    if (!msg.text.includes('@')) return bot.sendMessage(chatId, '❌ Invalid email.');
    state.email = msg.text;
    await saveUserSettings(chatId, { email: state.email });
    if (state.tier === 2) {
      state.step = 'wallet';
      bot.sendMessage(chatId, '💳 Enter your Ethereum wallet address:');
    } else {
      state.step = 'event';
      await showEvents(chatId);
    }
  } else if (state.step === 'wallet') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(msg.text)) return bot.sendMessage(chatId, '❌ Invalid wallet address.');
    state.wallet = msg.text;
    await saveUserSettings(chatId, { wallet_address: state.wallet });
    state.step = 'event';
    await showEvents(chatId);
  }
});

// ====== UI ======
async function showTierSelection(chatId) {
  const buttons = [
    [{ text: '📩 Tier 1 (Email only)', callback_data: 'tier1' }],
    [{ text: '💼 Tier 2 (Email + Wallet)', callback_data: 'tier2' }]
  ];
  bot.sendMessage(chatId, 'Choose your tier:', { reply_markup: { inline_keyboard: buttons } });
}

async function showEvents(chatId) {
  const events = await getOpenEventsByCity(userStates[chatId].city);
  if (!events.length) return bot.sendMessage(chatId, '📭 No upcoming events.');
  let msg = `🎉 Upcoming events in *${userStates[chatId].city}*:\n`;
  events.forEach((e, i) => {
    msg += `\n${i + 1}. *${e.name}* — ${new Date(e.datetime).toLocaleString()}`;
  });
  bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

console.log('🤖 Bot & HTTP server running...');

