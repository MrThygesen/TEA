import TelegramBot from 'node-telegram-bot-api'
import { pool } from './lib/postgres.js'
import dotenv from 'dotenv'
import express from 'express'
import QRCode from 'qrcode'

dotenv.config()

const botToken = process.env.TELEGRAM_BOT_TOKEN
const PORT = process.env.PORT || 3000

if (!botToken) {
  console.error('❌ Telegram Bot Token missing in env!')
  process.exit(1)
}

const app = express()
app.use(express.json())

// Root health check
app.get('/', (req, res) => res.send('Bot server running!'))

// Create bot instance, webhook mode
const bot = new TelegramBot(botToken, { polling: false })

// Webhook route
app.post(`/bot${botToken}`, (req, res) => {
  bot.processUpdate(req.body)
  res.sendStatus(200)
})

// Set webhook
async function setWebhook() {
  const webhookUrl = `https://tea-gwwb.onrender.com/bot${botToken}`
  const info = await bot.getWebHookInfo()
  if (info.url !== webhookUrl) {
    await bot.setWebHook(webhookUrl)
    console.log(`✅ Webhook set to ${webhookUrl}`)
  } else {
    console.log(`ℹ️ Webhook already set`)
  }
}

// ----- Minimal Helpers -----
async function getOpenEvents() {
  const res = await pool.query(`
    SELECT id, name, datetime
    FROM events
    ORDER BY datetime ASC NULLS LAST
    LIMIT 10
  `)
  return res.rows
}

async function getUserEvents(chatId) {
  const res = await pool.query(`
    SELECT r.id AS ticket_id, e.name, e.datetime
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.telegram_user_id = $1
    ORDER BY e.datetime ASC
  `, [chatId.toString()])
  return res.rows
}

async function generateQR(data) {
  const url = await QRCode.toDataURL(JSON.stringify(data))
  return Buffer.from(url.split(',')[1], 'base64')
}

// ----- Commands -----
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id
  const events = await getOpenEvents()
  if (events.length === 0) {
    return bot.sendMessage(chatId, '📭 No events currently available.')
  }

  let message = '🎉 Welcome! Here are open events:\n'
  events.forEach((e, i) => {
    message += `\n${i + 1}. *${e.name}* — ${e.datetime || 'TBA'}`
  })
  message += '\n\nReply with event number to register.'
  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
})

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id
  await bot.sendMessage(chatId,
    '🤖 Commands:\n' +
    '/start - List open events\n' +
    '/myevents - Show your registered events with QR\n' +
    '/help - Show this message'
  )
})

bot.onText(/\/myevents/, async (msg) => {
  const chatId = msg.chat.id
  const events = await getUserEvents(chatId)
  if (events.length === 0) {
    return bot.sendMessage(chatId, '📭 You have no registered events.')
  }

  for (const ev of events) {
    const qr = await generateQR({ ticketId: ev.ticket_id, event: ev.name })
    const caption = `🎫 *Ticket #${ev.ticket_id}*\n*Event:* ${ev.name}\n*Date:* ${ev.datetime || 'TBA'}`
    await bot.sendPhoto(chatId, qr, { caption, parse_mode: 'Markdown' })
  }
})

// ----- Start -----
async function init() {
  try {
    await setWebhook()
    app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`))
  } catch (err) {
    console.error('❌ Startup error:', err)
    process.exit(1)
  }
}

init()

