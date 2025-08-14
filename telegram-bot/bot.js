import TelegramBot from 'node-telegram-bot-api'
import { pool } from './lib/postgres.js'
import dotenv from 'dotenv'
import express from 'express'
import QRCode from 'qrcode'

dotenv.config()

const botToken = process.env.TELEGRAM_BOT_TOKEN
const PORT = process.env.PORT || 4000

if (!botToken) {
  console.error('❌ Telegram Bot Token missing!')
  process.exit(1)
}

// Express setup
const app = express()
app.use(express.json())
app.get('/', (req, res) => res.send('✅ Bot server running'))

// Bot instance, webhook mode
const bot = new TelegramBot(botToken, { polling: false })
app.post(`/bot${botToken}`, (req, res) => {
  bot.processUpdate(req.body)
  res.sendStatus(200)
})

// Set webhook
async function setWebhook() {
  const webhookUrl = `https://tea-gwwb.onrender.com/bot${botToken}`
  const info = await bot.getWebHookInfo()
  if (info.url !== webhookUrl) await bot.setWebHook(webhookUrl)
  console.log(`✅ Webhook set: ${webhookUrl}`)
}

// ----- State -----
const userStates = {} // chatId -> { step, selectedEvent, tier, email, wallet }

// ----- Helpers -----
async function getOpenEvents() {
  const res = await pool.query(`
    SELECT id, name, datetime, min_attendees
    FROM events
    WHERE datetime IS NULL OR datetime > NOW()
    ORDER BY datetime ASC
    LIMIT 10
  `)
  return res.rows
}

async function getUserTickets(chatId) {
  const res = await pool.query(`
    SELECT r.id AS ticket_id, r.tier, r.wallet_address, e.name AS event_name, e.datetime, e.is_confirmed
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.telegram_user_id = $1 AND (e.datetime IS NULL OR e.datetime > NOW())
    ORDER BY e.datetime ASC
  `, [chatId.toString()])
  return res.rows
}

async function saveRegistration(chatId, username, email, wallet, eventId, tier) {
  const finalTier = wallet ? 2 : tier || 1

  const insertRes = await pool.query(`
    INSERT INTO registrations (event_id, telegram_user_id, telegram_username, email, wallet_address, tier)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (event_id, telegram_user_id) DO UPDATE
      SET email = EXCLUDED.email,
          wallet_address = EXCLUDED.wallet_address,
          tier = EXCLUDED.tier
    RETURNING id, tier, wallet_address
  `, [eventId, chatId.toString(), username, email, wallet, finalTier])

  const ticketId = insertRes.rows[0].id

  // Check min-attendees
  const countRes = await pool.query(`SELECT COUNT(*) FROM registrations WHERE event_id = $1`, [eventId])
  const currentCount = parseInt(countRes.rows[0].count, 10)
  const eventRes = await pool.query(`SELECT name, min_attendees, is_confirmed FROM events WHERE id = $1`, [eventId])
  const { name, min_attendees, is_confirmed } = eventRes.rows[0]

  if (!is_confirmed && currentCount >= min_attendees) {
    await pool.query(`UPDATE events SET is_confirmed = true WHERE id = $1`, [eventId])
    console.log(`🎉 Event "${name}" confirmed!`)
    const users = await pool.query(`SELECT telegram_user_id FROM registrations WHERE event_id = $1`, [eventId])
    for (const u of users.rows) {
      try { await bot.sendMessage(u.telegram_user_id, `🎉 Event "${name}" is now confirmed!`) } catch {}
    }
  }

  return { ticketId, finalTier }
}

async function generateQR(data) {
  const url = await QRCode.toDataURL(JSON.stringify(data))
  return Buffer.from(url.split(',')[1], 'base64')
}

// ----- Commands -----
// /start -> choose event
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id
  const events = await getOpenEvents()
  if (!events.length) return bot.sendMessage(chatId, '📭 No upcoming events.')

  userStates[chatId] = { step: 'choose_event', events }
  let msgText = '🎉 Welcome! Choose an event by number:\n'
  events.forEach((e, i) => { msgText += `\n${i + 1}. *${e.name}* — ${e.datetime || 'TBA'}` })
  msgText += '\n\nReply with event number.'
  await bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' })
})

