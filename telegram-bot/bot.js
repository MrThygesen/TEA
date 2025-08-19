import TelegramBot from 'node-telegram-bot-api';
import pkg from 'pg';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import express from 'express';
import { runMigrations } from './migrations.js';
import fetch from 'node-fetch';
import sgMail from '@sendgrid/mail';

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

// ====== EVENT CONFIRMATION EMAIL HELPER ======
async function notifyEventConfirmedViaApi(eventId, eventName, eventCity, eventDateTime) {
  try {
    const regRes = await pool.query(
      'SELECT email, wallet_address, telegram_username FROM registrations WHERE event_id=$1 AND email IS NOT NULL',
      [eventId]
    );
    const attendees = regRes.rows;

    if (!attendees.length) {
      console.log('ℹ️ No attendees with emails for this event.');
      return;
    }

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
          <p>We look forward to seeing you there.</p>
        `
      };
      await sgMail.send(msg);
    }));

    console.log(`📧 Event confirmation sent to ${attendees.length} attendees`);
  } catch (err) {
    console.error('❌ Failed to send event confirmation via SendGrid', err);
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
    if (err.response && err.response.statusCode === 429) {
      const retryAfter = err.response.headers['retry-after'] || 1;
      console.warn(`⚠️ Telegram rate limited. Retry after ${retryAfter}s`);
    } else {
      console.error('❌ Webhook setup failed:', err.message);
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

    const eventDetailsRes = await pool.query(
      'SELECT name, city, datetime FROM events WHERE id=$1',
      [eventId]
    );
    const details = eventDetailsRes.rows[0];
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

// ====== TICKET HELPER ======
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

    return { success: true, msg: `✅ Ticket for user validated successfully.` };
  } catch (err) {
    console.error('❌ Error validating ticket', err);
    return { success: false, msg: '❌ Error validating ticket.' };
  }
}

// ====== SHOW EVENTS WITH BUTTONS ======
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
  ].join('\n');
  bot.sendMessage(msg.chat.id, escapeMarkdownV1(text), { parse_mode: 'Markdown' });
});

// /start handler (patch)
bot.onText(/\/start/, async (msg) => {
  const tgId = String(msg.from.id);
  const username = msg.from.username || null;
  const chatId = msg.chat.id;

  try {
    // Upsert user profile with Telegram ID + username
    await pool.query(
      `INSERT INTO user_profiles (telegram_user_id, telegram_username)
       VALUES ($1, $2)
       ON CONFLICT (telegram_user_id) DO UPDATE
         SET telegram_username = EXCLUDED.telegram_username,
             updated_at = NOW()`,
      [tgId, username]
    );
  } catch (err) {
    console.error('❌ Error upserting user profile on /start:', err);
    return bot.sendMessage(chatId, '⚠️ Error linking your account.');
  }

  // City selection flow
  const cities = await getAvailableCities();
  if (!cities.length) return bot.sendMessage(chatId, '📭 No cities available.', { parse_mode: 'Markdown' });

  const opts = {
    reply_markup: {
      inline_keyboard: cities.map(city => [{ text: city, callback_data: `setstartcity_${encodeURIComponent(city)}` }])
    }
  };
  userStates[tgId] = { step: 'choosingStartCity' };
  bot.sendMessage(chatId, '🌍 Please choose your city:', { parse_mode: 'Markdown', ...opts });
});


// ====== /myid ======
bot.onText(/\/myid/, (msg) => {
  const tgId = msg.from.id;
  const username = msg.from.username || 'No username set';
  bot.sendMessage(
    msg.chat.id,
    `👤 Your Telegram ID: ${tgId}\n` +
    `🆔 Your Telegram username: @${username}\n\n` +
    `Share this ID with an admin to get scanner or organizer access.`
  );
});

// ====== /events ======
bot.onText(/\/events/, async (msg) => {
  const tgId = String(msg.from.id);
  const profile = await getUserProfile(tgId);
  if (!profile?.city) return bot.sendMessage(msg.chat.id, '⚠️ Please use /start first to select your city.', { parse_mode: 'Markdown' });
  await showEvents(msg.chat.id, profile.city);
});

// ====== /user_edit ======
bot.onText(/\/user_edit/, async (msg) => {
  const tgId = String(msg.from.id);
  const profile = await getUserProfile(tgId);
  if (!profile) return bot.sendMessage(msg.chat.id, '⚠️ Please use /start first.', { parse_mode: 'Markdown' });

  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✉️ Edit Email', callback_data: 'edit_email' }],
        [{ text: '💰 Edit Wallet', callback_data: 'edit_wallet' }],
        [{ text: '🎯 Edit Tier', callback_data: 'edit_tier' }]
      ]
    }
  };
  bot.sendMessage(msg.chat.id, '🛠 Choose a field to edit:', { parse_mode: 'Markdown', ...opts });
});

// ====== /myevents ======
bot.onText(/\/myevents/, async (msg) => {
  const tgId = String(msg.from.id);
  const events = await getUserEvents(tgId);
  if (!events.length) return bot.sendMessage(msg.chat.id, '📭 You are not registered for any events yet.', { parse_mode: 'Markdown' });

  const opts = { reply_markup: { inline_keyboard: [] } };
  let text = '📅 *Your upcoming events*:\n';
  events.forEach((e) => {
    const dateStr = new Date(e.datetime).toLocaleString();
    text += `\n• *${escapeMarkdownV1(e.name)}* — ${escapeMarkdownV1(dateStr)}`;
    opts.reply_markup.inline_keyboard.push([{ text: '🎟 Get Ticket', callback_data: `ticket_${e.id}` }]);
  });
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown', ...opts });
});

// ====== /ticket ======
bot.onText(/\/ticket/, async (msg) => {
  const tgId = String(msg.from.id);
  const events = await getUserEvents(tgId);
  if (!events.length) return bot.sendMessage(msg.chat.id, '📭 You have no tickets available.', { parse_mode: 'Markdown' });
  if (events.length === 1) return sendTicket(msg.chat.id, tgId, events[0].id, events[0].name);
  bot.sendMessage(msg.chat.id, 'Please use /myevents to select a ticket.', { parse_mode: 'Markdown' });
});

// ====== CALLBACK QUERY ======
bot.on('callback_query', async (query) => {
  const tgId = String(query.from.id);
  const state = userStates[tgId];
  const data = decodeURIComponent(query.data);

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

  // INLINE VALIDATE BUTTON
  if (data.startsWith('validate_')) {
    const ticketData = data.replace('validate_', '');
    const result = await validateTicket(tgId, ticketData);
    return bot.sendMessage(query.message.chat.id, result.msg, { parse_mode: 'Markdown' });
  }
});

// ====== HANDLE SCANNED QR TICKETS ======
bot.on('message', async (msg) => {
  const tgId = String(msg.from.id);
  const text = msg.text;
  if (!text || !text.startsWith('{') || !text.includes('eventId')) return;

  const result = await validateTicket(tgId, text);
  bot.sendMessage(tgId, result.msg, { parse_mode: 'Markdown' });
});

// ====== START EXPRESS SERVER ======
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await setWebhook();
});

