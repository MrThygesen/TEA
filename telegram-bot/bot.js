// bot.js
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import pkg from 'pg';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

// ====== ENV CHECKS ======
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN (or BOT_TOKEN) is missing');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is missing');
  process.exit(1);
}

// Render exposes RENDER_EXTERNAL_URL and PORT
const PUBLIC_URL =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.PUBLIC_URL ||
  `https://example.onrender.com`;
const PORT = process.env.PORT || 3000;

// ====== DB POOL ======
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ====== EXPRESS + WEBHOOK ======
const app = express();
app.use(express.json());

// Create bot without polling
const bot = new TelegramBot(BOT_TOKEN);

// Map: chatId -> { step, tier, city, email, wallet }
const userStates = {};

// Set webhook helper
async function ensureWebhook() {
  try {
    const info = await bot.getWebHookInfo();
    const desired = `${PUBLIC_URL}/bot${BOT_TOKEN}`;
    if (info.url !== desired) {
      await bot.setWebHook(desired);
      console.log(`✅ Webhook set to ${desired}`);
    } else {
      console.log(`ℹ️ Webhook already set to ${desired}`);
    }
  } catch (err) {
    console.error('Failed setting webhook:', err?.response?.body || err);
  }
}

// Webhook endpoint
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health root
app.get('/', (_req, res) => res.send('✅ Telegram bot service is running'));

// Start server + webhook
app.listen(PORT, async () => {
  console.log(`🌐 HTTP server on ${PORT}, public URL: ${PUBLIC_URL}`);
  await ensureWebhook();
});

// ====== DB HELPERS (user_profiles based) ======
async function getUserProfile(tgId) {
  const res = await pool.query(
    `SELECT telegram_user_id, telegram_username, tier, email, wallet_address, city
     FROM user_profiles WHERE telegram_user_id = $1`,
    [tgId.toString()]
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
     ON CONFLICT (telegram_user_id) DO UPDATE
     SET ${setClause}, updated_at = CURRENT_TIMESTAMP`,
    [tgId.toString(), ...values]
  );
}

async function upsertUsername(tgId, username) {
  await saveUserProfile(tgId, { telegram_username: username || null });
}

async function getAvailableCities() {
  const res = await pool.query(
    `SELECT DISTINCT city
     FROM events
     WHERE datetime > NOW()
     ORDER BY city ASC`
  );
  return res.rows.map(r => r.city).filter(Boolean);
}

async function getOpenEventsByCity(city) {
  const res = await pool.query(
    `SELECT id, name, city, datetime, min_attendees, is_confirmed
     FROM events
     WHERE datetime > NOW() AND LOWER(city) = LOWER($1)
     ORDER BY datetime ASC`,
    [city]
  );
  return res.rows;
}

async function getUserEvents(tgId) {
  const res = await pool.query(
    `SELECT e.id, e.name, e.datetime
     FROM registrations r
     JOIN events e ON r.event_id = e.id
     WHERE r.telegram_user_id = $1
     ORDER BY e.datetime ASC`,
    [tgId.toString()]
  );
  return res.rows;
}

async function getRegistrationCount(eventId) {
  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1`,
    [eventId]
  );
  return countRes.rows[0]?.count || 0;
}

async function registerUser(eventId, tgId, username, email, wallet) {
  await pool.query(
    `INSERT INTO registrations (event_id, telegram_user_id, telegram_username, email, wallet_address)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (event_id, telegram_user_id) DO NOTHING`,
    [eventId, tgId.toString(), username || null, email || null, wallet || null]
  );

  // After insert, compute count and update confirmation if needed
  const eventRes = await pool.query(
    `SELECT id, name, min_attendees, is_confirmed
     FROM events WHERE id=$1`,
    [eventId]
  );
  const event = eventRes.rows[0];
  const count = await getRegistrationCount(eventId);

  if (!event.is_confirmed && count >= (event.min_attendees || 1)) {
    await pool.query(`UPDATE events SET is_confirmed = TRUE WHERE id=$1`, [eventId]);
    return { confirmedNow: true, name: event.name, count, min: event.min_attendees || 1 };
  }

  return { confirmedNow: false, name: event.name, count, min: event.min_attendees || 1, alreadyConfirmed: event.is_confirmed };
}

// ====== ONBOARDING STEPS ======
async function askPackage(chatId) {
  const buttons = [
    [{ text: '1️⃣ Networking & Perk (Email)', callback_data: 'tier_1' }],
    [{ text: '2️⃣ Networking & More Perks (Email + Wallet)', callback_data: 'tier_2' }],
  ];
  await bot.sendMessage(
    chatId,
    'Select your package:',
    { reply_markup: { inline_keyboard: buttons } }
  );
}

