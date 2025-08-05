import TelegramBot from 'node-telegram-bot-api'
import { pool } from './postgress.js'   // Your PostgreSQL pool file
import dotenv from 'dotenv'
dotenv.config()

// Load bot token from env vars (try both keys for safety)
const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN

if (!botToken) {
  console.error('❌ Telegram Bot Token not found in environment variables! Exiting...')
  process.exit(1)
}

console.log('✅ Telegram Bot Token loaded successfully.')

const bot = new TelegramBot(botToken, { polling: true })
const EVENT_ID = process.env.EVENT_ID || 'default_event'

// Temporary user states
const userStates = {}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id
  userStates[chatId] = { step: 'email' }

  bot.sendMessage(
    chatId,
    "🎉 Welcome to the event registration!\n\nPlease enter your *email* to register for Tier 2 or type 'skip' to stay at Tier 1.",
    { parse_mode: 'Markdown' }
  )
})

bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const state = userStates[chatId]

  if (!state || msg.text.startsWith('/')) return

  const input = msg.text.trim()

  if (state.step === 'email') {
    if (input.toLowerCase() === 'skip') {
      await saveRegistration(chatId, null, null)
      bot.sendMessage(
        chatId,
        "✅ Registered as Tier 1.\n\nYou have *free entry* to the event. Registering is required to receive this perk!",
        { parse_mode: 'Markdown' }
      )
      delete userStates[chatId]
    } else {
      state.email = input
      state.step = 'wallet'
      bot.sendMessage(
        chatId,
        "✅ Email saved.\n\nNow, enter your *wallet address* for Tier 3 access (or type 'skip' to stay at Tier 2).",
        { parse_mode: 'Markdown' }
      )
    }
  } else if (state.step === 'wallet') {
    const wallet = input.toLowerCase() === 'skip' ? null : input
    await saveRegistration(chatId, state.email, wallet)

    const tier = wallet ? 3 : 2
    const messages = {
      2: "✅ Registered as Tier 2.\n\nYou get *free entry* and *10% discount* on the bill.",
      3: "✅ Registered as Tier 3.\n\nYou get *free entry*, *10% discount*, and can *claim an SBT* for upgrades."
    }

    bot.sendMessage(chatId, messages[tier] + "\n\nRegistering is required to receive perks.", {
      parse_mode: 'Markdown'
    })
    delete userStates[chatId]
  }
})

// PostgreSQL version of saving registration
async function saveRegistration(telegram_id, email, wallet) {
  try {
    await pool.query(
      `INSERT INTO registrations (event_id, telegram_user_id, email, wallet_address)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id, telegram_user_id) DO UPDATE
       SET email = EXCLUDED.email,
           wallet_address = EXCLUDED.wallet_address`,
      [EVENT_ID, telegram_id.toString(), email, wallet]
    )
    console.log(`✅ Saved: ${telegram_id} | Email: ${email} | Wallet: ${wallet}`)
  } catch (err) {
    console.error('❌ DB save error:', err)
  }
}

