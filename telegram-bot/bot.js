import TelegramBot from 'node-telegram-bot-api';
import pkg from 'pg';
import dotenv from 'dotenv';
import express from 'express';
import { runMigrations } from './migrations.js';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';

dotenv.config();
const { Pool } = pkg;

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

// Express
const app = express();
app.use(express.json());

// Telegram bot
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
const userStates = {};

// DB helpers
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

// Email notifications
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

// Registration
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

// Generate a permanent ticket token for the user
function generateTicketToken(eventId, tgId, guestUsername) {
  const secret = process.env.TICKET_SECRET;
  if (!secret) throw new Error('TICKET_SECRET missing');

  // No timestamp, just user + event + signature
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${tgId}|${eventId}`)
    .digest('hex');

  const payload = { guest_id: tgId, guest_username: guestUsername, eventId, sig };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}


// Ticket send (deep link)
async function sendTicket(chatId, tgId, eventId, eventName, guestUsername) {
  const events = await getUserEvents(tgId);
  const isRegistered = events.some(e=>e.id===eventId);
  if(!isRegistered) return bot.sendMessage(chatId,'⚠️ You are not registered for this event.');

  const token = generateTicketToken(eventId, tgId, guestUsername);
  const link = `https://t.me/${process.env.BOT_USERNAME}?start=${token}`;

  bot.sendMessage(chatId, `🎟 Ticket for ${eventName}\nClick to verify: ${link}`);
}

