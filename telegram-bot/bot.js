import TelegramBot from 'node-telegram-bot-api';
import { pool } from './postgres.js';
import dotenv from 'dotenv';
dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

/**
 * Utility: Validate email & wallet
 */
const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);
const validateWallet = (address) => /^0x[a-fA-F0-9]{40}$/.test(address);

/**
 * HELP command
 */
bot.onText(/\/help/, (msg) => {
  const helpText = `
🤖 *Event Bot Commands*:
📍 /city - Change your preferred city
🎟️ /myevents - View your registered future events
📝 /edit_user - Update your profile info (tier, email, wallet, city)
📅 /ticket - Show your ticket for a specific event
ℹ️ /help - Show this help menu

_Tier 1:_ Email notifications  
_Tier 2:_ Email + Wallet registration
  `;
  bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

/**
 * START command (with persistence check)
 */
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const username = msg.from.username || '';

  const res = await pool.query(
    'SELECT * FROM user_profiles WHERE telegram_user_id=$1',
    [userId]
  );

  if (res.rows.length > 0) {
    bot.sendMessage(chatId, `👋 Welcome back, ${username}! Type /help for commands.`);
    return;
  }

  await pool.query(
    `INSERT INTO user_profiles (telegram_user_id, telegram_username)
     VALUES ($1, $2) ON CONFLICT (telegram_user_id) DO NOTHING`,
    [userId, username]
  );

  bot.sendMessage(chatId, `Welcome, ${username}! Let's set up your profile.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📍 Select City", callback_data: "set_city" }]
      ]
    }
  });
});

/**
 * Inline city selection
 */
bot.on('callback_query', async (query) => {
  const userId = query.from.id.toString();
  const chatId = query.message.chat.id;

  if (query.data === 'set_city') {
    const citiesRes = await pool.query(
      `SELECT DISTINCT city FROM events WHERE datetime > NOW() ORDER BY city`
    );
    const cities = citiesRes.rows.map(r => r.city);

    bot.sendMessage(chatId, "Select your city:", {
      reply_markup: {
        inline_keyboard: cities.map(c => [{ text: c, callback_data: `city_${c}` }])
      }
    });
  }

  if (query.data.startsWith('city_')) {
    const city = query.data.replace('city_', '');
    await pool.query(
      'UPDATE user_profiles SET city=$1 WHERE telegram_user_id=$2',
      [city, userId]
    );

    bot.sendMessage(chatId, `✅ City set to *${city}*`, { parse_mode: 'Markdown' });

    bot.sendMessage(chatId, "Choose your tier:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Tier 1 - Email", callback_data: "tier_1" }],
          [{ text: "Tier 2 - Email + Wallet", callback_data: "tier_2" }]
        ]
      }
    });
  }

  if (query.data.startsWith('tier_')) {
    const tier = parseInt(query.data.replace('tier_', ''));
    await pool.query(
      'UPDATE user_profiles SET tier=$1 WHERE telegram_user_id=$2',
      [tier, userId]
    );
    bot.sendMessage(chatId, `✅ Tier ${tier} selected.`);

    bot.sendMessage(chatId, "📧 Please send your email:");
    bot.once('message', async (msg) => {
      if (!validateEmail(msg.text)) {
        bot.sendMessage(chatId, "❌ Invalid email. Please restart with /edit_user");
        return;
      }
      await pool.query(
        'UPDATE user_profiles SET email=$1 WHERE telegram_user_id=$2',
        [msg.text, userId]
      );

      if (tier === 2) {
        bot.sendMessage(chatId, "💳 Please send your ETH wallet:");
        bot.once('message', async (msg2) => {
          if (!validateWallet(msg2.text)) {
            bot.sendMessage(chatId, "❌ Invalid ETH wallet. Please restart with /edit_user");
            return;
          }
          await pool.query(
            'UPDATE user_profiles SET wallet_address=$1 WHERE telegram_user_id=$2',
            [msg2.text, userId]
          );
          bot.sendMessage(chatId, "✅ Profile completed!");
        });
      } else {
        bot.sendMessage(chatId, "✅ Profile completed!");
      }
    });
  }
});

/**
 * Auto-confirm events when min attendees reached
 */
async function checkEventConfirmation(eventId) {
  const event = await pool.query('SELECT * FROM events WHERE id=$1', [eventId]);
  if (!event.rows.length) return;
  const attendees = await pool.query(
    'SELECT COUNT(*) FROM registrations WHERE event_id=$1',
    [eventId]
  );
  if (parseInt(attendees.rows[0].count) >= event.rows[0].min_attendees && !event.rows[0].is_confirmed) {
    await pool.query('UPDATE events SET is_confirmed=TRUE WHERE id=$1', [eventId]);
    const users = await pool.query('SELECT telegram_user_id FROM registrations WHERE event_id=$1', [eventId]);
    users.rows.forEach(u => {
      bot.sendMessage(u.telegram_user_id, `🎉 Event "${event.rows[0].name}" confirmed!`);
    });
  }
}



import QRCode from 'qrcode';

/**
 * /myevents — show user's registered future events
 */
bot.onText(/\/myevents/, async (msg) => {
  const userId = msg.from.id.toString();
  const chatId = msg.chat.id;

  const res = await pool.query(`
    SELECT e.id, e.name, e.city, e.datetime
    FROM registrations r
    JOIN events e ON e.id = r.event_id
    WHERE r.telegram_user_id=$1
      AND e.datetime > NOW()
    ORDER BY e.datetime ASC
  `, [userId]);

  if (!res.rows.length) {
    bot.sendMessage(chatId, "📭 You have no upcoming events registered.");
    return;
  }

  for (const ev of res.rows) {
    const ticketText = `Ticket\nEvent: ${ev.name}\nUser: ${msg.from.username}\nEventID: ${ev.id}`;
    const qrBuffer = await QRCode.toBuffer(ticketText);
    bot.sendPhoto(chatId, qrBuffer, {
      caption: `🎟 ${ev.name}\n📍 ${ev.city}\n🗓 ${new Date(ev.datetime).toLocaleString()}`
    });
  }
});

/**
 * /ticket <event_id> — show specific ticket
 */
bot.onText(/\/ticket (\d+)/, async (msg, match) => {
  const eventId = match[1];
  const userId = msg.from.id.toString();
  const chatId = msg.chat.id;

  const reg = await pool.query(`
    SELECT e.name
    FROM registrations r
    JOIN events e ON e.id = r.event_id
    WHERE r.telegram_user_id=$1 AND e.id=$2
  `, [userId, eventId]);

  if (!reg.rows.length) {
    bot.sendMessage(chatId, "❌ You are not registered for this event.");
    return;
  }

  const ticketText = `Ticket\nEvent: ${reg.rows[0].name}\nUser: ${msg.from.username}\nEventID: ${eventId}`;
  const qrBuffer = await QRCode.toBuffer(ticketText);
  bot.sendPhoto(chatId, qrBuffer, {
    caption: `🎟 Ticket for ${reg.rows[0].name}`
  });
});

/**
 * /edit_user — update profile
 */
bot.onText(/\/edit_user/, async (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, "Select what to edit:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📍 City", callback_data: "set_city" }],
        [{ text: "📊 Tier", callback_data: "edit_tier" }],
        [{ text: "📧 Email", callback_data: "edit_email" }],
        [{ text: "💳 Wallet", callback_data: "edit_wallet" }]
      ]
    }
  });
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id.toString();

  if (query.data === 'edit_tier') {
    bot.sendMessage(chatId, "Choose your tier:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Tier 1 - Email", callback_data: "tier_1" }],
          [{ text: "Tier 2 - Email + Wallet", callback_data: "tier_2" }]
        ]
      }
    });
  }

  if (query.data === 'edit_email') {
    bot.sendMessage(chatId, "📧 Enter your new email:");
    bot.once('message', async (m) => {
      if (!validateEmail(m.text)) {
        bot.sendMessage(chatId, "❌ Invalid email.");
        return;
      }
      await pool.query(
        'UPDATE user_profiles SET email=$1 WHERE telegram_user_id=$2',
        [m.text, userId]
      );
      bot.sendMessage(chatId, "✅ Email updated.");
    });
  }

  if (query.data === 'edit_wallet') {
    bot.sendMessage(chatId, "💳 Enter your new ETH wallet:");
    bot.once('message', async (m) => {
      if (!validateWallet(m.text)) {
        bot.sendMessage(chatId, "❌ Invalid ETH wallet.");
        return;
      }
      await pool.query(
        'UPDATE user_profiles SET wallet_address=$1 WHERE telegram_user_id=$2',
        [m.text, userId]
      );
      bot.sendMessage(chatId, "✅ Wallet updated.");
    });
  }
});

/**
 * /register <event_id> — register user
 */
bot.onText(/\/register (\d+)/, async (msg, match) => {
  const eventId = match[1];
  const userId = msg.from.id.toString();
  const username = msg.from.username || '';
  const chatId = msg.chat.id;

  // Get user profile
  const profileRes = await pool.query(
    'SELECT * FROM user_profiles WHERE telegram_user_id=$1',
    [userId]
  );
  if (!profileRes.rows.length) {
    bot.sendMessage(chatId, "❌ Please set up your profile with /start first.");
    return;
  }
  const profile = profileRes.rows[0];

  try {
    await pool.query(
      `INSERT INTO registrations (event_id, telegram_user_id, telegram_username, email, wallet_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventId, userId, username, profile.email, profile.wallet_address]
    );
    bot.sendMessage(chatId, `✅ Registered for event ${eventId}`);
    await checkEventConfirmation(eventId);
  } catch (err) {
    if (err.code === '23505') {
      bot.sendMessage(chatId, "⚠️ You are already registered for this event.");
    } else {
      console.error(err);
      bot.sendMessage(chatId, "❌ Error registering.");
    }
  }
});


