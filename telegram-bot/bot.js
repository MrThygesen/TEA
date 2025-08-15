import TelegramBot from 'node-telegram-bot-api';
import pkg from 'pg';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import { runMigrations } from './migrations.js';
dotenv.config();
// Before initializing bot and webhook
await runMigrations();
console.log('✅ Database migrations completed.');


const { Pool } = pkg;

// 🔹 Check environment variables
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in environment variables');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

// 🔹 DB Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 🔹 Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const userStates = {}; // in-memory temp session state

// ====== HELPERS ======
async function getAvailableCities() {
  const res = await pool.query(`
    SELECT DISTINCT city
    FROM events
    WHERE datetime > NOW()
    ORDER BY city ASC
  `);
  return res.rows.map(r => r.city);
}

async function getUserProfile(tgId) {
  const res = await pool.query(`SELECT * FROM user_profiles WHERE telegram_user_id=$1`, [tgId]);
  return res.rows.length ? res.rows[0] : null;
}

async function saveUserProfile(tgId, data) {
  const keys = Object.keys(data);
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

async function registerUser(eventId, tgId, username, email, wallet) {
  await pool.query(`
    INSERT INTO registrations (event_id, telegram_user_id, telegram_username, email, wallet_address)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (event_id, telegram_user_id) DO NOTHING
  `, [eventId, tgId, username, email, wallet || null]);

  const countRes = await pool.query(`SELECT COUNT(*) FROM registrations WHERE event_id=$1`, [eventId]);
  const count = parseInt(countRes.rows[0].count);

  const eventRes = await pool.query(`SELECT name, min_attendees, is_confirmed FROM events WHERE id=$1`, [eventId]);
  const event = eventRes.rows[0];

  let statusMsg = `👥 *${count}* people registered.\n`;
  if (!event.is_confirmed && count >= event.min_attendees) {
    await pool.query(`UPDATE events SET is_confirmed=TRUE WHERE id=$1`, [eventId]);
    statusMsg += `✅ The event is now *confirmed*! You can generate your ticket and show it at the venue.`;
  } else if (!event.is_confirmed) {
    statusMsg += `⌛ We are awaiting confirmation.`;
  } else {
    statusMsg += `✅ This event is already confirmed!`;
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
  let msg = `🎉 Upcoming events in *${city}*:\n`;
  events.forEach((e, i) => {
    msg += `\n${i + 1}. *${e.name}* — ${new Date(e.datetime).toLocaleString()}`;
  });
  msg += '\n\nReply with event number to register.';
  bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

// ====== COMMANDS ======
bot.onText(/\/help/, msg => {
  const text = `
🤖 *Bot Commands*
/start – Register & choose city
/myevents – See your events & get QR codes
/ticket – Get ticket for a specific event
/user_edit – Edit your profile
/help – Show this help message

🎯 *Tiers*
1️⃣ Networking & perks (Email only)
2️⃣ Networking & more perks (Email + Wallet)
  `;
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/start/, async msg => {
  const chatId = msg.chat.id;
  let profile = await getUserProfile(chatId);

  if (profile && profile.city && profile.email && (profile.tier === 1 || (profile.tier === 2 && profile.wallet_address))) {
    // Already registered → show events
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

bot.onText(/\/user_edit/, async msg => {
  const chatId = msg.chat.id;
  userStates[chatId] = { step: 'tier' };
  const buttons = [
    [{ text: '📩 Tier 1 (Email only)', callback_data: 'tier1' }],
    [{ text: '💼 Tier 2 (Email + Wallet)', callback_data: 'tier2' }]
  ];
  bot.sendMessage(chatId, 'Update your package selection:', { reply_markup: { inline_keyboard: buttons } });
});

bot.onText(/\/myevents/, async msg => {
  const chatId = msg.chat.id;
  const events = await getUserEvents(chatId);
  if (!events.length) return bot.sendMessage(chatId, '📭 You have no registered events.');

  for (const e of events) {
    const qrData = `Event: ${e.name}\nUser: ${msg.from.username}\nTicket: ${e.id}-${chatId}`;
    const qrImage = await QRCode.toBuffer(qrData);
    bot.sendPhoto(chatId, qrImage, {
      caption: `🎟 *${e.name}* — ${new Date(e.datetime).toLocaleString()}`,
      parse_mode: 'Markdown'
    });
  }
});

bot.onText(/\/ticket/, async msg => {
  const chatId = msg.chat.id;
  const events = await getUserEvents(chatId);
  if (!events.length) return bot.sendMessage(chatId, '📭 No tickets found.');
  for (const e of events) {
    const qrData = `Event: ${e.name}\nUser: ${msg.from.username}\nTicket: ${e.id}-${chatId}`;
    const qrImage = await QRCode.toBuffer(qrData);
    bot.sendPhoto(chatId, qrImage, {
      caption: `🎟 Ticket #${e.id}-${chatId} — ${e.name}`,
      parse_mode: 'Markdown'
    });
  }
});

// ====== CALLBACK HANDLING ======
bot.on('callback_query', async query => {
  const chatId = query.message.chat.id;
  if (!userStates[chatId]) userStates[chatId] = {};

  if (query.data === 'tier1' || query.data === 'tier2') {
    userStates[chatId].tier = query.data === 'tier1' ? 1 : 2;
    userStates[chatId].step = 'city';
    const cities = await getAvailableCities();
    const defaultCity = cities.includes('Copenhagen') ? 'Copenhagen' : cities[0] || 'Copenhagen';
    const buttons = cities.map(c => [{ text: c, callback_data: `city_${c}` }]);
    bot.sendMessage(chatId, `🏙 Select your city (default is ${defaultCity}):`, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  if (query.data.startsWith('city_')) {
    const city = query.data.replace('city_', '');
    userStates[chatId].city = city;
    userStates[chatId].step = 'email';
    bot.sendMessage(chatId, '📧 Please enter your email address:');
  }
});

// ====== MESSAGE HANDLING ======
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
      await saveUserProfile(chatId, {
        tier: state.tier,
        city: state.city,
        email: state.email
      });
      state.step = 'event';
      await showEvents(chatId, state.city);
    }
  } else if (state.step === 'wallet') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(msg.text)) return bot.sendMessage(chatId, '❌ Invalid wallet address.');
    state.wallet = msg.text;
    await saveUserProfile(chatId, {
      tier: state.tier,
      city: state.city,
      email: state.email,
      wallet_address: state.wallet
    });
    state.step = 'event';
    await showEvents(chatId, state.city);
  } else if (state.step === 'event') {
    const choice = parseInt(msg.text);
    const events = await getOpenEventsByCity(state.city);
    if (isNaN(choice) || choice < 1 || choice > events.length) return bot.sendMessage(chatId, '❌ Invalid choice.');

    const selected = events[choice - 1];
    const { statusMsg } = await registerUser(selected.id, chatId, msg.from.username, state.email, state.wallet);
    bot.sendMessage(chatId, `🎟 Registered for *${selected.name}*`, { parse_mode: 'Markdown' });
    bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
    delete userStates[chatId];
  }
});

console.log('🤖 Bot is running...');

