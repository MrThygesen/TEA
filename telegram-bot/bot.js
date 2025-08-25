// bot.js
import TelegramBot from 'node-telegram-bot-api';
import pkg from 'pg';
import dotenv from 'dotenv';
import express from 'express';
import { runMigrations } from './migrations.js';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';

dotenv.config();
const { Pool } = pkg;

// ==== CONFIG ====
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) { console.error('❌ TELEGRAM_BOT_TOKEN missing'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL missing'); process.exit(1); }

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || 'https://example.onrender.com';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Run migrations
await runMigrations();
console.log('✅ Database migrations complete.');

// ==== EXPRESS ====
const app = express();
app.use(express.json());

// ==== TELEGRAM BOT ====
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
const userStates = {};

// ==== DB HELPERS ====
async function getUserProfile(tgId) {
  const res = await pool.query('SELECT * FROM user_profiles WHERE telegram_user_id=$1', [tgId]);
  return res.rows[0] || null;
}

async function saveUserProfile(tgId, data = {}) {
  const keys = Object.keys(data);
  if (!keys.length) return;
  const values = Object.values(data);
  const setClause = keys.map((k,i)=>`${k}=$${i+2}`).join(', ');
  await pool.query(
    `INSERT INTO user_profiles (telegram_user_id, ${keys.join(',')})
     VALUES ($1, ${keys.map((_,i)=>`$${i+2}`).join(',')})
     ON CONFLICT (telegram_user_id) DO UPDATE SET ${setClause}, updated_at=CURRENT_TIMESTAMP`,
    [tgId, ...values]
  );
}

async function getAvailableCities() {
  const res = await pool.query('SELECT DISTINCT city FROM events WHERE datetime>NOW() ORDER BY city ASC');
  return res.rows.map(r => r.city);
}

async function getOpenEventsByCity(city) {
  const res = await pool.query(
    `SELECT id,name,datetime,min_attendees,max_attendees,is_confirmed, price
     FROM events
     WHERE datetime>NOW() AND LOWER(city)=LOWER($1)
     ORDER BY datetime ASC`, [city]
  );
  return res.rows;
}

async function getUserEvents(tgId) {
  const res = await pool.query(
    `SELECT e.id, e.name, e.datetime, e.price, r.has_paid
     FROM registrations r
     JOIN events e ON r.event_id=e.id
     WHERE r.telegram_user_id=$1
     ORDER BY e.datetime ASC`, [tgId]
  );
  return res.rows;
}

// ==== EMAIL NOTIFICATIONS ====
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
        text: `Hi ${attendee.telegram_username || ''},\n\nYour event "${eventName}" is now confirmed! 🎉\nDate/Time: ${eventDateTime || 'TBA'}\nCity: ${eventCity || 'TBA'}`
      };
      await sgMail.send(msg);
    }));
    console.log(`📧 Event confirmation sent to ${attendees.length} attendees`);
  } catch (err) {
    console.error('❌ Failed to send event confirmation via SendGrid', err);
  }
}

// ==== REGISTRATION ====
async function registerUser(eventId, tgId, username, email, wallet) {
  const regCheck = await pool.query('SELECT * FROM registrations WHERE event_id=$1 AND telegram_user_id=$2', [eventId,tgId]);
  const alreadyRegistered = regCheck.rows.length>0;

  const eventRes = await pool.query('SELECT name,min_attendees,max_attendees,is_confirmed FROM events WHERE id=$1',[eventId]);
  const event = eventRes.rows[0];
  if(!event) return { statusMsg:'⚠️ Event not found.', confirmed:false };

  const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1',[eventId]);
  const count = countRes.rows[0]?.count||0;
  if(event.max_attendees && !alreadyRegistered && count>=event.max_attendees) return { statusMsg:'⚠️ Sorry, this event is full.', confirmed:false };

  if(!alreadyRegistered){
    await pool.query(
      `INSERT INTO registrations (event_id,telegram_user_id,telegram_username,email,wallet_address)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (event_id,telegram_user_id) DO NOTHING`,
      [eventId,tgId,username,email,wallet||null]
    );
  }

  const newCountRes = await pool.query('SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1',[eventId]);
  const newCount = newCountRes.rows[0]?.count||0;
  let statusMsg = `👥 ${newCount} people registered.\n`;
  if(alreadyRegistered) statusMsg = `ℹ️ You have already registered.\n${statusMsg}`;

  if(!event.is_confirmed && newCount>=event.min_attendees){
    await pool.query('UPDATE events SET is_confirmed=TRUE WHERE id=$1',[eventId]);
    statusMsg += '✅ Event now confirmed!';

    const detailsRes = await pool.query('SELECT name,city,datetime FROM events WHERE id=$1',[eventId]);
    const details = detailsRes.rows[0];
    const eventDateTime = details ? new Date(details.datetime).toLocaleString() : '';
    await notifyEventConfirmedViaApi(eventId,event.name,details?.city,eventDateTime);
  } else if(!event.is_confirmed){
    statusMsg += '⌛ Awaiting confirmation.';
  } else { statusMsg += '✅ Already confirmed.'; }

  return { confirmed:newCount>=event.min_attendees, eventName:event.name, statusMsg };
}

// ==== TICKET TOKEN ====
function generateTicketToken(eventId, tgId, guestUsername) {
  const secret = process.env.TICKET_SECRET;
  if (!secret) throw new Error('TICKET_SECRET missing');

  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${tgId}|${eventId}`)
    .digest('hex');

  const payload = { guest_id: tgId, guest_username: guestUsername, eventId, sig };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

// ==== HELPER: EMAIL CHECK ====
function isLikelyEmail(s) {
  return typeof s === 'string' && s.includes('@') && s.includes('.');
}

// ==== COMMANDS (/start, /help, /myid, /events, /user_edit, /cancel, /message capture, /myevents, /deregister, /ticket, /event_detail) ====
// <<< KEEP OLD FUNCTIONALITY >>>
// (All your original command implementations remain unchanged here)

// ==== PAY COMMAND ====
bot.onText(/\/pay_(\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const tgId = String(msg.from.id);
  const eventId = parseInt(match[1], 10);

  try {
    const reg = await pool.query(
      `SELECT id, has_paid FROM registrations WHERE event_id=$1 AND telegram_user_id=$2`,
      [eventId, tgId]
    );

    if (!reg.rows.length) {
      return bot.sendMessage(chatId, '⚠️ You are not registered for this event.');
    }

    if (reg.rows[0].has_paid) {
      return bot.sendMessage(chatId, '💳 Payment is already marked for this event.');
    }

    await pool.query(
      `UPDATE registrations
       SET has_paid=TRUE, paid_at=NOW()
       WHERE event_id=$1 AND telegram_user_id=$2`,
      [eventId, tgId]
    );

    bot.sendMessage(chatId, `✅ Payment recorded for event ID ${eventId}. Thank you!`);
  } catch (err) {
    console.error('❌ /pay error:', err);
    bot.sendMessage(chatId, '❌ Failed to update payment. Try again later.');
  }
});

// ==== EXPRESS WEBHOOK ====
app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.setWebHook(`${PUBLIC_URL}/webhook/${BOT_TOKEN}`);
app.listen(PORT, () => console.log(`🚀 Bot running on port ${PORT}`));

