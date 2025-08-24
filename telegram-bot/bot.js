
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
    `SELECT id,name,datetime,min_attendees,max_attendees,is_confirmed
     FROM events
     WHERE datetime>NOW() AND LOWER(city)=LOWER($1)
     ORDER BY datetime ASC`, [city]
  );
  return res.rows;
}

async function getUserEvents(tgId) {
  const res = await pool.query(
    `SELECT e.id, e.name, e.datetime
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

// ==== COMMANDS ====
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  const payload = match[1];

  const profile = await getUserProfile(tgId);
  if (!profile) await saveUserProfile(tgId,{ telegram_username:username });

  if (payload && !isNaN(payload)) {
    const eventId = parseInt(payload, 10);
    const profile = await getUserProfile(tgId);
    const res = await registerUser(eventId, tgId, profile?.telegram_username || '', profile?.email, profile?.wallet_address);
    return bot.sendMessage(msg.chat.id, `🔗 Deep link detected: Event ${eventId}\n${res.statusMsg}`);
  }

  return bot.sendMessage(msg.chat.id,
    `👋 Welcome ${username}! Use /events to see events, /myevents for your registrations, /user_edit to add email, /help for commands.`);
});

bot.onText(/\/help/, async (msg)=>{
  bot.sendMessage(msg.chat.id,
`ℹ️ Commands:
- /start - Welcome message
- /help - This message
- /events - List events by city
- /myevents - Your registered events
- /ticket - Show your ticket
- /user_edit - Add/update email
- /myid - Show your Telegram ID
- /event_admin - Organizer dashboard
`);
});

bot.onText(/\/myid/, async (msg)=>{
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  bot.sendMessage(msg.chat.id, `🆔 Your Telegram ID: ${tgId}\nUsername: @${username}`);
});

bot.onText(/\/events/, async (msg)=>{
  const chatId = msg.chat.id;
  const cities = await getAvailableCities();
  if(!cities.length) return bot.sendMessage(chatId,'📭 No upcoming events.');
  const opts = { reply_markup:{ inline_keyboard: cities.map(city=>[{ text: city, callback_data:`city_${city}`}]) } };
  bot.sendMessage(chatId,'📍 Select your city:',opts);
});

bot.onText(/\/user_edit/, async (msg)=>{
  const tgId = String(msg.from.id);
  const profile = await getUserProfile(tgId);
  if(!profile) await saveUserProfile(tgId,{ telegram_username:msg.from.username||'' });

  userStates[tgId] = { step:'editingProfile', field:'email' };
  bot.sendMessage(msg.chat.id,`📧 Current email: ${profile?.email || 'N/A'}\nSend a new email to update.`);
});

// ==== MY EVENTS ====
bot.onText(/\/myevents/, async (msg)=>{
  const tgId = String(msg.from.id);
  const events = await getUserEvents(tgId);
  if(!events.length) return bot.sendMessage(msg.chat.id,'📭 You are not registered for any events.');

  for (const e of events) {
    const dateStr = new Date(e.datetime).toLocaleString();
    await bot.sendMessage(msg.chat.id,
      `📅 ${e.name} — ${dateStr}\n/event_detail_${e.id} to see details\n/deregister_${e.id} to leave the event`
    );
  }
});

// ==== DEREGISTER ====
bot.onText(/\/deregister_(\d+)/, async (msg, match) => {
  const eventId = parseInt(match[1], 10);
  const tgId = String(msg.from.id);
  await pool.query('DELETE FROM registrations WHERE event_id=$1 AND telegram_user_id=$2', [eventId, tgId]);
  await bot.sendMessage(msg.chat.id, `❌ You have been deregistered from event ${eventId}.`);
});

// ==== TICKET VIEW ====
bot.onText(/\/ticket/, async (msg)=>{
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  const events = await getUserEvents(tgId);
  if(!events.length) return bot.sendMessage(msg.chat.id,'📭 Not registered for events.');

  events.forEach(e=>{
    const dateStr = new Date(e.datetime).toLocaleString();
    const ticketText = 
      `🎫 Ticket for event: ${e.name}\n` +
      `🆔 Ticket ID: ${e.id}\n` +
      `👤 Username: @${username}\n` +
      `📅 Date/Time: ${dateStr}\n` +
      `📌 Show this ticket at the entrance/staff.\n` +
      `/event_detail_${e.id}`;
    bot.sendMessage(msg.chat.id, ticketText);
  });
});

// ==== EVENT DETAIL ====
bot.onText(/\/event_detail_(\d+)/, async (msg, match)=>{
  const eventId = parseInt(match[1],10);
  const res = await pool.query('SELECT * FROM events WHERE id=$1',[eventId]);
  const event = res.rows[0];
  if(!event) return bot.sendMessage(msg.chat.id,'⚠️ Event not found.');
  const dateStr = new Date(event.datetime).toLocaleString();
  let text = `📌 Event: ${event.name}\nCity: ${event.city}\nDate/Time: ${dateStr}\nMin/Max attendees: ${event.min_attendees}/${event.max_attendees}\nConfirmed: ${event.is_confirmed ? '✅' : '⌛'}\nDescription: ${event.description || 'N/A'}\nVenue: ${event.venue || 'N/A'}\nBasic perk: ${event.basic_perk || 'N/A'}\nAdvanced perk: ${event.advanced_perk || 'N/A'}`;
  bot.sendMessage(msg.chat.id,text);
});

// Keep legacy see_event_detail working
bot.onText(/\/see_event_detail_(\d+)/, async (msg, match)=>{
  const eventId = parseInt(match[1],10);
  const res = await pool.query('SELECT * FROM events WHERE id=$1',[eventId]);
  const event = res.rows[0];
  if(!event) return bot.sendMessage(msg.chat.id,'⚠️ Event not found.');
  const dateStr = new Date(event.datetime).toLocaleString();
  let text = `📌 Event: ${event.name}\nCity: ${event.city}\nDate/Time: ${dateStr}\nMin/Max attendees: ${event.min_attendees}/${event.max_attendees}\nConfirmed: ${event.is_confirmed ? '✅' : '⌛'}\nDescription: ${event.description || 'N/A'}\nVenue: ${event.venue || 'N/A'}\nBasic perk: ${event.basic_perk || 'N/A'}\nAdvanced perk: ${event.advanced_perk || 'N/A'}`;
  bot.sendMessage(msg.chat.id,text);
});

// ==== SHOW EVENTS (USER CITY) ====
async function showEvents(chatId, city) {
  const events = await getOpenEventsByCity(city);
  if (!events.length) return bot.sendMessage(chatId, `📭 No upcoming events in ${city}.`);

  const opts = { reply_markup: { inline_keyboard: [] } };
  let text = `📅 Upcoming events in ${city}:\n`;

  events.forEach(e => {
    const dateStr = new Date(e.datetime).toLocaleString();
    text += `\n• ${e.name} — ${dateStr}`;
    opts.reply_markup.inline_keyboard.push([
      { text: 'Details', callback_data: `details_${e.id}` },
      { text: 'Register', callback_data: `register_${e.id}` }
    ]);
  });

  bot.sendMessage(chatId, text, opts);
}

// ==== SHOW ATTENDEES ====
async function showAttendees(chatId, eventId) {
  const { rows: [event] } = await pool.query(`SELECT id, basic_perk, advanced_perk FROM events WHERE id=$1`, [eventId]);
  const { rows: regs } = await pool.query(`
    SELECT r.id, r.telegram_username, u.role, 
           r.has_arrived, r.voucher_applied, r.basic_perk_applied, r.advanced_perk_applied
    FROM registrations r
    JOIN user_profiles u ON u.telegram_user_id = r.telegram_user_id
    WHERE r.event_id=$1
    ORDER BY r.id ASC
  `, [eventId]);

  if (!regs.length) return bot.sendMessage(chatId, '📭 No attendees yet.');

  let text = `👥 Attendees for event ID ${eventId}:\n`;
  regs.forEach(r => {
    text += `\n@${r.telegram_username} | Role: ${r.role} | Arrived: ${r.has_arrived ? '✅':'❌'} | Voucher: ${r.voucher_applied?'✅':'❌'} | Basic perk: ${r.basic_perk_applied?'✅':'❌'} | Advanced perk: ${r.advanced_perk_applied?'✅':'❌'}`;
  });

  bot.sendMessage(chatId, text);
}

// ==== EVENT ADMIN (ORGANIZER) ====
bot.onText(/\/event_admin/, async (msg)=>{
  const chatId = msg.chat.id;
  const tgId = String(msg.from.id);

  const profile = await getUserProfile(tgId);
  if(!profile || !profile.group_id) return bot.sendMessage(chatId,'⚠️ You are not assigned to any group.');

  const { rows: events } = await pool.query(
    `SELECT id,name,datetime,is_confirm




if(!events.length) return bot.sendMessage(chatId,'📭 No events for your group yet.');


for(const e of events){
const dateStr = new Date(e.datetime).toLocaleString();
const opts = { reply_markup:{ inline_keyboard:[[
{ text:'Show Attendees', callback_data:`showattendees_${e.id}` }
]] }};
await bot.sendMessage(chatId, `📅 ${e.name} — ${dateStr}\nConfirmed: ${e.is_confirmed?'✅':'⌛'}`, opts);
}
});


