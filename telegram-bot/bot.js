import { runMigrations } from './migrations.js'
import TelegramBot from 'node-telegram-bot-api'
import { pool } from '../frontend/lib/postgres.js'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
import express from 'express'
import QRCode from 'qrcode'

dotenv.config()

const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
const MAILERLITE_API_KEY = process.env.TEANET_MAILERLITE_API_KEY
const PORT = process.env.PORT
const BOT_USERNAME = process.env.BOT_USERNAME

if (!PORT) throw new Error('❌ process.env.PORT is not defined. Render requires PORT to be set.')
if (!botToken) {
  console.error('❌ Telegram Bot Token not found in environment variables! Exiting...')
  process.exit(1)
}
console.log('✅ Telegram Bot Token loaded successfully.')

const app = express()
app.use(express.json())

app.get('/', (req, res) => res.send('Bot server is running!'))

const bot = new TelegramBot(botToken, { polling: false })

// Webhook
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

// ---- State ----
const userStates = {}

// ---- Helpers ----
async function ensureSchemaUpgrades() {
  await pool.query(`
    ALTER TABLE registrations
    ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 1
  `)
}

async function getCities() {
  const res = await pool.query(`
    SELECT DISTINCT city
    FROM events
    WHERE city IS NOT NULL AND city <> ''
    ORDER BY city
  `)
  return res.rows.map(r => r.city)
}

async function getOpenEvents(city = null) {
  const params = []
  let idx = 1
  let whereCity = ''
  if (city) {
    whereCity = `AND LOWER(city) = LOWER($${idx++})`
    params.push(city)
  }

  const res = await pool.query(
    `
    SELECT id, name, city, datetime, min_attendees, max_attendees, is_confirmed, group_id, created_at
    FROM events
    WHERE (is_confirmed = true OR is_confirmed = false)
    ${whereCity}
    ORDER BY 
      CASE WHEN datetime IS NULL THEN 1 ELSE 0 END, 
      datetime ASC, 
      created_at DESC
    LIMIT 10
    `,
    params
  )
  return res.rows
}

async function getEventRegistrationCount(eventId) {
  const res = await pool.query(
    'SELECT COUNT(*) FROM registrations WHERE event_id = $1',
    [eventId]
  )
  return parseInt(res.rows[0].count, 10)
}

// ---- Save registration ----
async function saveRegistration(telegram_id, username, email, wallet, event_id, tier = 1) {
  try {
    const insertRes = await pool.query(`
      INSERT INTO registrations (event_id, telegram_user_id, telegram_username, email, wallet_address, tier)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (event_id, telegram_user_id) DO UPDATE
      SET email = EXCLUDED.email,
          wallet_address = EXCLUDED.wallet_address,
          tier = EXCLUDED.tier
      RETURNING id, tier, wallet_address
    `, [event_id, telegram_id.toString(), username, email, wallet, tier])

    const ticketId = insertRes.rows[0].id
    const finalTier = insertRes.rows[0].tier
    const finalWallet = insertRes.rows[0].wallet_address

    // Add to MailerLite
    if (email && MAILERLITE_API_KEY) {
      await fetch('https://connect.mailerlite.com/api/subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MAILERLITE_API_KEY}`
        },
        body: JSON.stringify({
          email,
          fields: { wallet: finalWallet, telegram_id: telegram_id.toString(), telegram_username: username }
        })
      }).catch(err => console.warn('⚠️ MailerLite error', err))
    }

    // Auto-confirm event
    const countRes = await pool.query(`SELECT COUNT(*) FROM registrations WHERE event_id = $1`, [event_id])
    const currentCount = parseInt(countRes.rows[0].count, 10)
    const eventRes = await pool.query(`SELECT name, min_attendees, is_confirmed FROM events WHERE id = $1`, [event_id])
    const { name, min_attendees, is_confirmed } = eventRes.rows[0]

    if (!is_confirmed && currentCount >= min_attendees) {
      await pool.query(`UPDATE events SET is_confirmed = true WHERE id = $1`, [event_id])
      console.log(`🎉 Event "${name}" confirmed!`)

      const notifyRes = await pool.query(`SELECT telegram_user_id FROM registrations WHERE event_id = $1 AND email IS NOT NULL`, [event_id])
      for (const row of notifyRes.rows) {
        try {
          await bot.sendMessage(row.telegram_user_id, `🎉 Your event *${name}* is now confirmed!\nYou've unlocked perks.`, { parse_mode: 'Markdown' })
        } catch {}
      }
    }

    return { ticketId, finalTier, finalWallet }
  } catch (err) {
    console.error('❌ saveRegistration error:', err)
    throw err
  }
}

