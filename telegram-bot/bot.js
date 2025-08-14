import TelegramBot from 'node-telegram-bot-api'
import pkg from 'pg'
import QRCode from 'qrcode'
import dotenv from 'dotenv'
dotenv.config()

const { Pool } = pkg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })
const userStates = {} // temporary session states

// ====== DB SETUP ======
async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      telegram_user_id TEXT PRIMARY KEY,
      city TEXT DEFAULT 'Copenhagen',
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `)
}
initTables()

// ====== HELPERS ======
async function getAvailableCities() {
  const res = await pool.query(`
    SELECT DISTINCT city
    FROM events
    WHERE datetime > NOW()
    ORDER BY city ASC
  `)
  return res.rows.map(r => r.city)
}

async function getUserCity(tgId) {
  const res = await pool.query(`
    SELECT city FROM user_settings WHERE telegram_user_id = $1
  `, [tgId])
  return res.rows.length ? res.rows[0].city : 'Copenhagen'
}

async function saveUserCity(tgId, city) {
  await pool.query(`
    INSERT INTO user_settings (telegram_user_id, city)
    VALUES ($1, $2)
    ON CONFLICT (telegram_user_id)
    DO UPDATE SET city = $2, updated_at = CURRENT_TIMESTAMP
  `, [tgId, city])
}

async function getOpenEventsByCity(city) {
  const res = await pool.query(`
    SELECT id, name, datetime, min_attendees, is_confirmed
    FROM events
    WHERE datetime > NOW()
      AND LOWER(city) = LOWER($1)
    ORDER BY datetime ASC
  `, [city])
  return res.rows
}

async function registerUser(eventId, tgId, username, email, wallet) {
  await pool.query(`
    INSERT INTO registrations (event_id, telegram_user_id, telegram_username, email, wallet_address)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (event_id, telegram_user_id) DO NOTHING
  `, [eventId, tgId, username, email, wallet || null])

  const attendeesRes = await pool.query(`SELECT COUNT(*) FROM registrations WHERE event_id = $1`, [eventId])
  const count = parseInt(attendeesRes.rows[0].count)

  const eventRes = await pool.query(`SELECT name, min_attendees, is_confirmed FROM events WHERE id = $1`, [eventId])
  const event = eventRes.rows[0]

  if (!event.is_confirmed && count >= event.min_attendees) {
    await pool.query(`UPDATE events SET is_confirmed = true WHERE id = $1`, [eventId])
    return { confirmed: true, eventName: event.name }
  }
  return { confirmed: false }
}

async function getUserEvents(tgId) {
  const res = await pool.query(`
    SELECT e.id, e.name, e.datetime
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.telegram_user_id = $1
    ORDER BY e.datetime ASC
  `, [tgId])
  return res.rows
}

// ====== HELP COMMAND ======
bot.onText(/\/help/, msg => {
  const text = `
🤖 *Bot Commands*
/start – Begin registration & choose city
/city – Change your city
/myevents – See your events & get QR codes
/ticket – Get ticket for a specific event
/help – Show this help message

🎯 *Tiers*
Tier 1: Email only  
Tier 2: Email + Wallet (ETH address)

