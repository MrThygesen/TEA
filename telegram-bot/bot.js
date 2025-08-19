import TelegramBot from 'node-telegram-bot-api';
import pkg from 'pg';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import express from 'express';
import { runMigrations } from './migrations.js';
import fetch from 'node-fetch';
import sgMail from '@sendgrid/mail';
import axios from 'axios';

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

// ====== DB HELPERS ======
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
  return res.rows.map(r => r.city);
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

// ====== EMAIL NOTIFICATIONS ======
async function notifyEventConfirmedViaApi(eventId, eventName, eventCity, eventDateTime) {
  try {
    const regRes = await pool.query(
      'SELECT email, wallet_address, telegram_username FROM registrations WHERE event_id=$1 AND email IS NOT NULL',
      [eventId]
    );
    const attendees = regRes.rows;
    if (!attendees.length) return;

    await Promise.all(attendees.map(async (attendee) => {
      const msg = {
        to: attendee.email,
        from: 'no-reply@teanet.xyz',
        subject: `Event Confirmed: ${eventName}`,
        html: `
          <p>Hi ${attendee.telegram_username || ''},</p>
          <p>Your event <strong>${eventName}</strong> is now confirmed! 🎉</p>
          <p><strong>Date/Time:</strong> ${eventDateTime || 'TBA'}</p>
          <p><strong>City:</strong> ${eventCity || 'TBA'}</p>
        `
      };
      await sgMail.send(msg);
    }));

    console.log(`📧 Event confirmation sent to ${attendees.length} attendees`);
  } catch (err) {
    console.error('❌ Failed to send event confirmation via SendGrid', err);
  }
}

// ====== REGISTRATION ======
async function registerUser(eventId, tgId, username, email, wallet) {
  const regCheck = await pool.query(
    'SELECT * FROM registrations WHERE event_id=$1 AND telegram_user_id=$2',
    [eventId, tgId]
  );
  const alreadyRegistered = regCheck.rows.length > 0;

  const eventRes = await pool.query(
    'SELECT name, min_attendees, max_attendees, is_confirmed FROM events WHERE id=$1',
    [eventId]
  );
  const event = eventRes.rows[0];
  if (!event) return { statusMsg: '⚠️ Event not found.', confirmed: false };

  const countRes = await pool.query(
    'SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1',
    [eventId]
  );
  const count = countRes.rows[0]?.count || 0;

  if (event.max_attendees && !alreadyRegistered && count >= event.max_attendees) {
    return { statusMsg: '⚠️ Sorry, this event is full.', confirmed: false };
  }

  if (!alreadyRegistered) {
    await pool.query(
      `INSERT INTO registrations
       (event_id, telegram_user_id, telegram_username, email, wallet_address)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id, telegram_user_id) DO NOTHING`,
      [eventId, tgId, username, email, wallet || null]
    );
  }

  const newCountRes = await pool.query(
    'SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1',
    [eventId]
  );
  const newCount = newCountRes.rows[0]?.count || 0;

  let statusMsg = `👥 ${newCount} people registered.\n`;
  if (alreadyRegistered) statusMsg = `ℹ️ You have already registered for this event.\n${statusMsg}`;

  if (!event.is_confirmed && newCount >= event.min_attendees) {
    await pool.query('UPDATE events SET is_confirmed=TRUE WHERE id=$1', [eventId]);
    statusMsg += '✅ The event is now confirmed! You can generate your ticket.';

    const detailsRes = await pool.query('SELECT name, city, datetime FROM events WHERE id=$1', [eventId]);
    const details = detailsRes.rows[0];
    const eventDateTime = details ? new Date(details.datetime).toLocaleString() : '';
    await notifyEventConfirmedViaApi(eventId, event.name, details?.city, eventDateTime);
  } else if (!event.is_confirmed) {
    statusMsg += '⌛ We are awaiting confirmation.';
  } else {
    statusMsg += '✅ This event is already confirmed!';
  }

  return {
    confirmed: newCount >= event.min_attendees,
    eventName: event.name,
    statusMsg,
  };
}

// ====== TICKET GENERATION ======
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
    parse_mode: 'Markdown'
  });
}

// ====== TICKET VALIDATION ======
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

