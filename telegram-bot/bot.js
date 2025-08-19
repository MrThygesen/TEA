import TelegramBot from 'node-telegram-bot-api';
import pkg from 'pg';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import express from 'express';
import { runMigrations } from './migrations.js';
import fetch from 'node-fetch';
import sgMail from '@sendgrid/mail';
import * as Jimp from 'jimp'; 
import QrCodeReader from 'qrcode-reader';

dotenv.config();
const { Pool } = pkg;

// ====== ENV CHECKS ======
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN missing');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL missing');
  process.exit(1);
}
if (!process.env.FRONTEND_BASE_URL) {
  console.warn('⚠️ FRONTEND_BASE_URL missing, email notifications may fail');
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
function escapeMarkdownV1(text) {
  if (!text) return '';
  return text.toString().replace(/([\\_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

// ====== HELPER FUNCTIONS ======
async function getUserProfile(tgId) {
  const res = await pool.query('SELECT * FROM user_profiles WHERE telegram_user_id=$1', [tgId]);
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
    `SELECT id, name, datetime, min_attendees, max_attendees, is_confirmed
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
     WHERE r.telegram_user_id=$1
     ORDER BY e.datetime ASC`,
    [tgId]
  );
  return res.rows;
}

async function sendTicket(chatId, tgId, eventId, eventName) {
  const events = await getUserEvents(tgId);
  const isRegistered = events.some(e => e.id === eventId);
  if (!isRegistered) {
    return bot.sendMessage(chatId, '⚠️ You are not registered for this event.', { parse_mode: 'Markdown' });
  }
  const qrData = JSON.stringify({ eventId, tgId });
  const qrImage = await QRCode.toBuffer(qrData);
  bot.sendPhoto(chatId, qrImage, {
    caption: `🎟 Ticket for ${escapeMarkdownV1(eventName)}`,
    parse_mode: 'Markdown',
  });
}

async function validateTicket(scannedByTgId, scannedTicketData) {
  try {
    const { eventId, tgId } = JSON.parse(scannedTicketData);

    const regRes = await pool.query(
      'SELECT * FROM registrations WHERE telegram_user_id=$1 AND event_id=$2',
      [tgId, eventId]
    );
    const registration = regRes.rows[0];
    if (!registration) return { success: false, msg: '⚠️ Ticket not found or user not registered.' };
    if (registration.ticket_validated) return { success: false, msg: 'ℹ️ Ticket already validated.' };

    const profileRes = await pool.query(
      'SELECT role, telegram_username FROM user_profiles WHERE telegram_user_id=$1',
      [scannedByTgId]
    );
    const scannerProfile = profileRes.rows[0];
    if (!scannerProfile || scannerProfile.role !== 'organizer')
      return { success: false, msg: '❌ You are not authorized to validate tickets.' };

    await pool.query(
      'UPDATE registrations SET ticket_validated=TRUE, validated_by=$1, validated_at=NOW() WHERE telegram_user_id=$2 AND event_id=$3',
      [scannedByTgId, tgId, eventId]
    );

    await bot.sendMessage(
      tgId,
      `✅ Your ticket for event ID ${eventId} was validated by @${scannerProfile.telegram_username || 'an organizer'}.`,
      { parse_mode: 'Markdown' }
    );

    return { success: true, msg: `✅ Ticket validated successfully.` };
  } catch (err) {
    console.error('❌ Error validating ticket', err);
    return { success: false, msg: '❌ Error validating ticket.' };
  }
}

// ====== QR IMAGE SCANNING ======
async function scanQrFromPhotoUrl(url) {
  const image = await Jimp.read(url);
  return new Promise((resolve, reject) => {
    const qr = new QrCodeReader();
    qr.callback = (err, value) => {
      if (err || !value) return reject('❌ Failed to read QR code.');
      resolve(value.result);
    };
    qr.decode(image.bitmap);
  });
}

// ====== SHOW EVENTS ======
async function showEvents(chatId, city) {
  const events = await getOpenEventsByCity(city);
  if (!events.length) {
    return bot.sendMessage(chatId, '📭 No upcoming events for this city.', { parse_mode: 'Markdown' });
  }

  const opts = { reply_markup: { inline_keyboard: [] } };
  let text = `🎉 Upcoming events in *${escapeMarkdownV1(city)}*:\n`;

  events.forEach((e, i) => {
    const dateStr = new Date(e.datetime).toLocaleString();
    text += `\n${i + 1}. *${escapeMarkdownV1(e.name)}* — ${escapeMarkdownV1(dateStr)}`;
    opts.reply_markup.inline_keyboard.push([
      { text: '📝 Register', callback_data: `register_${e.id}` },
      { text: 'ℹ️ Details', callback_data: `details_${e.id}` },
    ]);
  });

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...opts });
}

// ====== SCAN LOGIC ======
async function startScan(tgId, chatId) {
  const profileRes = await pool.query(
    'SELECT role, telegram_username FROM user_profiles WHERE telegram_user_id=$1',
    [tgId]
  );
  const profile = profileRes.rows[0];
  if (!profile || profile.role !== 'organizer') {
    return bot.sendMessage(chatId, '❌ You are not authorized to validate tickets.');
  }

  userStates[tgId] = { step: 'scanningTicket' };
  bot.sendMessage(chatId, '📸 Please send the QR code (text or photo) to validate the ticket.');
}

// ====== TELEGRAM HANDLERS ======

// Inline buttons & /scan command
bot.onText(/\/scan/, async (msg) => {
  const tgId = String(msg.from.id);
  await startScan(tgId, msg.chat.id);
});

bot.on('callback_query', async (query) => {
  const tgId = String(query.from.id);
  const state = userStates[tgId];
  const data = decodeURIComponent(query.data);

  if (data === 'scan_ticket') {
    await startScan(tgId, query.message.chat.id);
  }

  // Existing callback logic
  if (state?.step === 'choosingStartCity' && data.startsWith('setstartcity_')) {
    const city = data.replace('setstartcity_', '');
    await saveUserProfile(tgId, { city });
    delete userStates[tgId];
    return bot.sendMessage(query.message.chat.id, `✅ City set to ${escapeMarkdownV1(city)}. You can now use /events to browse events.`, { parse_mode: 'Markdown' });
  }

  if (data.startsWith('edit_')) {
    const field = data.replace('edit_', '');
    userStates[tgId] = { editField: field };
    return bot.sendMessage(query.message.chat.id, `✏️ Please type your new ${escapeMarkdownV1(field)}:`, { parse_mode: 'Markdown' });
  }

  if (data.startsWith('register_')) {
    const eventId = parseInt(data.replace('register_', ''), 10);
    const profile = await getUserProfile(tgId);
    if (!profile) return bot.sendMessage(query.message.chat.id, '⚠️ Please use /start first.', { parse_mode: 'Markdown' });
    const result = await registerUser(eventId, tgId, profile.telegram_username, profile.email, profile.wallet_address);
    return bot.sendMessage(query.message.chat.id, escapeMarkdownV1(result.statusMsg), { parse_mode: 'Markdown' });
  }

  if (data.startsWith('details_')) {
    const eventId = parseInt(data.replace('details_', ''), 10);
    const res = await pool.query('SELECT * FROM events WHERE id=$1', [eventId]);
    const e = res.rows[0];
    if (!e) return;
    let detailsMsg = `ℹ️ *Event Details*\n*Name:* ${escapeMarkdownV1(e.name)}\n*City:* ${escapeMarkdownV1(e.city)}\n*Date/Time:* ${new Date(e.datetime).toLocaleString()}\n*Confirmed:* ${e.is_confirmed ? '✅ Yes' : '⌛ No'}\n*Min/Max Attendees:* ${e.min_attendees || 0}/${e.max_attendees || '∞'}`;
    return bot.sendMessage(query.message.chat.id, detailsMsg, { parse_mode: 'Markdown' });
  }

  if (data.startsWith('ticket_')) {
    const eventId = parseInt(data.replace('ticket_', ''), 10);
    const events = await getUserEvents(tgId);
    const ev = events.find(e => e.id === eventId);
    if (!ev) return bot.sendMessage(query.message.chat.id, '⚠️ You are not registered for this event.', { parse_mode: 'Markdown' });
    return sendTicket(query.message.chat.id, tgId, ev.id, ev.name);
  }
});

// Scan QR messages
bot.on('message', async (msg) => {
  const tgId = String(msg.from.id);
  const state = userStates[tgId];
  if (!state?.step || state.step !== 'scanningTicket') return;

  try {
    let scannedData = null;

    if (msg.text && msg.text.startsWith('{') && msg.text.includes('eventId')) {
      scannedData = msg.text;
    }

    if (msg.photo?.length) {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const file = await bot.getFile(fileId);
      const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
      scannedData = await scanQrFromPhotoUrl(url);
    }

    if (!scannedData) return bot.sendMessage(msg.chat.id, '❌ Could not detect QR code. Please try again.');

    const result = await validateTicket(tgId, scannedData);
    bot.sendMessage(msg.chat.id, result.msg, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('❌ Scan error', err);
    bot.sendMessage(msg.chat.id, '❌ Error scanning ticket. Please try again.');
  } finally {
    delete userStates[tgId];
  }
});

// ====== BOT COMMANDS ======
bot.onText(/\/help/, (msg) => {
  const text = [
    '🤖 Bot Commands',
    '/start – Register & choose city',
    '/myevents – See your events & get QR codes',
    '/ticket – Get ticket for a specific event',
    '/user_edit – Edit your profile',
    '/events – Browse events by city',
    '/help – Show this help message',
    '',
    '🎯 Tiers',
    '1️⃣ Networking & perks (Email only)',
    '2️⃣ Networking & more perks (Email + Wallet)',
    '📷 Organizers can use Scan Ticket via buttons or /scan'
  ].join('\n');
  bot.sendMessage(msg.chat.id, escapeMarkdownV1(text), { parse_mode: 'Markdown' });
});

// ====== EXPRESS SERVER & WEBHOOK ======
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get('/', (_req, res) => res.send('✅ Telegram bot service is running'));

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
    console.error('❌ Webhook setup failed:', err.message);
  }
}

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await setWebhook();
});

