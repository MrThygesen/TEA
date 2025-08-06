import { runMigrations } from './migrations.js'
import TelegramBot from 'node-telegram-bot-api'
import { pool } from './postgres.js'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
import express from 'express'

dotenv.config()

const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
const MAILERLITE_API_KEY = process.env.TEANET_MAILERLITE_API_KEY
const PORT = process.env.PORT

if (!PORT) {
  throw new Error('❌ process.env.PORT is not defined. Render requires PORT to be set.')
}

if (!botToken) {
  console.error('❌ Telegram Bot Token not found in environment variables! Exiting...')
  process.exit(1)
}
console.log('✅ Telegram Bot Token loaded successfully.')

const app = express()

const bot = new TelegramBot(botToken, { polling: false })

// Set webhook to your Render URL
bot.setWebHook(`https://tea-gwwb.onrender.com/bot${botToken}`)

// In-memory user session state
const userStates = {}

async function getOpenEvents() {
  const res = await pool.query(`
    SELECT id, name, datetime, min_attendees, max_attendees, is_confirmed, group_id
    FROM events
    WHERE is_confirmed = true OR is_confirmed = false
    ORDER BY created_at DESC
    LIMIT 10
  `)
  return res.rows
}

async function getEventRegistrationCount(eventId) {
  const res = await pool.query(
    'SELECT COUNT(*) FROM registrations WHERE event_id = $1',
    [eventId]
  )
  return parseInt(res.rows[0].count, 10)
}

// /welcome
bot.onText(/\/welcome/, (msg) => {
  const chatId = msg.chat.id
  const welcomeMsg =
    "👋 Welcome to the Event Registration Bot!\n\n" +
    "Use /start to see available events and register.\n" +
    "Use /myevents to see events you've signed up for.\n" +
    "If you're an organizer, use /attendees to get attendee counts.\n" +
    "Check event participation anytime with /status <event name or ID>.\n\n" +
    "Need help? Use /help."
  bot.sendMessage(chatId, welcomeMsg)
})

// /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id
  const helpMsg =
    "🆘 *Help - Available Commands:*\n\n" +
    "/start — List open events to register.\n" +
    "/myevents — View your registered events.\n" +
    "/status <event name or ID> — Check current participants.\n" +
    "/welcome — Get a friendly welcome message.\n" +
    "/help — Show this help message.\n\n" +
    "Organizer commands:\n" +
    "/attendees — List attendee counts for all events.\n\n" +
    "To register, just follow the prompts after /start.\n" +
    "You can skip email or wallet by typing 'no' when asked.\n" +
    "Enjoy the perks and have a great event!"
  bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' })
})

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id
  const events = await getOpenEvents()

  if (events.length === 0) {
    bot.sendMessage(chatId, "❌ Sorry, no active events available to register at the moment.")
    return
  }

  userStates[chatId] = { step: 'choose_event', events }

  let message = "🎉 Welcome to the event registration!\n\nWe have the following events open:\n"
  events.forEach((e, i) => {
    message += `\n${i + 1}. *${e.name}*\n   📅 When: ${e.datetime || 'TBA'}\n   👥 Min: ${e.min_attendees}, Max: ${e.max_attendees}`
    message += `\n   📝 Organizer: ${e.group_id || 'N/A'}\n`
  })
  message +=
    "\nReply with the event number you want to participate in.\n\n" +
    "Perks:\n" +
    "- 40+ participants unlock discounts.\n" +
    "- Add email for extra perks.\n" +
    "- Add wallet to claim an SBT.\n"

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
})