// /ticket <event number>
bot.onText(/\/ticket (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id
  const idx = parseInt(match[1], 10) - 1
  const events = await getOpenEvents()
  if (idx < 0 || idx >= events.length) return bot.sendMessage(chatId, '❌ Invalid event number.')
  const event = events[idx]

  const res = await pool.query(`
    SELECT id AS ticket_id, telegram_username, tier
    FROM registrations
    WHERE telegram_user_id = $1 AND event_id = $2
  `, [chatId.toString(), event.id])
  const ticket = res.rows[0]
  if (!ticket) return bot.sendMessage(chatId, '📭 You have no ticket for this event.')

  const qr = await generateQR({ ticketId: ticket.ticket_id, username: ticket.telegram_username })
  await bot.sendPhoto(chatId, qr, { caption: `🎫 Ticket #${ticket.ticket_id}\nUsername: ${ticket.telegram_username}\nTier: ${ticket.tier}`, parse_mode: 'Markdown' })
})

// /myevents -> list all tickets (future only)
bot.onText(/\/myevents/, async (msg) => {
  const chatId = msg.chat.id
  const tickets = await getUserTickets(chatId)
  if (!tickets.length) return bot.sendMessage(chatId, '📭 You have no upcoming events.')

  for (const t of tickets) {
    const qr = await generateQR({ ticketId: t.ticket_id, username: msg.from.username || '' })
    const caption = `🎫 Ticket #${t.ticket_id}\nEvent: ${t.event_name}\nDate: ${t.datetime || 'TBA'}\nTier: ${t.tier}\nStatus: ${t.is_confirmed ? '✅ Confirmed' : '⏳ Waiting'}`
    await bot.sendPhoto(chatId, qr, { caption, parse_mode: 'Markdown' })
  }
})

// Handle user replies for registration flow
bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text.trim()
  const state = userStates[chatId]
  if (!state) return

  try {
    if (state.step === 'choose_event') {
      const idx = parseInt(text, 10) - 1
      if (isNaN(idx) || idx < 0 || idx >= state.events.length)
        return bot.sendMessage(chatId, '❌ Invalid number. Reply with event number.')

      state.selectedEvent = state.events[idx]
      state.step = 'choose_tier'
      return bot.sendMessage(chatId, 'Select tier:\n1️⃣ Tier 1: Email only\n2️⃣ Tier 2: Email + Wallet')
    }

    if (state.step === 'choose_tier') {
      if (!['1','2'].includes(text)) return bot.sendMessage(chatId, '❌ Reply with 1 or 2.')
      state.tier = parseInt(text, 10)
      state.step = 'collect_email'
      return bot.sendMessage(chatId, '✉️ Please reply with your email.')
    }

    if (state.step === 'collect_email') {
      state.email = text
      if (state.tier === 2) {
        state.step = 'collect_wallet'
        return bot.sendMessage(chatId, '💼 Please reply with your wallet address.')
      } else {
        const { ticketId } = await saveRegistration(chatId, msg.from.username || '', state.email, null, state.selectedEvent.id, state.tier)
        userStates[chatId] = {}
        return bot.sendMessage(chatId, `✅ Registered! Ticket ID: ${ticketId}`)
      }
    }

    if (state.step === 'collect_wallet') {
      state.wallet = text
      const { ticketId } = await saveRegistration(chatId, msg.from.username || '', state.email, state.wallet, state.selectedEvent.id, state.tier)
      userStates[chatId] = {}
      return bot.sendMessage(chatId, `✅ Registered! Ticket ID: ${ticketId} (Tier 2)`)
    }
  } catch (err) {
    console.error('❌ Registration error:', err)
    await bot.sendMessage(chatId, '❌ Error during registration. Please try again.')
  }
})

// ----- Init -----
async function init() {
  try {
    await setWebhook()
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`))
  } catch (err) {
    console.error('❌ Startup error:', err)
    process.exit(1)
  }
}

init()