// ---- Generate QR code ----
async function generateTicketQRCode(ticketData) {
  const text = JSON.stringify(ticketData)
  return QRCode.toDataURL(text)
}

// ---- Final confirmation ----
async function sendFinalTicketMessage(chatId, state, tier) {
  const finalTier = tier || 1
  const tierMsg = finalTier === 2
    ? "✅ *Tier 2*: Event registration + Email + SBT eligibility (check wallet at venue)."
    : "✅ *Tier 1*: Event registration + Email."

  // Save registration and get ticket info
  const { ticketId, finalWallet } = await saveRegistration(chatId, state.username, state.email, state.wallet, state.event_id, finalTier)

  const ticketData = {
    ticketId,
    tier: finalTier,
    username: state.username,
    email: state.email,
    wallet: finalTier === 2 ? 'Venue Check Wallet' : null,
    event: state.event_name,
    datetime: state.event_datetime,
    city: state.event_city
  }

  const qrDataUrl = await generateTicketQRCode(ticketData)
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64')

  let infoMsg =
    `${tierMsg}\n\n*Event:* ${state.event_name}\n*Date:* ${state.event_datetime || 'TBA'}\n*City:* ${state.event_city || 'N/A'}\n*Organizer:* ${state.event_group || 'N/A'}\n`

  if (finalTier === 2) infoMsg += `\nℹ️ Show Wallet SBT at venue for extra discount.`

  await bot.sendPhoto(chatId, qrBuffer, { caption: infoMsg, parse_mode: 'Markdown' })
}

// ---- /myevents command with QR codes ----
bot.onText(/\/myevents/, async (msg) => {
  const chatId = msg.chat.id

  const res = await pool.query(`
    SELECT 
      r.id AS ticket_number,
      r.telegram_username AS username,
      r.tier,
      r.wallet_address,
      e.name AS event_name,
      e.datetime,
      e.city,
      e.group_id,
      e.is_confirmed
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.telegram_user_id = $1
    ORDER BY e.datetime ASC NULLS LAST, e.created_at DESC
  `, [chatId.toString()])

  if (res.rows.length === 0) {
    bot.sendMessage(chatId, "📭 You haven't registered for any events yet.")
    return
  }

  for (const row of res.rows) {
    const ticketData = {
      ticketId: row.ticket_number,
      tier: row.tier,
      username: row.username,
      email: null,
      wallet: row.tier === 2 ? 'Venue Check Wallet' : null,
      event: row.event_name,
      datetime: row.datetime,
      city: row.city
    }

    const qrDataUrl = await generateTicketQRCode(ticketData)
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64')

    let msgText =
      `🎫 *Ticket #${row.ticket_number}*\n*Event:* ${row.event_name}\n*Date:* ${row.datetime || 'TBA'}\n*City:* ${row.city || 'N/A'}\n` +
      `*Tier:* ${row.tier}\n` +
      `Status: ${row.is_confirmed ? '✅ Confirmed' : '⏳ Waiting for more users'}\n`

    if (row.tier === 2) msgText += `\nℹ️ Show Wallet SBT at venue for extra discount.`

    await bot.sendPhoto(chatId, qrBuffer, { caption: msgText, parse_mode: 'Markdown' })
  }
})

// ---- Other bot logic (start, callback queries, messages) ----
// Keep your existing /start flow, tier selection, email/wallet collection, and callback query handling.
// Replace old calls to sendFinalTicketMessage with this updated version for QR code support.

async function init() {
  try {
    await runMigrations()
    console.log('✅ Migrations completed.')

    await ensureSchemaUpgrades()
    console.log('✅ Schema upgrades ensured.')

    await setWebhook()
    app.listen(PORT, () => console.log(`🚀 Express server listening on port ${PORT}`))
  } catch (err) {
    console.error('❌ Startup error:', err)
    process.exit(1)
  }
}