async function askEmail(chatId) {
  await bot.sendMessage(chatId, '📧 Please enter your email (required):');
}
async function askWallet(chatId) {
  await bot.sendMessage(chatId, '💼 Please enter your Ethereum wallet address (0x…):');
}
async function askCity(chatId, currentCity = 'Copenhagen') {
  const cities = await getAvailableCities();
  // Always include Copenhagen as default option even if not in DB yet
  const unique = Array.from(new Set(['Copenhagen', ...cities]));
  const buttons = unique.map(c => [{ text: c, callback_data: `city_${c}` }]);
  await bot.sendMessage(
    chatId,
    `📍 Choose your city (current: ${currentCity || 'Copenhagen'}):`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

async function showEvents(chatId, city) {
  const events = await getOpenEventsByCity(city);
  if (!events.length) {
    return bot.sendMessage(chatId, `📭 No upcoming events in *${city}*.`, { parse_mode: 'Markdown' });
  }

  let text = `🎉 Upcoming events in *${city}*:\n`;
  events.forEach((e, i) => {
    const when = new Date(e.datetime).toLocaleString();
    text += `\n${i + 1}. *${e.name}* — ${when}`;
    if (e.is_confirmed) {
      text += ` ✅ Event is confirmed`;
    } else {
      text += ` 📢 Event is announced here, when guests have registered`;
    }
  });
  text += `\n\nReply with the event number to register.`;

  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

// ====== COMMANDS ======
bot.onText(/\/help/, async msg => {
  const help = `
🤖 *Bot Commands*
/start – See events (on first use: quick one-time setup)
/myevents – See your registered events (with QR)
/ticket – Get your QR tickets again
/user_edit – Edit your package/city/email/wallet
/help – Show this help

🎯 *Packages*
1) Networking & Perk — requires *Email*
2) Networking & More Perks — requires *Email + Wallet*
  `;
  bot.sendMessage(msg.chat.id, help, { parse_mode: 'Markdown' });
});

bot.onText(/\/start/, async msg => {
  const chatId = msg.chat.id;
  await upsertUsername(chatId, msg.from?.username);

  // Load profile
  let profile = await getUserProfile(chatId);

  // New user → create minimal default and run onboarding
  if (!profile) {
    await saveUserProfile(chatId, {
      city: 'Copenhagen',
      tier: null,
      email: null,
      wallet_address: null,
      telegram_username: msg.from?.username || null,
    });
    userStates[chatId] = { step: 'tier' };
    return askPackage(chatId);
  }

  // Existing user — ensure one-time setup:
  // If missing required fields, continue onboarding; else show events.
  const needsTier = profile.tier !== 1 && profile.tier !== 2;
  const needsEmail = !profile.email;
  const needsWallet = profile.tier === 2 && !profile.wallet_address;
  const city = profile.city || 'Copenhagen';

  if (needsTier) {
    userStates[chatId] = { step: 'tier' };
    return askPackage(chatId);
  }
  if (needsEmail) {
    userStates[chatId] = { step: 'email', tier: profile.tier };
    return askEmail(chatId);
  }
  if (needsWallet) {
    userStates[chatId] = { step: 'wallet', tier: profile.tier };
    return askWallet(chatId);
  }

  // Ready → show events in their city
  await bot.sendMessage(chatId, `Welcome back! City: *${city}*, Package (tier): *${profile.tier}*`, { parse_mode: 'Markdown' });
  return showEvents(chatId, city);
});

bot.onText(/\/user_edit/, async msg => {
  const chatId = msg.chat.id;
  await upsertUsername(chatId, msg.from?.username);
  // Re-run full onboarding: package → email → wallet(if Tier2) → choose city → events
  userStates[chatId] = { step: 'tier' };
  return askPackage(chatId);
});

bot.onText(/\/myevents/, async msg => {
  const chatId = msg.chat.id;
  const events = await getUserEvents(chatId);
  if (!events.length) {
    return bot.sendMessage(chatId, '📭 You have no registered events.');
  }
  for (const e of events) {
    const qrData = `Event:${e.name}\nUser:${msg.from?.username || chatId}\nTicket:${e.id}-${chatId}`;
    const png = await QRCode.toBuffer(qrData);
    await bot.sendPhoto(chatId, png, {
      caption: `🎟 *${e.name}* — ${new Date(e.datetime).toLocaleString()}`,
      parse_mode: 'Markdown',
    });
  }
});

bot.onText(/\/ticket/, async msg => {
  const chatId = msg.chat.id;
  const events = await getUserEvents(chatId);
  if (!events.length) {
    return bot.sendMessage(chatId, '📭 No tickets found.');
  }
  // Send QR for each ticket (same as /myevents per your request)
  for (const e of events) {
    const qrData = `Event:${e.name}\nUser:${msg.from?.username || chatId}\nTicket:${e.id}-${chatId}`;
    const png = await QRCode.toBuffer(qrData);
    await bot.sendPhoto(chatId, png, {
      caption: `🎟 *${e.name}* — ${new Date(e.datetime).toLocaleString()}`,
      parse_mode: 'Markdown',
    });
  }
});

// ====== CALLBACKS (Tier & City) ======
bot.on('callback_query', async query => {
  const chatId = query.message.chat.id;
  const data = query.data || '';

  // Package (Tier)
  if (data.startsWith('tier_')) {
    const tier = parseInt(data.replace('tier_', ''), 10);
    await saveUserProfile(chatId, { tier });
    userStates[chatId] = { step: 'email', tier };
    await bot.answerCallbackQuery(query.id, { text: `Tier set to ${tier}` });
    return askEmail(chatId);
  }

  // City selection
  if (data.startsWith('city_')) {
    const city = data.replace('city_', '');
    await saveUserProfile(chatId, { city });
    await bot.answerCallbackQuery(query.id, { text: `City set to ${city}` });

    // If user is currently editing profile (via /user_edit), proceed to events
    const state = userStates[chatId];
    if (state && state.step === 'city') {
      delete userStates[chatId];
      return showEvents(chatId, city);
    }

    // If city was chosen mid-onboarding, continue to events
    return showEvents(chatId, city);
  }
});

// ====== MESSAGE HANDLER (Email / Wallet / Event choice) ======
bot.on('message', async msg => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  // Skip commands here
  if (text.startsWith('/')) return;

  const state = userStates[chatId];

  // If not onboarding, treat as potential event selection only if profile complete
  if (!state) {
    const profile = await getUserProfile(chatId);
    if (!profile) return; // ignore random texts
    const needsTier = profile.tier !== 1 && profile.tier !== 2;
    const needsEmail = !profile.email;
    const needsWallet = profile.tier === 2 && !profile.wallet_address;
    if (needsTier || needsEmail || needsWallet) return; // ignore until /start onboarding
    // Event selection
    return handleEventSelection(chatId, text, profile.city || 'Copenhagen', msg.from?.username, profile);
  }

  // Onboarding state machine
  if (state.step === 'email') {
    if (!text.includes('@')) {
      return bot.sendMessage(chatId, '❌ Invalid email. Please enter a valid email address:');
    }
    await saveUserProfile(chatId, { email: text });
    if (state.tier === 2) {
      userStates[chatId] = { step: 'wallet', tier: 2 };
      return askWallet(chatId);
    } else {
      // Tier 1: next choose city (if user wants to change), then events
      userStates[chatId] = { step: 'city' };
      const profile = await getUserProfile(chatId);
      return askCity(chatId, profile?.city || 'Copenhagen');
    }
  }

  if (state.step === 'wallet') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
      return bot.sendMessage(chatId, '❌ Invalid wallet. Please enter a valid Ethereum address (0x…):');
    }
    await saveUserProfile(chatId, { wallet_address: text });
    // After wallet, choose city (or keep current), then events
    userStates[chatId] = { step: 'city' };
    const profile = await getUserProfile(chatId);
    return askCity(chatId, profile?.city || 'Copenhagen');
  }

  if (state.step === 'city') {
    // City should come via buttons; ignore free text
    return bot.sendMessage(chatId, 'Please pick your city from the buttons above.');
  }
});