// Deep link verifier
async function verifyLongTermTicket(token, scannerTgId) {
  let payload;
  try {
    payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    return { success: false, msg: 'Invalid token format' };
  }

  const secret = process.env.TICKET_SECRET;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${payload.guest_id}|${payload.eventId}`)
    .digest('hex');

  if (expectedSig !== payload.sig) return { success: false, msg: 'Bad signature' };

  // Check registration
  const regRes = await pool.query(
    `SELECT r.*, e.name as event_name, e.datetime 
     FROM registrations r 
     JOIN events e ON r.event_id=e.id 
     WHERE r.telegram_user_id=$1 AND r.event_id=$2`,
    [payload.guest_id, payload.eventId]
  );
  const registration = regRes.rows[0];
  if (!registration) return { success: false, msg: 'No registration found' };
  if (registration.ticket_validated) return { success: false, msg: 'Ticket already used' };

  // Mark ticket as validated by scanner
  await pool.query(
    `UPDATE registrations 
     SET ticket_validated=TRUE, validated_by=$1, validated_at=NOW() 
     WHERE telegram_user_id=$2 AND event_id=$3`,
    [scannerTgId, payload.guest_id, payload.eventId]
  );

  return { success: true, guest_username: payload.guest_username, eventName: registration.event_name };
}

// ===== COMMANDS =====
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  const payload = match[1];

  const profile = await getUserProfile(tgId);
  if (!profile) await saveUserProfile(tgId,{ telegram_username:username });

  if (!payload) {
    return bot.sendMessage(msg.chat.id,
      `👋 Welcome ${username}! Use /events to see events, /myevents for your registrations, /user_edit to add email, /help for commands.`);
  }

  try {
    const result = await verifyDeepLinkToken(payload, tgId);
    if (result.success) {
      bot.sendMessage(msg.chat.id,
        `✅ Welcome @${result.guest_username}!\n🎟 Ticket for "${result.eventName}" verified.`);
    } else {
      bot.sendMessage(msg.chat.id, `❌ Verification failed: ${result.msg}`);
    }
  } catch (err) {
    console.error('Deep link verification error', err);
    bot.sendMessage(msg.chat.id, '❌ Internal error verifying ticket.');
  }
});

bot.onText(/\/help/, async (msg)=>{
  bot.sendMessage(msg.chat.id,
`ℹ️ Commands:
- /start - Welcome message
- /help - This message
- /events - List events by city
- /myevents - Your registered events
- /ticket - Get ticket for event
- /user_edit - Add/update email
- /myid - Show your Telegram ID
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

bot.onText(/\/ticket/, async (msg)=>{
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  const events = await getUserEvents(tgId);
  if(!events.length) return bot.sendMessage(msg.chat.id,'📭 Not registered for events.');
  const opts = { reply_markup:{ inline_keyboard: [] } };
  events.forEach(e=>{
    const dateStr = new Date(e.datetime).toLocaleString();
    opts.reply_markup.inline_keyboard.push([{ text:`🎟 Ticket: ${e.name}`, callback_data:`ticket_${e.id}` }]);
  });
  bot.sendMessage(msg.chat.id,'Select event for ticket:',opts);
});

bot.onText(/\/myevents/, async (msg)=>{
  const tgId = String(msg.from.id);
  const events = await getUserEvents(tgId);
  if(!events.length) return bot.sendMessage(msg.chat.id,'📭 No registered events.');
  const opts = { reply_markup:{ inline_keyboard: [] } };
  let text = '📅 Your upcoming events:\n';
  events.forEach(e=>{
    const dateStr = new Date(e.datetime).toLocaleString();
    text += `\n• ${e.name} — ${dateStr}`;
    opts.reply_markup.inline_keyboard.push([{ text:'🎟 Ticket', callback_data:`ticket_${e.id}` }]);
  });
  bot.sendMessage(msg.chat.id,text,opts);
});

// ===== HELPER: showEvents =====
async function showEvents(chatId, city) {
  const events = await getOpenEventsByCity(city);
  if (!events.length) {
    return bot.sendMessage(chatId, `📭 No upcoming events in ${city}.`);
  }

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

// ===== CALLBACK QUERY =====
bot.on('callback_query', async (query)=>{
  const tgId = String(query.from.id);
  const data = query.data;

  if(data.startsWith('city_')){
    const city = data.split('_')[1];
    await showEvents(query.message.chat.id, city);
    return bot.answerCallbackQuery(query.id);
  }

  if(data.startsWith('ticket_')){
    const eventId = parseInt(data.split('_')[1],10);
    const events = await getUserEvents(tgId);
    const event = events.find(e=>e.id===eventId);
    if(!event) return bot.answerCallbackQuery(query.id,'⚠️ Not registered.');
    await sendTicket(query.message.chat.id,tgId,eventId,event.name,query.from.username||'');
    return bot.answerCallbackQuery(query.id);
  }

  if(data.startsWith('register_')){
    const eventId = parseInt(data.split('_')[1],10);
    const profile = await getUserProfile(tgId);
    const result = await registerUser(eventId,tgId,profile?.telegram_username||'',profile?.email||'');
    bot.sendMessage(query.message.chat.id,result.statusMsg);
    return bot.answerCallbackQuery(query.id);
  }

  if(data.startsWith('details_')){
    const eventId = parseInt(data.split('_')[1],10);
    const res = await pool.query('SELECT * FROM events WHERE id=$1',[eventId]);
    const event = res.rows[0];
    if(!event) return bot.answerCallbackQuery(query.id,'⚠️ Event not found.');
    const dateStr = new Date(event.datetime).toLocaleString();
    let text = `📌 Event: ${event.name}\nCity: ${event.city}\nDate/Time: ${dateStr}\nMin/Max attendees: ${event.min_attendees}/${event.max_attendees}\nConfirmed: ${event.is_confirmed ? '✅' : '⌛'}\nDescription: ${event.description || 'N/A'}\nVenue: ${event.venue || 'N/A'}\nPerk: ${event.basic_perk || 'N/A'}`;
    bot.sendMessage(query.message.chat.id,text);
    return bot.answerCallbackQuery(query.id);
  }

  bot.answerCallbackQuery(query.id);
});


// Handle incoming messages for user_edit
bot.on('message', async (msg) => {
  const tgId = String(msg.from.id);
  const state = userStates[tgId];
  if (msg.text && msg.text.startsWith('/')) return;
  if (state?.step === 'editingProfile' && state.field === 'email') {
    const email = msg.text?.trim();
    if (!email || !email.includes('@')) {
      return bot.sendMessage(msg.chat.id, '⚠️ Invalid email. Please send a valid email address.');
    }
    await saveUserProfile(tgId, { email });
    bot.sendMessage(msg.chat.id, `✅ Email updated to: ${email}`);
    delete userStates[tgId];
  }
});

// ===== WEBHOOK =====
bot.setWebHook(`${PUBLIC_URL}/bot${BOT_TOKEN}`);
app.post(`/bot${BOT_TOKEN}`, (req,res)=>{ bot.processUpdate(req.body); res.sendStatus(200); });

// Start server
app.listen(PORT,()=>console.log(`🚀 Bot listening on port ${PORT}`));