init()

const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
const MAILERLITE_API_KEY = process.env.TEANET_MAILERLITE_API_KEY
const PORT = process.env.PORT
const BOT_USERNAME = process.env.BOT_USERNAME

if (!PORT) throw new Error('❌ process.env.PORT is not defined. Render requires PORT to be set.')
if (!botToken) {
  console.error('❌ Telegram Bot Token not found in environment variables! Exiting...')
  process.exit(1)
}
console.log('✅ Telegram Bot Token loaded successfully.')

const app = express()
app.use(express.json())

app.get('/', (req, res) => res.send('Bot server is running!'))

const bot = new TelegramBot(botToken, { polling: false })

// Webhook
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

// ---- State ----
const userStates = {}

// ---- Helpers ----
async function ensureSchemaUpgrades() {
  await pool.query(`
    ALTER TABLE registrations
    ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 1
  `)
}

async function getCities() {
  const res = await pool.query(`
    SELECT DISTINCT city
    FROM events
    WHERE city IS NOT NULL AND city <> ''
    ORDER BY city
  `)
  return res.rows.map(r => r.city)
}

async function getOpenEvents(city = null) {
  const params = []
  let idx = 1
  let whereCity = ''
  if (city) {
    whereCity = `AND LOWER(city) = LOWER($${idx++})`
    params.push(city)
  }

  const res = await pool.query(
    `
    SELECT id, name, city, datetime, min_attendees, max_attendees, is_confirmed, group_id, created_at
    FROM events
    WHERE (is_confirmed = true OR is_confirmed = false)
    ${whereCity}
    ORDER BY 
      CASE WHEN datetime IS NULL THEN 1 ELSE 0 END, 
      datetime ASC, 
      created_at DESC
    LIMIT 10
    `,
    params
  )
  return res.rows
}

async function getEventRegistrationCount(eventId) {
  const res = await pool.query(
    'SELECT COUNT(*) FROM registrations WHERE event_id = $1',
    [eventId]
  )
  return parseInt(res.rows[0].count, 10)
}

// ---- Save registration ----
async function saveRegistration(telegram_id, username, email, wallet, event_id, tier = 1) {
  try {
    const insertRes = await pool.query(`
      INSERT INTO registrations (event_id, telegram_user_id, telegram_username, email, wallet_address, tier)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (event_id, telegram_user_id) DO UPDATE
      SET email = EXCLUDED.email,
          wallet_address = EXCLUDED.wallet_address,
          tier = EXCLUDED.tier
      RETURNING id, tier, wallet_address
    `, [event_id, telegram_id.toString(), username, email, wallet, tier])

    const ticketId = insertRes.rows[0].id
    const finalTier = insertRes.rows[0].tier
    const finalWallet = insertRes.rows[0].wallet_address

    // Add to MailerLite
    if (email && MAILERLITE_API_KEY) {
      await fetch('https://connect.mailerlite.com/api/subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MAILERLITE_API_KEY}`
        },
        body: JSON.stringify({
          email,
          fields: { wallet: finalWallet, telegram_id: telegram_id.toString(), telegram_username: username }
        })
      }).catch(err => console.warn('⚠️ MailerLite error', err))
    }

    // Auto-confirm event
    const countRes = await pool.query(`SELECT COUNT(*) FROM registrations WHERE event_id = $1`, [event_id])
    const currentCount = parseInt(countRes.rows[0].count, 10)
    const eventRes = await pool.query(`SELECT name, min_attendees, is_confirmed FROM events WHERE id = $1`, [event_id])
    const { name, min_attendees, is_confirmed } = eventRes.rows[0]

    if (!is_confirmed && currentCount >= min_attendees) {
      await pool.query(`UPDATE events SET is_confirmed = true WHERE id = $1`, [event_id])
      console.log(`🎉 Event "${name}" confirmed!`)

      const notifyRes = await pool.query(`SELECT telegram_user_id FROM registrations WHERE event_id = $1 AND email IS NOT NULL`, [event_id])
      for (const row of notifyRes.rows) {
        try {
          await bot.sendMessage(row.telegram_user_id, `🎉 Your event *${name}* is now confirmed!\nYou've unlocked perks.`, { parse_mode: 'Markdown' })
        } catch {}
      }
    }

    return { ticketId, finalTier, finalWallet }
  } catch (err) {
    console.error('❌ saveRegistration error:', err)
    throw err
  }
}

