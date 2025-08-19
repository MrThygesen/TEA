import TelegramBot from 'node-telegram-bot-api';
import pkg from 'pg';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import express from 'express';
import { runMigrations } from './migrations.js';
import sgMail from '@sendgrid/mail';
import axios from 'axios'; 
import  * as Jimp from 'jimp';
import QrCode from 'qrcode-reader';

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

// Markdown V1 escape
function escapeMarkdownV1(text) {
  if (!text) return '';
  return text.toString().replace(/([\\_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

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

// Ticket generation
async function sendTicket(chatId,tgId,eventId,eventName){
  const events = await getUserEvents(tgId);
  const isRegistered = events.some(e=>e.id===eventId);
  if(!isRegistered) return bot.sendMessage(chatId,'⚠️ You are not registered for this event.');

  const qrData = JSON.stringify({eventId,tgId});
  const qrImage = await QRCode.toBuffer(qrData);
  bot.sendPhoto(chatId, qrImage, { caption:`🎟 Ticket for ${escapeMarkdownV1(eventName)}`, parse_mode:'Markdown' });
}

// Ticket validation
async function validateTicket(scannedByTgId, scannedTicketData){
  try {
    const {eventId,tgId} = JSON.parse(scannedTicketData);
    const regRes = await pool.query('SELECT * FROM registrations WHERE telegram_user_id=$1 AND event_id=$2',[tgId,eventId]);
    const registration = regRes.rows[0];
    if(!registration) return { success:false, msg:'⚠️ Ticket not found or user not registered.' };
    if(registration.ticket_validated) return { success:false, msg:'ℹ️ Ticket already validated.' };

    const profileRes = await pool.query('SELECT role,telegram_username FROM user_profiles WHERE telegram_user_id=$1',[scannedByTgId]);
    const scannerProfile = profileRes.rows[0];
    if(!scannerProfile || scannerProfile.role!=='organizer') return { success:false, msg:'❌ Not authorized.' };

    await pool.query('UPDATE registrations SET ticket_validated=TRUE,validated_by=$1,validated_at=NOW() WHERE telegram_user_id=$2 AND event_id=$3',
      [scannedByTgId,tgId,eventId]);

    await bot.sendMessage(tgId, `✅ Your ticket for event ID ${eventId} validated by @${scannerProfile.telegram_username||'organizer'}.`);
    return { success:true, msg:'✅ Ticket validated.' };
  } catch(err){
    console.error('❌ Error validating ticket', err);
    return { success:false, msg:'❌ Error validating ticket.' };
  }
}

// QR scan helper
async function downloadFile(fileId){
  const file = await bot.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
  const resp = await axios.get(url,{responseType:'arraybuffer'});
  return Buffer.from(resp.data);
}
async function scanQrFromTelegramPhoto(fileId){
  const buffer = await downloadFile(fileId);
  try {
    const result = await QRCode.decode(buffer);
    return result;
  } catch(err){
    throw new Error('❌ Failed to decode QR code.');
  }
}

// Start scanning
async function startScan(tgId, chatId){
  const profileRes = await pool.query('SELECT role,telegram_username FROM user_profiles WHERE telegram_user_id=$1',[tgId]);
  const profile = profileRes.rows[0];
  if(!profile || profile.role!=='organizer') return bot.sendMessage(chatId,'❌ Not authorized to scan tickets.');
  userStates[tgId] = { step:'scanningTicket' };
  bot.sendMessage(chatId,'📸 Send QR code text or photo to validate ticket.');
}

// Show events
async function showEvents(chatId, city){
  const events = await getOpenEventsByCity(city);
  if(!events.length) return bot.sendMessage(chatId,'📭 No upcoming events for this city.');
  const opts = { reply_markup:{ inline_keyboard:[] } };
  let text = `🎉 Upcoming events in *${escapeMarkdownV1(city)}*:\n`;
  events.forEach((e,i)=>{
    const dateStr = new Date(e.datetime).toLocaleString();
    text += `\n${i+1}. *${escapeMarkdownV1(e.name)}* — ${escapeMarkdownV1(dateStr)}`;
    opts.reply_markup.inline_keyboard.push([
      { text:'📝 Register', callback_data:`register_${e.id}` },
      { text:'ℹ️ Details', callback_data:`details_${e.id}` }
    ]);
  });
  bot.sendMessage(chatId,text,{ parse_mode:'Markdown', ...opts });
}

// ===== BOT COMMANDS =====

// /start
bot.onText(/\/start/, async (msg) => {
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  const profile = await getUserProfile(tgId);
  if(!profile) await saveUserProfile(tgId,{ telegram_username:username });
  bot.sendMessage(msg.chat.id, `👋 Welcome ${escapeMarkdownV1(username)}! Use /events to see events, /myevents for your registrations, /user_edit to add email, /help for commands.`, { parse_mode:'Markdown' });
});

// /help
bot.onText(/\/help/, async (msg)=>{
  bot.sendMessage(msg.chat.id,
    `ℹ️ *Commands*:
/start - Welcome message
/help - This message
/events - List events by city
/myevents - Your registered events
/ticket - Get ticket for event
/user_edit - Add/update email
/scan - Scan QR code (organizers)
/myid - Show your Telegram ID
`, { parse_mode:'Markdown' });
});

// /myid
bot.onText(/\/myid/, async (msg)=>{
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';
  bot.sendMessage(msg.chat.id, `🆔 Your Telegram ID: ${tgId}\nUsername: @${escapeMarkdownV1(username)}`, { parse_mode:'Markdown' });
});

// /events
bot.onText(/\/events/, async (msg)=>{
  const chatId = msg.chat.id;
  const cities = await getAvailableCities();
  if(!cities.length) return bot.sendMessage(chatId,'📭 No upcoming events.');
  const opts = { reply_markup:{ inline_keyboard: cities.map(city=>[{ text: city, callback_data:`city_${city}`}]) } };
  bot.sendMessage(chatId,'📍 Select your city:',opts);
});

// /user_edit
bot.onText(/\/user_edit/, async (msg)=>{
  const tgId = String(msg.from.id);
  const profile = await getUserProfile(tgId);
  if(!profile) await saveUserProfile(tgId,{ telegram_username:msg.from.username||'' });

  if(!profile?.email){
    userStates[tgId] = { step:'editingProfile', field:'email' };
    bot.sendMessage(msg.chat.id,'📧 You do not have an email registered. Please send your email now.');
  } else {
    userStates[tgId] = { step:'editingProfile', field:'email' };
    bot.sendMessage(msg.chat.id,`📧 Current email: ${profile.email}\nSend a new email to update.`);
  }
});

// /ticket
bot.onText(/\/ticket/, async (msg)=>{
  const tgId = String(msg.from.id);
  const events = await getUserEvents(tgId);
  if(!events.length) return bot.sendMessage(msg.chat.id,'📭 Not registered for events.');
  const opts = { reply_markup:{ inline_keyboard: [] } };
  events.forEach(e=>{
    const dateStr = new Date(e.datetime).toLocaleString();
    opts.reply_markup.inline_keyboard.push([{ text:`🎟 Ticket: ${e.name}`, callback_data:`ticket_${e.id}` }]);
  });
  bot.sendMessage(msg.chat.id,'Select event for ticket:',opts);
});

// /myevents
bot.onText(/\/myevents/, async (msg)=>{
  const tgId = String(msg.from.id);
  const events = await getUserEvents(tgId);
  if(!events.length) return bot.sendMessage(msg.chat.id,'📭 No registered events.');
  const opts = { reply_markup:{ inline_keyboard: [] } };
  let text = '📅 *Your upcoming events*:\n';
  events.forEach(e=>{
    const dateStr = new Date(e.datetime).toLocaleString();
    text += `\n• ${escapeMarkdownV1(e.name)} — ${escapeMarkdownV1(dateStr)}`;
    opts.reply_markup.inline_keyboard.push([{ text:'🎟 Ticket', callback_data:`ticket_${e.id}` }]);
  });
  bot.sendMessage(msg.chat.id,text,{ parse_mode:'Markdown', ...opts });
});

// /scan
bot.onText(/\/scan/, async (msg)=>{
  const tgId = String(msg.from.id);
  await startScan(tgId,msg.chat.id);
});

// ===== CALLBACK QUERY =====
bot.on('callback_query', async (query)=>{
  const tgId = String(query.from.id);
  const data = query.data;

  // City
  if(data.startsWith('city_')){
    const city = data.split('_')[1];
    await showEvents(query.message.chat.id,city);
    return bot.answerCallbackQuery(query.id);
  }

  // Ticket
  if(data.startsWith('ticket_')){
    const eventId = parseInt(data.split('_')[1],10);
    const events = await getUserEvents(tgId);
    const event = events.find(e=>e.id===eventId);
    if(!event) return bot.answerCallbackQuery(query.id,{ text:'⚠️ Not registered.' });
    await sendTicket(query.message.chat.id,tgId,eventId,event.name);
    return bot.answerCallbackQuery(query.id);
  }

  // Register
  if(data.startsWith('register_')){
    const eventId = parseInt(data.split('_')[1],10);
    const profile = await getUserProfile(tgId);
    const username = profile?.telegram_username||'';
    const email = profile?.email||null;
    const wallet = profile?.wallet_address||null;

    const res = await registerUser(eventId,tgId,username,email,wallet);
    bot.answerCallbackQuery(query.id,{ text:res.statusMsg });
    return;
  }

  // Details
  if(data.startsWith('details_')){
    const eventId = parseInt(data.split('_')[1],10);
    const res = await pool.query('SELECT * FROM events WHERE id=$1',[eventId]);
    const e = res.rows[0];
    if(!e) return bot.answerCallbackQuery(query.id,{ text:'⚠️ Event not found.' });
    const text = `*${escapeMarkdownV1(e.name)}*\n📍 ${escapeMarkdownV1(e.city)}\n🕒 ${new Date(e.datetime).toLocaleString()}\nℹ️ ${escapeMarkdownV1(e.description||'No description')}`;
    bot.sendMessage(query.message.chat.id,text,{ parse_mode:'Markdown' });
    return bot.answerCallbackQuery(query.id);
  }
});

// ===== MESSAGE HANDLER =====
bot.on('message', async (msg)=>{
  const tgId = String(msg.from.id);
  const state = userStates[tgId];
  if(!state) return;

  // Profile edit
  if(state.step==='editingProfile'){
    const field = state.field;
    const email = msg.text.trim();
    if(!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)){
      return bot.sendMessage(msg.chat.id,'⚠️ Please send a valid email.');
    }
    await saveUserProfile(tgId,{ [field]:email });
    bot.sendMessage(msg.chat.id,`✅ ${field} updated to ${email}`);
    delete userStates[tgId];
  }

// Scanning
if(state.step==='scanningTicket'){
  try{
    let qrData = msg.text;

    if(msg.photo?.length){
      const fileId = msg.photo[msg.photo.length-1].file_id;
      const buffer = await downloadFile(fileId);

      // Use Jimp to read image
      const image = await Jimp.read(buffer);
      const qr = new QrCode();
      qrData = await new Promise((resolve,reject)=>{
        qr.callback = function(err,value){
          if(err) return reject(err);
          resolve(value.result);
        };
        qr.decode(image.bitmap);
      });
    }

    const res = await validateTicket(tgId,qrData);
    bot.sendMessage(msg.chat.id,res.msg);
    delete userStates[tgId];
  } catch(err){
    console.error(err);
    bot.sendMessage(msg.chat.id,'❌ Failed to scan ticket. Send text or clear photo.');
  }
}
});// Webhook
bot.setWebHook(`${PUBLIC_URL}/bot${BOT_TOKEN}`);
app.post(`/bot${BOT_TOKEN}`, (req,res)=>{
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Start server
app.listen(PORT,()=>console.log(`🚀 Bot listening on port ${PORT}`));







