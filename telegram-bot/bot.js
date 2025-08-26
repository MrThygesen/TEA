// bot.js
import TelegramBot from 'node-telegram-bot-api';
import pkg from 'pg';
import dotenv from 'dotenv';
import express from 'express';
import { runMigrations } from './migrations.js';
import { sendEmailVerification, sendEventConfirmed, sendPaymentConfirmed, isLikelyEmail } from './email-optin.js';


dotenv.config();
const { Pool } = pkg;


  const verificationUrl = `${process.env.PUBLIC_URL}/verify-email?tgId=${tgId}&token=${token}`;

  const msg = {
    to: email,
    from: process.env.FROM_EMAIL || 'no-reply@yourdomain.com',
    subject: 'Confirm your email',
    html: `
      <p>Hi!</p>
      <p>Please confirm your email by clicking the link below:</p>
      <p><a href="${verificationUrl}">Confirm Email</a></p>
      <p>This link will expire in 24 hours.</p>
    `,
  };
}


//  end of confirmation email 

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
    await sendEventConfirmed(eventId);  
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


// ==== COMMANDS (/start, /help, /myid, /events, /user_edit, /cancel, /message capture, /myevents, /deregister, /ticket, /event_detail) ====
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

// ==== /user_edit command ====
bot.onText(/\/user_edit(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const tgId = String(msg.from.id);

  // Fetch or create user profile
  let profile = await getUserProfile(tgId);
  if (!profile) {
    await saveUserProfile(tgId, { telegram_username: msg.from.username || '' });
    profile = await getUserProfile(tgId);
  }

  // Inline email support: /user_edit you@example.com
  const inlineEmail = (match && match[1]) ? match[1].trim() : null;
  if (inlineEmail) {
    if (!isLikelyEmail(inlineEmail)) {
      return bot.sendMessage(chatId, '❌ Invalid email. Please include both "@" and "."');
    }

    await saveUserProfile(tgId, { email: inlineEmail });
    await sendEmailVerification(tgId, inlineEmail);

    return bot.sendMessage(chatId, `✅ Email updated to: ${inlineEmail}. Please check your inbox to verify.`);
  }

  // No inline email: prompt user to reply
  const prompt = await bot.sendMessage(
    chatId,
    `📧 Current email: ${profile?.email || 'N/A'}\n` +
    `Reply to this message with your new email (must include '@' and '.').`,
    { reply_markup: { force_reply: true, input_field_placeholder: 'you@example.com' } }
  );

  // Track user state for reply
  userStates[tgId] = { step: 'editingProfile', field: 'email', replyTo: prompt.message_id };
});

// ==== Cancel email update ====
bot.onText(/\/cancel/, async (msg) => {
  const tgId = String(msg.from.id);
  delete userStates[tgId];
  bot.sendMessage(msg.chat.id, '✖️ Email update canceled.');
});

// ==== Capture reply to /user_edit prompt ====
bot.on('message', async (msg) => {
  const tgId = String(msg.from.id);
  const state = userStates[tgId];
  if (!state) return;                // no active edit
  if (!msg.text) return;             // non-text message
  if (msg.text.startsWith('/')) return; // ignore commands

  // Ensure reply is to the correct message
  if (state.replyTo && (!msg.reply_to_message || msg.reply_to_message.message_id !== state.replyTo)) {
    return;
  }

  if (state.field === 'email') {
    const email = msg.text.trim();
    if (!isLikelyEmail(email)) {
      return bot.sendMessage(msg.chat.id, '❌ Invalid email. Please include both "@" and "."');
    }

    await saveUserProfile(tgId, { email });
    await sendEmailVerification(tgId, email); // ✅ Always send verification

    delete userStates[tgId];
    bot.sendMessage(msg.chat.id, `✅ Email updated to: ${email}. Please check your inbox to verify.`);
  }
});



