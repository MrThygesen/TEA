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

// Add JSON middleware to parse incoming webhook POST requests
app.use(express.json())

const bot = new TelegramBot(botToken, { polling: false })

// Webhook POST route to receive Telegram updates and pass to bot
app.post(`/bot${botToken}`, (req, res) => {
  bot.processUpdate(req.body)
  res.sendStatus(200)
})

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

// Your existing bot command handlers here ...
// (welcome, help, start, message reply flow, saveRegistration, myevents, attendees, status)

// ... (Paste your full existing bot handlers here unchanged) ...

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