// Handle reply flow
bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const username = msg.from?.username || ''
  const state = userStates[chatId]
  if (!state || msg.text.startsWith('/')) return

  const input = msg.text.trim()

  if (state.step === 'choose_event') {
    const choice = parseInt(input, 10)
    if (!choice || choice < 1 || choice > state.events.length) {
      bot.sendMessage(chatId, "⚠️ Please reply with a valid event number.")
      return
    }

    const event = state.events[choice - 1]
    state.event_id = event.id
    state.event_name = event.name
    state.event_datetime = event.datetime
    state.event_min = event.min_attendees
    state.event_max = event.max_attendees
    state.event_group = event.group_id

    const regCount = await getEventRegistrationCount(event.id)
    state.step = 'ask_email'

    let infoMsg =
      `👍 You chose *${event.name}* happening at *${event.datetime || 'TBA'}*.\n` +
      `Currently, ${regCount} participant(s) registered.\n\n` +
      "To receive more perks, enter your *email*, or type 'no' to skip."

    bot.sendMessage(chatId, infoMsg, { parse_mode: 'Markdown' })
  }
  else if (state.step === 'ask_email') {
    state.email = input.toLowerCase() === 'no' ? null : input
    state.step = 'ask_wallet'

    bot.sendMessage(
      chatId,
      "Now enter your *wallet address* to register for Tier 3 and claim an SBT, or type 'no' to skip.",
      { parse_mode: 'Markdown' }
    )
  }
  else if (state.step === 'ask_wallet') {
    const wallet = input.toLowerCase() === 'no' ? null : input
    state.wallet = wallet

    await saveRegistration(chatId, username, state.email, state.wallet, state.event_id)

    const tier = wallet ? 3 : (state.email ? 2 : 1)
    const messages = {
      1: "✅ Tier 1: Free entry to the event.",
      2: "✅ Tier 2: Free entry + 10% discount.",
      3: "✅ Tier 3: All perks + claim an SBT.",
    }

    let finalMsg = messages[tier] + "\n\n"
    finalMsg +=
      "Show your Telegram approval, email, or SBT at the entrance.\n\n" +
      `*Event:* ${state.event_name}\n*Date:* ${state.event_datetime || 'TBA'}\n*Organizer:* ${state.event_group || 'N/A'}`

    bot.sendMessage(chatId, finalMsg, { parse_mode: 'Markdown' })
    delete userStates[chatId]
  }
})

// Save registration & notify
async function saveRegistration(telegram_id, username, email, wallet, event_id) {
  try {
    await pool.query(`
      INSERT INTO registrations (event_id, telegram_user_id, telegram_username, email, wallet_address)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (event_id, telegram_user_id) DO UPDATE
      SET email = EXCLUDED.email,
          wallet_address = EXCLUDED.wallet_address
    `, [event_id, telegram_id.toString(), username, email, wallet])

    console.log(`✅ Saved registration for telegram_id=${telegram_id}, event_id=${event_id}`)

    if (email && MAILERLITE_API_KEY) {
      const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MAILERLITE_API_KEY}`
        },
        body: JSON.stringify({
          email,
          fields: {
            wallet,
            telegram_id: telegram_id.toString(),
            telegram_username: username
          }
        })
      })

      if (res.ok) {
        console.log(`✅ MailerLite subscriber added: ${email}`)
      } else {
        const errData = await res.json()
        console.warn(`⚠️ MailerLite error:`, errData.message)
      }
    }

    // Auto-confirm logic
    const countRes = await pool.query(`SELECT COUNT(*) FROM registrations WHERE event_id = $1`, [event_id])
    const currentCount = parseInt(countRes.rows[0].count, 10)

    const eventRes = await pool.query(`SELECT name, min_attendees, is_confirmed FROM events WHERE id = $1`, [event_id])
    const { name, min_attendees, is_confirmed } = eventRes.rows[0]

    if (!is_confirmed && currentCount >= min_attendees) {
      await pool.query(`UPDATE events SET is_confirmed = true WHERE id = $1`, [event_id])
      console.log(`🎉 Event "${name}" confirmed!`)

      const notifyRes = await pool.query(`
        SELECT telegram_user_id FROM registrations
        WHERE event_id = $1 AND email IS NOT NULL
      `, [event_id])

      for (const row of notifyRes.rows) {
        try {
          await bot.sendMessage(
            row.telegram_user_id,
            `🎉 Your event *${name}* is now confirmed!\nYou've unlocked discounts and perks.\nShow this message or your SBT at the event.`,
            { parse_mode: 'Markdown' }
          )
        } catch (err) {
          console.error(`❌ Failed to notify user ${row.telegram_user_id}:`, err.message)
        }
      }
    }

  } catch (err) {
    console.error('❌ saveRegistration error:', err)
  }
}