// ==== CALLBACK QUERIES ====
bot.on('callback_query', async (query)=>{
const data = query.data;
const chatId = query.message.chat.id;
const tgId = String(query.from.id);


if(data.startsWith('city_')){
const city = data.split('_')[1];
await showEvents(chatId, city);
}


if(data.startsWith('details_')){
const eventId = parseInt(data.split('_')[1],10);
const res = await pool.query('SELECT * FROM events WHERE id=$1',[eventId]);
const event = res.rows[0];
if(!event) return bot.sendMessage(chatId, '⚠️ Event not found.');
const dateStr = new Date(event.datetime).toLocaleString();
const text = `📌 Event: ${event.name}\nCity: ${event.city}\nDate/Time: ${dateStr}\nMin/Max attendees: ${event.min_attendees}/${event.max_attendees}\nConfirmed: ${event.is_confirmed ? '✅' : '⌛'}\nDescription: ${event.description || 'N/A'}\nVenue: ${event.venue || 'N/A'}\nBasic perk: ${event.basic_perk || 'N/A'}\nAdvanced perk: ${event.advanced_perk || 'N/A'}`;
await bot.sendMessage(chatId, text);
}


if(data.startsWith('register_')){
const eventId = parseInt(data.split('_')[1],10);
const profile = await getUserProfile(tgId);
const res = await registerUser(eventId,tgId,profile?.telegram_username||'',profile?.email,profile?.wallet_address);
await bot.sendMessage(chatId,res.statusMsg);
}


if(data.startsWith('showattendees_')){
const eventId = parseInt(data.split('_')[1],10);
await showAttendees(chatId,eventId);
}
});


// ==== EXPRESS WEBHOOK ====
app.post(`/webhook/${BOT_TOKEN}`, (req,res)=>{
bot.processUpdate(req.body);
res.sendStatus(200);
});


bot.setWebHook(`${PUBLIC_URL}/webhook/${BOT_TOKEN}`);
app.listen(PORT,()=>console.log(`🚀 Bot running on port ${PORT}`));