// ==== MY EVENTS ====
bot.onText(/\/myevents/, async (msg) => {
  const tgId = String(msg.from.id);
  const events = await getUserEvents(tgId);
  if (!events.length) {
    return bot.sendMessage(msg.chat.id, '📭 You are not registered for any events.');
  }

  for (const e of events) {
    const dateStr = new Date(e.datetime).toLocaleString();
    const paymentStatus = e.has_paid ? '✅ Paid' : '💳 Not Paid';
    const text =
      `📅 ${e.name} — ${dateStr} — ${e.price ? `${e.price} USD` : 'Free'}\n` +
      `Status: ${paymentStatus}\n` +
      `/event_detail_${e.id} to see details\n` +
      `/deregister_${e.id} to leave the event` +
      (e.price && !e.has_paid ? `\n/pay_${e.id} to complete payment` : '');
      
    await bot.sendMessage(msg.chat.id, text);
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
bot.onText(/\/ticket/, async (msg) => {
  const tgId = String(msg.from.id);
  const username = msg.from.username || '';

  // Get all registered events for this user
  const events = await getUserEvents(tgId);
  if (!events.length) {
    return bot.sendMessage(msg.chat.id, '📭 Not registered for any events.');
  }

  // Filter only events that have been paid
  const paidEvents = events.filter(e => e.has_paid);
  if (!paidEvents.length) {
    return bot.sendMessage(msg.chat.id, '💳 You have not completed payment for any events yet.');
  }

  // Send ticket for each paid event
  for (const e of paidEvents) {
    const dateStr = new Date(e.datetime).toLocaleString();
    const ticketText =
      `🎫 Ticket for event: ${e.name}\n` +
      `🆔 Ticket ID: ${e.id}\n` +
      `👤 Username: @${username}\n` +
      `📅 Date/Time: ${dateStr}\n` +
      `💰 Price: ${e.price ? `${e.price} USD` : 'Free'}\n` +
      `📌 Show this ticket at the entrance/staff.\n` +
      `/event_detail_${e.id}`;
    await bot.sendMessage(msg.chat.id, ticketText);
  }
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


// ==== EVENT ADMIN (ORGANIZER) ====
bot.onText(/\/event_admin/, async (msg) => {
  const chatId = msg.chat.id;
  const tgId = String(msg.from.id);

  try {
    const profile = await getUserProfile(tgId);
    if (!profile || profile.role !== 'organizer') {
      return bot.sendMessage(chatId, '❌ You are not assigned as an organizer.');
    }

    const groupId = profile.group_id;
    if (!groupId) {
      return bot.sendMessage(chatId, '❌ You are not assigned to any group. Ask admin to assign you.');
    }

    // Fetch events for this organizer's group
    const { rows: events } = await pool.query(
      `SELECT e.id, e.name, e.datetime, e.is_confirmed, e.min_attendees,
              COUNT(r.id) FILTER (WHERE r.has_arrived = TRUE) AS arrived_count
       FROM events e
       LEFT JOIN registrations r ON r.event_id = e.id
       WHERE e.group_id = $1
       GROUP BY e.id
       ORDER BY e.datetime ASC`,
      [groupId]
    );

    if (!events.length) {
      return bot.sendMessage(chatId, '📭 No events for your group yet.');
    }

    for (const e of events) {
      const dateStr = new Date(e.datetime).toLocaleString();

      const keyboard = [
        [{ text: '👥 Show Attendees', callback_data: `showattendees_${e.id}` }]
      ];

      if (Number(e.arrived_count) >= Number(e.min_attendees)) {
        keyboard.push([{ text: '🎁 Activate Perks', callback_data: `activate_perks_${e.id}` }]);
      } else {
        keyboard.push([{
          text: `⏳ Perks locked: ${e.arrived_count}/${e.min_attendees} arrived`,
          callback_data: 'noop_perks_locked'
        }]);
      }

      await bot.sendMessage(
        chatId,
        `📅 ${e.name} — ${dateStr}\nConfirmed: ${e.is_confirmed ? '✅' : '⌛'}`,
        { reply_markup: { inline_keyboard: keyboard } }
      );
    }
  } catch (err) {
    console.error('❌ /event_admin error:', err);
    bot.sendMessage(chatId, '❌ Failed to fetch your events. Try again later.');
  }
});

// ==== SHOW EVENTS (USER CITY) ====
async function showEvents(chatId, city) {
  const events = await getOpenEventsByCity(city);
  if (!events.length) return bot.sendMessage(chatId, `📭 No upcoming events in ${city}.`);

  const opts = { reply_markup: { inline_keyboard: [] } };
  let text = `📅 Upcoming events in ${city}:\n`;

  events.forEach(e => {
    const dateStr = new Date(e.datetime).toLocaleString();
    text += `\n• ${e.name} — ${dateStr} — ${e.price ? `${e.price} DKK` : 'Free'}`;
    opts.reply_markup.inline_keyboard.push([
      { text: 'Details', callback_data: `details_${e.id}` },
      { text: 'Register', callback_data: `register_${e.id}` }
    ]);
  });

  bot.sendMessage(chatId, text, opts);
}

// ==== SHOW ATTENDEES ====
async function showAttendees(chatId, eventId, messageId = null) {
  const { rows: regs } = await pool.query(`
    SELECT r.id, r.telegram_username,
           r.has_arrived, r.voucher_applied,
           r.basic_perk_applied, r.advanced_perk_applied
    FROM registrations r
    JOIN user_profiles u ON u.telegram_user_id = r.telegram_user_id
    WHERE r.event_id=$1
    ORDER BY r.id ASC
  `, [eventId]);

  if (!regs.length) {
    return messageId
      ? bot.editMessageText('📭 No attendees yet.', { chat_id: chatId, message_id: messageId }).catch(()=>{})
      : bot.sendMessage(chatId, '📭 No attendees yet.');
  }

  // HEADER row
  const headerRow = [
    { text: 'Guest', callback_data: 'noop_header_guest' },
    { text: 'Arr', callback_data: 'noop_header_arr' },
    { text: 'Vouch', callback_data: 'noop_header_vouch' },
    { text: 'Basic', callback_data: 'noop_header_basic' },
    { text: 'Advance', callback_data: 'noop_header_advance' },
  ];

  // ATTENDEE rows
  const attendeeRows = regs.map(r => ([
    { text: `@${r.telegram_username}`, callback_data: `noop_${r.id}` },
    { text: r.has_arrived ? '✅' : '❌', callback_data: `toggle_${r.id}_has_arrived` },
    { text: r.voucher_applied ? '✅' : '❌', callback_data: `toggle_${r.id}_voucher_applied` },
    { text: r.basic_perk_applied ? '✅' : '❌', callback_data: `toggle_${r.id}_basic_perk_applied` },
    { text: r.advanced_perk_applied ? '✅' : '❌', callback_data: `toggle_${r.id}_advanced_perk_applied` },
  ]));

  const inline_keyboard = [headerRow, ...attendeeRows];

  const opts = { reply_markup: { inline_keyboard } };

  if (messageId) {
    await bot.editMessageText(`👥 Attendees for event ID ${eventId}:`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: opts.reply_markup
    }).catch(()=>{});
  } else {
    await bot.sendMessage(chatId, `👥 Attendees for event ID ${eventId}:`, opts);
  }
}


// ==== EVENT ADMIN (ORGANIZER) ====
async function showOrganizerEvents(chatId, groupId) {
  const { rows: events } = await pool.query(
    `SELECT e.id, e.name, e.datetime, e.is_confirmed, e.min_attendees,
            COUNT(r.id) FILTER (WHERE r.has_arrived = TRUE) AS arrived_count
     FROM events e
     LEFT JOIN registrations r ON r.event_id = e.id
     WHERE e.group_id = $1
     GROUP BY e.id
     ORDER BY e.datetime ASC`,
    [groupId]
  );

  if (!events.length) {
    return bot.sendMessage(chatId, '📭 No events for your group yet.');
  }

  for (const e of events) {
    const dateStr = new Date(e.datetime).toLocaleString();

    // Default keyboard: show attendees
    const keyboard = [
      [{ text: '👥 Show Attendees', callback_data: `showattendees_${e.id}` }]
    ];

    // Add perks button or locked status
    if (Number(e.arrived_count) >= Number(e.min_attendees)) {
      keyboard.push([{ text: '🎁 Activate Perks', callback_data: `activate_perks_${e.id}` }]);
    } else {
      keyboard.push([{
        text: `⏳ Perks locked: ${e.arrived_count}/${e.min_attendees} arrived`,
        callback_data: 'noop_perks_locked'
      }]);
    }

    const opts = { reply_markup: { inline_keyboard: keyboard } };

    await bot.sendMessage(
      chatId,
      `📅 ${e.name} — ${dateStr}\nConfirmed: ${e.is_confirmed ? '✅' : '⌛'}`,
      opts
    );
  }
}

// ==== CALLBACK QUERIES ====
bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const tgId = String(query.from.id);


// --- IGNORE NOOP BUTTONS ---
if (data.startsWith('noop_')) {
  try { await bot.answerCallbackQuery(query.id); } catch {}
  return;
}


  // --- CITY SELECTION ---
  if (data.startsWith('city_')) {
    const city = data.split('_')[1];
    await showEvents(chatId, city);
    return;
  }

  // --- TOGGLE FIELDS (Organizer only) ---
  if (data.startsWith('toggle_')) {
    const prof = await getUserProfile(tgId);
    if (prof?.role !== 'organizer') {
      try {
        await bot.answerCallbackQuery(query.id, { text: 'Organizer role required', show_alert: true });
      } catch {}
      return;
    }

    const parts = data.split('_'); // ['toggle', regId, 'field', ...]
    const regId = parseInt(parts[1], 10);
    const field = parts.slice(2).join('_');

    // Validate field name
    const allowedFields = ['has_arrived', 'voucher_applied', 'basic_perk_applied', 'advanced_perk_applied'];
    if (!allowedFields.includes(field)) return;

    // Get current value
    const currentRes = await pool.query(`SELECT ${field} FROM registrations WHERE id=$1`, [regId]);
    if (!currentRes.rows.length) return;
    const current = currentRes.rows[0][field];
    const newValue = !current;

    // Update DB
    await pool.query(`UPDATE registrations SET ${field}=$1 WHERE id=$2`, [newValue, regId]);

    // Refresh attendee list in-place
    const eventRes = await pool.query('SELECT event_id FROM registrations WHERE id=$1', [regId]);
    const eventId = eventRes.rows[0]?.event_id;
    if (!eventId) return;

    await showAttendees(chatId, eventId, query.message.message_id);

    try { await bot.answerCallbackQuery(query.id); } catch {} // remove loading spinner
    return;
  }

  // --- EVENT DETAILS ---
  if (data.startsWith('details_')) {
    const eventId = parseInt(data.split('_')[1], 10);
    const res = await pool.query('SELECT * FROM events WHERE id=$1', [eventId]);
    const event = res.rows[0];
    if (!event) return bot.sendMessage(chatId, '⚠️ Event not found.');
    const dateStr = new Date(event.datetime).toLocaleString();
    const text = `📌 Event: ${event.name}\nCity: ${event.city}\nDate/Time: ${dateStr}\nMin/Max attendees: ${event.min_attendees}/${event.max_attendees}\nConfirmed: ${event.is_confirmed ? '✅' : '⌛'}\nDescription: ${event.description || 'N/A'}\nVenue: ${event.venue || 'N/A'}\nBasic perk: ${event.basic_perk || 'N/A'}\nAdvanced perk: ${event.advanced_perk || 'N/A'}`;
    await bot.sendMessage(chatId, text);
    return;
  }

  // --- REGISTER ---
  if (data.startsWith('register_')) {
    const eventId = parseInt(data.split('_')[1], 10);
    const profile = await getUserProfile(tgId);
    const res = await registerUser(eventId, tgId, profile?.telegram_username || '', profile?.email, profile?.wallet_address);
    await bot.sendMessage(chatId, res.statusMsg);
    return;
  }

  // --- SHOW ATTENDEES (Organizer only) ---
  if (data.startsWith('showattendees_')) {
    const prof = await getUserProfile(tgId);
    if (prof?.role !== 'organizer') {
      try { await bot.answerCallbackQuery(query.id, { text: 'Organizer role required', show_alert: true }); } catch {}
      return;
    }
    const eventId = parseInt(data.split('_')[1], 10);
    await showAttendees(chatId, eventId);
    return;
  }
});
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