// /myevents
bot.onText(/\/myevents/, async (msg) => {
  const chatId = msg.chat.id
  const res = await pool.query(`
    SELECT e.name, e.datetime, e.group_id, e.is_confirmed
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.telegram_user_id = $1
    ORDER BY e.datetime ASC
  `, [chatId.toString()])

  if (res.rows.length === 0) {
    bot.sendMessage(chatId, "📭 You haven't registered for any events yet.")
    return
  }

  let message = "📅 Your Registered Events:\n\n"
  res.rows.forEach((e, i) => {
    message += `${i + 1}. *${e.name}* - ${e.datetime || 'TBA'}\n`
    message += `   Organizer: ${e.group_id || 'N/A'}\n`
    message += `   Status: ${e.is_confirmed ? '✅ Confirmed' : '⏳ Awaiting confirmation'}\n\n`
  })

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
})

// /attendees
bot.onText(/\/attendees/, async (msg) => {
  const chatId = msg.chat.id

  const res = await pool.query(`
    SELECT e.id, e.name, COUNT(r.id) AS count
    FROM events e
    LEFT JOIN registrations r ON e.id = r.event_id
    GROUP BY e.id
    ORDER BY e.created_at DESC
  `)

  if (res.rows.length === 0) {
    bot.sendMessage(chatId, "😕 No events or registrations found.")
    return
  }

  let message = "📊 Event Attendee Overview:\n\n"
  res.rows.forEach((e) => {
    message += `📝 *${e.name}* — ${e.count} registered\n`
  })

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
})

// /status <event>
bot.onText(/\/status (.+)/, async (msg, match) => {
  const chatId = msg.chat.id
  const input = match[1].trim()

  const res = await pool.query(`
    SELECT e.id, e.name, e.min_attendees, e.max_attendees, COUNT(r.id) AS count
    FROM events e
    LEFT JOIN registrations r ON e.id = r.event_id
    WHERE LOWER(e.name) LIKE LOWER($1) OR e.id::text = $1
    GROUP BY e.id
    LIMIT 1
  `, [`%${input}%`])

  if (res.rows.length === 0) {
    bot.sendMessage(chatId, "❌ No event found matching that name or ID.")
    return
  }

  const e = res.rows[0]
  let msgText =
    `📍 *Event:* ${e.name}\n` +
    `👥 Registered: ${e.count}/${e.max_attendees} (Min: ${e.min_attendees})\n`

  if (e.count >= e.min_attendees) {
    msgText += "✅ Minimum reached – event can be confirmed!\n"
  } else {
    msgText += "⏳ Not enough participants yet.\n"
  }

  bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' })
})


async function ensureWebhook() {
  try {
    const info = await bot.getWebHookInfo()
    if (info.url !== `https://tea-gwwb.onrender.com/bot${botToken}`) {
      await bot.setWebHook(`https://tea-gwwb.onrender.com/bot${botToken}`)
      console.log('✅ Webhook set successfully.')
    } else {
      console.log('ℹ️ Webhook already set, skipping.')
    }
  } catch (err) {
    if (err.response && err.response.statusCode === 429) {
      const retryAfter = err.response.headers['retry-after'] || 1
      console.warn(`⚠️ Rate limited by Telegram. Retry after ${retryAfter} seconds.`)
      // Optional: wait and retry after retryAfter seconds
    } else {
      throw err
    }
  }
}

async function init() {
  try {
    await runMigrations()
    console.log('✅ Migrations completed.')

    await ensureWebhook()

    app.listen(PORT, () => {
      console.log(`🚀 Express server listening on port ${PORT}`)
    })
  } catch (err) {
    console.error('❌ Startup error:', err)
    process.exit(1)
  }
}

init()