💡 Emails must contain '@'  
💡 Wallets must start with 0x and have 40 hex chars
  `
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' })
})

// ====== START ======
bot.onText(/\/start/, async msg => {
  const chatId = msg.chat.id
  const savedCity = await getUserCity(chatId)
  const cities = await getAvailableCities()

  if (!cities.includes(savedCity) && cities.length > 0) {
    await saveUserCity(chatId, cities[0])
    userStates[chatId] = { city: cities[0] }
  } else {
    userStates[chatId] = { city: savedCity }
  }

  if (cities.length > 1) {
    const buttons = cities.map(c => [{ text: c, callback_data: `city_${c}` }])
    await bot.sendMessage(chatId, `🏙 Your current city is *${savedCity}*. Select a different city:`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    })
  } else {
    await showTierSelection(chatId)
  }
})

// ====== CALLBACK HANDLING ======
bot.on('callback_query', async query => {
  const chatId = query.message.chat.id

  if (query.data.startsWith('city_')) {
    const city = query.data.replace('city_', '')
    await saveUserCity(chatId, city)
    userStates[chatId] = { city }
    await bot.answerCallbackQuery(query.id, { text: `City set to ${city}` })
    await showTierSelection(chatId)
  }

  if (query.data === 'tier1' || query.data === 'tier2') {
    userStates[chatId].tier = query.data
    userStates[chatId].step = 'email'
    bot.sendMessage(chatId, '📧 Please enter your email address:')
  }
})

async function showTierSelection(chatId) {
  const buttons = [
    [{ text: '📩 Tier 1 (Email only)', callback_data: 'tier1' }],
    [{ text: '💼 Tier 2 (Email + Wallet)', callback_data: 'tier2' }]
  ]
  await bot.sendMessage(chatId, 'Choose your tier:', {
    reply_markup: { inline_keyboard: buttons }
  })
}

// ====== MESSAGE HANDLING ======
bot.on('message', async msg => {
  const chatId = msg.chat.id
  const state = userStates[chatId]
  if (!state) return

  if (state.step === 'email') {
    if (!msg.text.includes('@')) {
      return bot.sendMessage(chatId, '❌ Invalid email. Please include "@".')
    }
    state.email = msg.text
    if (state.tier === 'tier2') {
      state.step = 'wallet'
      bot.sendMessage(chatId, '💳 Please enter your Ethereum wallet address:')
    } else {
      state.step = 'event'
      await showEvents(chatId)
    }
  }

  else if (state.step === 'wallet') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(msg.text)) {
      return bot.sendMessage(chatId, '❌ Invalid wallet address. Must be 0x followed by 40 hex characters.')
    }
    state.wallet = msg.text
    state.step = 'event'
    await showEvents(chatId)
  }

  else if (state.step === 'event') {
    const choice = parseInt(msg.text)
    const events = await getOpenEventsByCity(state.city)
    if (isNaN(choice) || choice < 1 || choice > events.length) {
      return bot.sendMessage(chatId, '❌ Invalid choice. Please enter a valid event number.')
    }
    const selected = events[choice - 1]
    const { confirmed, eventName } = await registerUser(
      selected.id,
      chatId,
      msg.from.username,
      state.email,
      state.wallet
    )
    if (confirmed) {
      bot.sendMessage(chatId, `✅ Event "${eventName}" is now *confirmed*!`, { parse_mode: 'Markdown' })
    } else {
      bot.sendMessage(chatId, `🎟 Registered for *${selected.name}*`, { parse_mode: 'Markdown' })
    }
    delete userStates[chatId]
  }
})

async function showEvents(chatId) {
  const events = await getOpenEventsByCity(userStates[chatId].city)
  if (!events.length) {
    return bot.sendMessage(chatId, '📭 No upcoming events for this city.')
  }
  let msg = `🎉 Upcoming events in *${userStates[chatId].city}*:\n`
  events.forEach((e, i) => {
    msg += `\n${i + 1}. *${e.name}* — ${new Date(e.datetime).toLocaleString()}`
  })
  msg += '\n\nReply with event number to register.'
  bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' })
}

// ====== /myevents ======
bot.onText(/\/myevents/, async msg => {
  const chatId = msg.chat.id
  const events = await getUserEvents(chatId)
  if (!events.length) {
    return bot.sendMessage(chatId, '📭 You have no registered events.')
  }
  for (const e of events) {
    const qrData = `Event: ${e.name}\nUser: ${msg.from.username}\nTicket: ${e.id}-${chatId}`
    const qrImage = await QRCode.toBuffer(qrData)
    await bot.sendPhoto(chatId, qrImage, {
      caption: `🎟 *${e.name}* — ${new Date(e.datetime).toLocaleString()}`,
      parse_mode: 'Markdown'
    })
  }
})

// ====== /ticket ======
bot.onText(/\/ticket/, async msg => {
  const chatId = msg.chat.id
  const events = await getUserEvents(chatId)
  if (!events.length) return bot.sendMessage(chatId, '📭 No tickets found.')
  let message = '🎟 Your Tickets:\n'
  events.forEach(e => {
    message += `\n@${msg.from.username} — Ticket #${e.id}-${chatId} (${e.name})`
  })
  bot.sendMessage(chatId, message)
})

// ====== /city ======
bot.onText(/\/city/, async msg => {
  const chatId = msg.chat.id
  const cities = await getAvailableCities()
  if (!cities.length) return bot.sendMessage(chatId, '📭 No cities found.')
  const buttons = cities.map(c => [{ text: c, callback_data: `city_${c}` }])
  await bot.sendMessage(chatId, '🏙 Choose your city:', {
    reply_markup: { inline_keyboard: buttons }
  })
})

console.log('🤖 Bot is running...')