// ====== EVENT SELECTION & REGISTRATION ======
async function handleEventSelection(chatId, text, city, username, profile) {
  const idx = parseInt(text, 10);
  const events = await getOpenEventsByCity(city);
  if (!events.length) {
    return bot.sendMessage(chatId, `📭 No upcoming events in *${city}*.`, { parse_mode: 'Markdown' });
  }
  if (Number.isNaN(idx) || idx < 1 || idx > events.length) {
    // Not a valid choice; re-show events
    return showEvents(chatId, city);
  }
  const selected = events[idx - 1];

  const result = await registerUser(
    selected.id,
    chatId,
    username,
    profile.email,
    profile.wallet_address
  );

  // Build response per your spec
  let lines = [];
  lines.push(`🎟 You are now *registered* for *${selected.name}*.`);
  lines.push(`👥 Registered guests: *${result.count}*`);

  const min = result.min || selected.min_attendees || 1;
  if (result.confirmedNow || result.alreadyConfirmed) {
    lines.push(`✅ The event is now *confirmed*.`);
    lines.push(`📱 You can generate your ticket with /ticket and show it at the venue.`);
  } else if (result.count < min) {
    lines.push(`⏳ We are awaiting confirmation. Minimum attendees: *${min}*.`);
  }

  await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
}

// Done
console.log('🤖 Bot is running with webhook mode...');