// ---- Generate QR code ----
async function generateTicketQRCode(ticketData) {
  const text = JSON.stringify(ticketData)
  return QRCode.toDataURL(text)
}

// ---- Final confirmation ----
async function sendFinalTicketMessage(chatId, state, tier) {
  const finalTier = tier || 1
  const tierMsg = finalTier === 2
    ? "✅ *Tier 2*: Event registration + Email + SBT eligibility (check wallet at venue)."
    : "✅ *Tier 1*: Event registration + Email."

  // Save registration and get ticket info
  const { ticketId, finalWallet } = await saveRegistration(chatId, state.username, state.email, state.wallet, state.event_id, finalTier)

  const ticketData = {
    ticketId,
    tier: finalTier,
    username: state.username,
    email: state.email,
    wallet: finalTier === 2 ? 'Venue Check Wallet' : null,
    event: state.event_name,
    datetime: state.event_datetime,
    city: state.event_city
  }

  const qrDataUrl = await generateTicketQRCode(ticketData)
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64')

  let infoMsg =
    `${tierMsg}\n\n*Event:* ${state.event_name}\n*Date:* ${state.event_datetime || 'TBA'}\n*City:* ${state.event_city || 'N/A'}\n*Organizer:* ${state.event_group || 'N/A'}\n`

  if (finalTier === 2) infoMsg += `\nℹ️ Show Wallet SBT at venue for extra discount.`

  await bot.sendPhoto(chatId, qrBuffer, { caption: infoMsg, parse_mode: 'Markdown' })
}

// ---- /myevents command with QR codes ----
bot.onText(/\/myevents/, async (msg) => {
  const chatId = msg.chat.id

  const res = await pool.query(`
    SELECT 
      r.id AS ticket_number,
      r.telegram_username AS username,
      r.tier,
      r.wallet_address,
      e.name AS event_name,
      e.datetime,
      e.city,
      e.group_id,
      e.is_confirmed
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.telegram_user_id = $1
    ORDER BY e.datetime ASC NULLS LAST, e.created_at DESC
  `, [chatId.toString()])

  if (res.rows.length === 0) {
    bot.sendMessage(chatId, "📭 You haven't registered for any events yet.")
    return
  }

  for (const row of res.rows) {
    const ticketData = {
      ticketId: row.ticket_number,
      tier: row.tier,
      username: row.username,
      email: null,
      wallet: row.tier === 2 ? 'Venue Check Wallet' : null,
      event: row.event_name,
      datetime: row.datetime,
      city: row.city
    }

    const qrDataUrl = await generateTicketQRCode(ticketData)
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64')

    let msgText =
      `🎫 *Ticket #${row.ticket_number}*\n*Event:* ${row.event_name}\n*Date:* ${row.datetime || 'TBA'}\n*City:* ${row.city || 'N/A'}\n` +
      `*Tier:* ${row.tier}\n` +
      `Status: ${row.is_confirmed ? '✅ Confirmed' : '⏳ Waiting for more users'}\n`

    if (row.tier === 2) msgText += `\nℹ️ Show Wallet SBT at venue for extra discount.`

    await bot.sendPhoto(chatId, qrBuffer, { caption: msgText, parse_mode: 'Markdown' })
  }
})

// ---- Other bot logic (start, callback queries, messages) ----
// Keep your existing /start flow, tier selection, email/wallet collection, and callback query handling.
// Replace old calls to sendFinalTicketMessage with this updated version for QR code support.

async function init() {
  try {
    await runMigrations()
    console.log('✅ Migrations completed.')

    await ensureSchemaUpgrades()
    console.log('✅ Schema upgrades ensured.')

    await setWebhook()
    app.listen(PORT, () => console.log(`🚀 Express server listening on port ${PORT}`))
  } catch (err) {
    console.error('❌ Startup error:', err)
    process.exit(1)
  }
}

init()

