// telegram-bot/bot.js
import TelegramBot from 'node-telegram-bot-api';
import { pool } from './lib/postgres.js';
import dotenv from 'dotenv';
import express from 'express';
import QRCode from 'qrcode';

dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 10000;

const bot = new TelegramBot(botToken);
const app = express();

// Escape function for MarkdownV2
function escapeMarkdownV2(text) {
  if (!text && text !== 0) return '';
  return String(text).replace(/([_*\[\]()~>#+\-=|{}.!\\])/g, '\\$1');
}

// --- Helper Functions ---

async function getEvent(eventId) {
  const res = await pool.query('SELECT * FROM events WHERE id=$1', [eventId]);
  return res.rows[0];
}

async function getRegistrationsCount(eventId) {
  const res = await pool.query(
    'SELECT COUNT(*) FROM registrations WHERE event_id=$1',
    [eventId]
  );
  return parseInt(res.rows[0].count, 10);
}

async function isUserRegistered(eventId, telegramUserId) {
  const res = await pool.query(
    'SELECT 1 FROM registrations WHERE event_id=$1 AND telegram_user_id=$2',
    [eventId, telegramUserId]
  );
  return res.rowCount > 0;
}

// --- Command Handlers ---

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    'Welcome to the TEA Events Bot! Use /events to see upcoming events.'
  );
});

// List upcoming events
bot.onText(/\/events/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const res = await pool.query(
      'SELECT * FROM events WHERE datetime >= NOW() ORDER BY datetime ASC'
    );
    if (res.rows.length === 0) {
      return bot.sendMessage(chatId, 'No upcoming events found.');
    }

    for (const event of res.rows) {
      const text = `*${escapeMarkdownV2(event.name)}*\nCity: ${escapeMarkdownV2(
        event.city
      )}\nDate: ${escapeMarkdownV2(event.datetime)}\nConfirmed: ${
        event.is_confirmed ? '✅' : '❌'
      }`;
      await bot.sendMessage(chatId, text, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Register',
                callback_data: `register_${event.id}`,
              },
              {
                text: 'Details',
                callback_data: `details_${event.id}`,
              },
            ],
          ],
        },
      });
    }
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, 'Error fetching events.');
  }
});

// Handle callback queries
bot.on('callback_query', async (ctx) => {
  try {
    if (!ctx.data) return;

    const [action, eventIdStr] = ctx.data.split('_');
    const eventId = parseInt(eventIdStr, 10);
    const chatId = ctx.from.id;
    const username = ctx.from.username;

    if (action === 'register') {
      const event = await getEvent(eventId);
      if (!event) return bot.answerCallbackQuery(ctx.id, { text: 'Event not found.' });

      const registered = await isUserRegistered(eventId, chatId);
      if (registered)
        return bot.answerCallbackQuery(ctx.id, { text: 'You are already registered.' });

      const currentCount = await getRegistrationsCount(eventId);
      if (currentCount >= event.max_attendees)
        return bot.answerCallbackQuery(ctx.id, { text: 'Sorry, event is full.' });

      // Insert registration
      await pool.query(
        'INSERT INTO registrations (event_id, telegram_user_id, telegram_username) VALUES ($1,$2,$3)',
        [eventId, chatId, username]
      );

      // Auto-confirm if min_attendees reached
      const newCount = currentCount + 1;
      let confirmationMsg = '';
      if (!event.is_confirmed && newCount >= event.min_attendees) {
        await pool.query('UPDATE events SET is_confirmed=TRUE WHERE id=$1', [eventId]);
        confirmationMsg = 'Event has reached minimum attendees and is now confirmed! ✅';
      }

      bot.answerCallbackQuery(ctx.id, { text: 'You are registered!' });
      bot.sendMessage(chatId, `Registered for *${escapeMarkdownV2(event.name)}*.\n${escapeMarkdownV2(confirmationMsg)}`, {
        parse_mode: 'MarkdownV2',
      });
    }

    if (action === 'details') {
      const event = await getEvent(eventId);
      if (!event) return bot.answerCallbackQuery(ctx.id, { text: 'Event not found.' });

      const regCount = await getRegistrationsCount(eventId);
      const detailsText = `*${escapeMarkdownV2(event.name)}*\nCity: ${escapeMarkdownV2(event.city)}\nDate: ${escapeMarkdownV2(event.datetime)}\nVenue: ${escapeMarkdownV2(
        event.venue
      )}\nBasic Perk: ${escapeMarkdownV2(event.basic_perk)}\nAdvanced Perk: ${escapeMarkdownV2(
        event.advanced_perk
      )}\nRegistered: ${regCount}/${event.max_attendees}\nConfirmed: ${
        event.is_confirmed ? '✅' : '❌'
      }`;

      bot.sendMessage(chatId, detailsText, { parse_mode: 'MarkdownV2' });
    }
  } catch (err) {
    console.error('callback_query error:', err);
  }
});

// --- Express Webhook (optional if using Render) ---
app.use(express.json());

app.post(`/bot${botToken}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`✅ Bot server listening on port ${PORT}`);
  bot.setWebHook(`https://tea-gwwb.onrender.com/bot${botToken}`);
});