// ====== QR SCAN ======
async function downloadFile(fileId) {
  const file = await bot.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
  const resp = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(resp.data);
}

async function scanQrFromTelegramPhoto(fileId) {
  const buffer = await downloadFile(fileId);
  try {
    const result = await QRCode.decode(buffer);
    return result;
  } catch (err) {
    throw new Error('❌ Failed to decode QR code from photo.');
  }
}

// ====== START SCAN ======
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

// ====== BOT COMMANDS ======

// ====== /start ======
bot.onText(/\/start/, async (msg) => {
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  const profile = await getUserProfile(tgId);
  if (!profile) await saveUserProfile(tgId, { telegram_username: username });

  const safeUsername = escapeMarkdownV1(username);

  const text = `👋 Welcome ${safeUsername}!\n\n` +
               `Use the following commands:\n` +
               `/events - List upcoming events by city\n` +
               `/myevents - Your registered events\n` +
               `/help - Show this help message\n` +
               `/myid - Show your Telegram ID and username`;

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});


// ====== /myid ======
bot.onText(/\/myid/, async (msg) => {
  const tgId = msg.from.id;
  const username = msg.from.username || '';
  const safeUsername = escapeMarkdownV1(username);

  const text = `🆔 *Your Telegram info*:\n` +
               `• ID: \`${tgId}\`\n` +
               `• Username: @${safeUsername}`;

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// ====== /help ======
bot.onText(/\/help/, async (msg) => {
  const text = `ℹ️ *Commands*:\n` +
               `/start - Welcome message\n` +
               `/help - This message\n` +
               `/events - List events by city\n` +
               `/myevents - Your registered events\n` +
               `/ticket - Get ticket for event\n` +
               `/user_edit - Edit your profile\n` +
               `/scan - Scan QR code (organizers only)\n` +
               `/myid - Show your Telegram ID and username`;

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// /events
bot.onText(/\/events/, async (msg) => {
  const chatId = msg.chat.id;
  const cities = await getAvailableCities();
  if (!cities.length) return bot.sendMessage(chatId, '📭 No upcoming events available.');

  const opts = {
    reply_markup: {
      inline_keyboard: cities.map(city => [{ text: city, callback_data: `city_${city}` }])
    }
  };
  bot.sendMessage(chatId, '📍 Select your city to see upcoming events:', opts);
});

// /user_edit
bot.onText(/\/user_edit/, async (msg) => {
  const tgId = String(msg.from.id);
  const profile = await getUserProfile(tgId);
  if (!profile) return bot.sendMessage(msg.chat.id, '⚠️ Please use /start first.');

  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✏️ Edit Email', callback_data: 'edit_email' }],
        [{ text: '✏️ Edit City', callback_data: 'edit_city' }]
      ]
    }
  };
  bot.sendMessage(msg.chat.id, 'Select a field to edit:', opts);
});

// /ticket
bot.onText(/\/ticket/, async (msg) => {
  const tgId = String(msg.from.id);
  const events = await getUserEvents(tgId);
  if (!events.length) return bot.sendMessage(msg.chat.id, '📭 You are not registered for any events.');

  const opts = { reply_markup: { inline_keyboard: [] } };
  events.forEach(e => {
    const dateStr = new Date(e.datetime).toLocaleString();
    opts.reply_markup.inline_keyboard.push([
      { text: `${e.name} — ${dateStr}`, callback_data: `ticket_${e.id}` }
    ]);
  });
  bot.sendMessage(msg.chat.id, 'Select an event to get your ticket:', opts);
});

// /myevents
// /myevents - show user's events with single line + ticket button
bot.onText(/\/myevents/, async (msg) => {
  const tgId = String(msg.from.id);
  const events = await getUserEvents(tgId);

  if (!events.length) {
    return bot.sendMessage(msg.chat.id, '📭 You are not registered for any events yet.');
  }

  // Build inline keyboard & text
  const opts = { reply_markup: { inline_keyboard: [] } };
  let text = '📅 *Your upcoming events*:\n\n';

  events.forEach((e, i) => {
    const dateStr = new Date(e.datetime).toLocaleString();
    const eventName = escapeMarkdownV1(e.name);
    const eventDate = escapeMarkdownV1(dateStr);

    text += `• ${eventName} — ${eventDate}\n`; // 1 line per event
    opts.reply_markup.inline_keyboard.push([
      { text: '🎟 Ticket', callback_data: `ticket_${e.id}` }
    ]);
  });

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown', ...opts });
});

// /scan
bot.onText(/\/scan/, async (msg) => {
  const tgId = String(msg.from.id);
  await startScan(tgId, msg.chat.id);
});

// ====== CALLBACK QUERY ======
bot.on('callback_query', async (query) => {
  const tgId = String(query.from.id);
  const data = query.data;

  // City selection
  if (data.startsWith('city_')) {
    const city = data.split('_')[1];
    await showEvents(query.message.chat.id, city);
    return bot.answerCallbackQuery(query.id);
  }

  // Ticket
  if (data.startsWith('ticket_')) {
    const eventId = parseInt(data.split('_')[1], 10);
    const events = await getUserEvents(tgId);
    const event = events.find(e => e.id === eventId);
    if (!event) return bot.answerCallbackQuery(query.id, { text: '⚠️ Not registered.' });
    await sendTicket(query.message.chat.id, tgId, eventId, event.name);
    return bot.answerCallbackQuery(query.id);
  }

  // Register
  if (data.startsWith('register_')) {
    const eventId = parseInt(data.split('_')[1], 10);
    const profile = await getUserProfile(tgId);
    const username = profile?.telegram_username || '';
    const email = profile?.email || null;
    const wallet = profile?.wallet_address || null;

    const res = await registerUser(eventId, tgId, username, email, wallet);
    bot.answerCallbackQuery(query.id, { text: res.statusMsg });
    return;
  }

  // Details
  if (data.startsWith('details_')) {
    const eventId = parseInt(data.split('_')[1], 10);
    const eventRes = await pool.query('SELECT * FROM events WHERE id=$1', [eventId]);
    const event = eventRes.rows[0];
    if (!event) return bot.answerCallbackQuery(query.id, { text: 'Event not found.' });

    const dateStr = new Date(event.datetime).toLocaleString();
    let text = `ℹ️ *${escapeMarkdownV1(event.name)}*\n`;
    text += `📍 City: ${escapeMarkdownV1(event.city)}\n`;
    text += `📅 Date/Time: ${escapeMarkdownV1(dateStr)}\n`;
    if (event.description) text += `📝 Description: ${escapeMarkdownV1(event.description)}\n`;
    if (event.venue) text += `🏛 Venue: ${escapeMarkdownV1(event.venue)}\n`;
    bot.sendMessage(query.message.chat.id, text, { parse_mode: 'Markdown' });
    bot.answerCallbackQuery(query.id);
  }

  // Edit profile
  if (data.startsWith('edit_')) {
    const field = data.split('_')[1];
    userStates[tgId] = { step: 'editingProfile', field };
    bot.sendMessage(query.message.chat.id, `✏️ Please send the new ${field}`);
    bot.answerCallbackQuery(query.id);
  }
});

// ====== MESSAGE HANDLER FOR SCAN / PROFILE EDIT ======
bot.on('message', async (msg) => {
  const tgId = String(msg.from.id);
  const state = userStates[tgId];
  if (!state) return;

  // Scanning QR
  if (state.step === 'scanningTicket') {
    try {
      let qrData;

      if (msg.text && msg.text.startsWith('{') && msg.text.includes('eventId')) {
        qrData = msg.text;
      } else if (msg.photo && msg.photo.length) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        qrData = await scanQrFromTelegramPhoto(fileId);
      } else {
        return bot.sendMessage(msg.chat.id, '⚠️ Please send a valid QR code (text or photo).');
      }

      const result = await validateTicket(tgId, qrData);
      bot.sendMessage(msg.chat.id, result.msg, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error(err);
      bot.sendMessage(msg.chat.id, '❌ Failed to scan QR code.');
    } finally {
      delete userStates[tgId];
    }
    return;
  }

  // Editing profile
  if (state.step === 'editingProfile') {
    const field = state.field;
    await saveUserProfile(tgId, { [field]: msg.text });
    bot.sendMessage(msg.chat.id, `✅ ${field} updated successfully.`);
    delete userStates[tgId];
    return;
  }
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

