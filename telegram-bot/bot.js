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
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Bot server is running!')
})

const bot = new TelegramBot(botToken, { polling: false })

app.post(`/bot${botToken}`, (req, res) => {
  bot.processUpdate(req.body)
  res.sendStatus(200)
})

async function setWebhook() {
  const webhookUrl = `https://tea-gwwb.onrender.com/bot${botToken}`
  try {
    const info = await bot.getWebHookInfo()
    if (info.url !== webhookUrl) {
      await bot.setWebHook(webhookUrl)
      console.log(`✅ Webhook set to ${webhookUrl}`)
    } else {
      console.log(`ℹ️ Webhook already set to ${webhookUrl}`)
    }
  } catch (err) {
    if (err.response && err.response.statusCode === 429) {
      const retryAfter = err.response.headers['retry-after'] || 1
      console.warn(`⚠️ Telegram rate limited. Retry after ${retryAfter} seconds.`)
    } else {
      throw err
    }
  }
}

/*
// Uncomment below and comment above to switch to polling mode:

// const bot = new TelegramBot(botToken, { polling: true })

// async function removeWebhookAndStartPolling() {
//   try {
//     await bot.deleteWebHook()
//     console.log('✅ Webhook deleted, starting polling')
//     bot.startPolling()
//   } catch (err) {
//     console.error('❌ Error deleting webhook:', err)
//   }
// }
*/

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

// Paste all your existing command handlers below, exactly as before, e.g.:

bot.onText(/\/welcome/, (msg) => { /* your code here */ })
bot.onText(/\/help/, (msg) => { /* your code here */ })
bot.onText(/\/start/, async (msg) => { /* your code here */ })
bot.on('message', async (msg) => { /* your code here */ })
bot.onText(/\/myevents/, async (msg) => { /* your code here */ })
bot.onText(/\/attendees/, async (msg) => { /* your code here */ })
bot.onText(/\/status (.+)/, async (msg, match) => { /* your code here */ })

async function saveRegistration(...) { /* your code here */ }

async function init() {
  try {
    await runMigrations()
    console.log('✅ Migrations completed.')

    await setWebhook()

    app.listen(PORT, () => {
      console.log(`🚀 Express server listening on port ${PORT}`)
    })

    // To run polling mode instead of webhook, call:
    // await removeWebhookAndStartPolling()
  } catch (err) {
    console.error('❌ Startup error:', err)
    process.exit(1)
  }
}

init()

