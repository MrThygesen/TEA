// bot.js

import { runMigrations } from './migrations.js'
import TelegramBot from 'node-telegram-bot-api'
import { pool } from './postgres.js'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
import express from 'express'

dotenv.config()

const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
const BOT_USERNAME = process.env.BOT_USERNAME
const MAILERLITE_API_KEY = process.env.TEANET_MAILERLITE_API_KEY
const PORT = process.env.PORT

if (!PORT) throw new Error('PORT is not defined!')
if (!botToken) {
  console.error('Bot token not found in environment variables — exiting.')
  process.exit(1)
}
if (!BOT_USERNAME) {
  console.error('Bot username not found — exiting.')
  process.exit(1)
}

console.log('Bot token and username loaded successfully.')

const app = express()
app.use(express.json())

app.get('/', (req, res) => res.send('Bot is online.'))

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
      console.log(`Webhook set: ${webhookUrl}`)
    } else {
      console.log('Webhook already set.')
    }
  } catch (err) {
    if (err.response?.statusCode === 429) {
      console.warn('Telegram rate limited; retry later.')
    } else {
      throw err
    }
  }
}

const userStates = {}
const userCityPreference = {}

// Utility to fetch future events, optionally by city
async function fetchFutureEvents(city = null) {
  const params = [new Date()]
  let sql = `
    SELECT *
    FROM events
    WHERE (datetime IS NULL OR datetime > $1)
    ORDER BY datetime ASC NULLS LAST
  `
  if (city) {
    sql += ` AND LOWER(city) = LOWER($2)`
    params.push(city)
  }
  sql += ` LIMIT 10`
  const res = await pool.query(sql, params)
  return res.rows
}

// Utility: count current registrations for an event
async function getRegistrationCount(eventId) {
  const res = await pool.query('SELECT COUNT(*) FROM registrations WHERE event_id = $1', [eventId])
  return Number(res.rows[0].count)
}

// Command: /start (with invite token handling)
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id
  const username = msg.from?.username || 'user'
  const token = match?.[1]

  // Reset state and show city selector
  delete userStates[chatId]
  await sendCitySelector(chatId, 'Welcome! Please choose your city to see upcoming events:')

  if (token) {
    // Invitation token format: eventId-inviterId-inviteId
    try {
      const [eventId, inviterId,, inviteId] = token.split('-').map((v, i) =>
        i === 0 || i === 2 ? Number(v) : v
      )
      const inviter = inviterId.toString()
      const invitee = chatId.toString()

      const { rows } = await pool.query(
        `SELECT COUNT(DISTINCT inviter_id) AS c
         FROM invitations WHERE event_id = $1 AND invitee_id = $2`, [eventId, invitee]
      )
      if (Number(rows[0].c) >= 3) {
        bot.sendMessage(chatId, 'You already have 3 invitations for this event.')
        await bot.sendMessage(inviter, `Your invite to @${username} was blocked; they reached limit.`)
        return
      }

      await pool.query(
        `UPDATE invitations SET invitee_id=$1, invitee_username=$2, confirmed=true
         WHERE id=$3 AND event_id=$4 AND inviter_id=$5`,
        [invitee, username, inviteId, eventId, inviter]
      )
      await pool.query(
        `INSERT INTO registrations (event_id, telegram_user_id, telegram_username)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id, telegram_user_id) DO NOTHING`,
        [eventId, invitee, username]
      )

      const { rows: gr } = await pool.query('SELECT group_id FROM events WHERE id = $1', [eventId])
      const groupId = gr[0]?.group_id
      if (groupId) {
        try {
          await bot.approveChatJoinRequest(groupId, invitee)
          return bot.sendMessage(chatId, `You're confirmed for event #${eventId} and added to the group.`)
        } catch { /* continue */ }
      }
      bot.sendMessage(chatId, `You're confirmed for event #${eventId}.`)

    } catch (e) {
      console.error('Error with invite token:', e)
      bot.sendMessage(chatId, 'Invalid or expired invite link.')
    }
  }
})

// /help
bot.onText(/\/help/, (msg) => {
  const text = `
Available commands:
/start — Begin & pick city
/predefine_city — Change your preferred city
/register_user_email_for_confirmed_events — Get an email when events confirm
/myevents — See your registered events
/total — Total registrations across events
/help — This help message
`
  bot.sendMessage(msg.chat.id, text)
})

// /predefine_city (manual city selection)
bot.onText(/\/predefine_city/, (msg) =>
  sendCitySelector(msg.chat.id, 'Please select your city:')
)

async function sendCitySelector(chatId, prompt) {
  const res = await pool.query(`SELECT DISTINCT city FROM events WHERE city IS NOT NULL ORDER BY city`)
  const cities = res.rows.map(r => r.city).filter(Boolean)
  if (!cities.length) {
    return bot.sendMessage(chatId, 'No cities available yet.')
  }
  const buttons = cities.map(city => ([{ text: city, callback_data: `set_city_${city}` }]))
  await bot.sendMessage(chatId, prompt, { reply_markup: { inline_keyboard: buttons } })
}

bot.on('callback_query', async (cq) => {
  const { message, data, id } = cq
  const chatId = message.chat.id

  if (data.startsWith('set_city_')) {
    const city = data.replace('set_city_', '')
    userCityPreference[chatId] = city
    await bot.answerCallbackQuery(id, { text: `City set to ${city}` })

    const events = await fetchFutureEvents(city)
    if (!events.length) {
      return bot.sendMessage(chatId, `No upcoming events in ${city}`)
    }
    let msg = `Upcoming events in *${city}*:\n\n`
    for (const e of events) {
      const c = await getRegistrationCount(e.id)
      msg += `• *${e.name}* (${e.datetime || 'TBA'}) — ${c} regist., ${e.is_confirmed ? '✅' : '⏳'}\n`
    }
    return bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' })
  }

  await bot.answerCallbackQuery(id)
})

// /myevents
bot.onText(/\/myevents/, async (msg) => {
  const chatId = msg.chat.id
  const res = await pool.query(`
    SELECT e.name, e.datetime, e.city, e.is_confirmed
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.telegram_user_id = $1
    ORDER BY e.datetime ASC
  `, [chatId.toString()])

  if (!res.rows.length) {
    return bot.sendMessage(chatId, "No registrations found.")
  }

  let msg = 'Your events:\n\n'
  res.rows.forEach((e, i) => {
    msg += `${i + 1}. *${e.name}* (${e.city}) — ${e.datetime || 'TBA'} — ${e.is_confirmed ? '✅ Confirmed' : '⏳ Pending'}\n\n`
  })
  bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' })
})

// /total
bot.onText(/\/total/, async (msg) => {
  const chatId = msg.chat.id
  const res = await pool.query('SELECT COUNT(*) AS total FROM registrations')
  const total = Number(res.rows[0].total)
  bot.sendMessage(chatId, `Total registrations across all events: *${total}*`, { parse_mode: 'Markdown' })
})

// /register_user_email_for_confirmed_events
bot.onText(/\/register_user_email_for_confirmed_events/, (msg) => {
  const chatId = msg.chat.id
  userStates[chatId] = 'awaiting_confirm_email'
  bot.sendMessage(chatId, 'Please send your email to receive notifications when events are confirmed.')
})

// Handle email registration
bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const state = userStates[chatId]
  if (state === 'awaiting_confirm_email') {
    const email = msg.text.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return bot.sendMessage(chatId, 'Invalid email. Try again.')
    }
    await pool.query(`
      INSERT INTO user_emails (telegram_user_id, email)
      VALUES ($1, $2)
      ON CONFLICT (telegram_user_id) DO UPDATE SET email = EXCLUDED.email
    `, [chatId.toString(), email])

    delete userStates[chatId]
    bot.sendMessage(chatId, `Email ${email} saved for confirmed-event notifications.`)
  }
})

// Function to notify users when an event is confirmed
async function notifyOnEventConfirmed(eventId, eventName) {
  const res = await pool.query('SELECT telegram_user_id FROM registrations WHERE event_id = $1', [eventId])
  for (const { telegram_user_id } of res.rows) {
    try {
      await bot.sendMessage(telegram_user_id, `Event *${eventName}* is now confirmed!`, { parse_mode: 'Markdown' })
    } catch (e) {
      console.error('Telegram notify error:', e)
    }
  }

  const emailRes = await pool.query('SELECT email FROM user_emails')
  for (const { email } of emailRes.rows) {
    if (MAILERLITE_API_KEY) {
      try {
        await fetch('https://connect.mailerlite.com/api/subscribers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MAILERLITE_API_KEY}`
          },
          body: JSON.stringify({ email, fields: { event: eventName } })
        })
        console.log(`Emailed confirmation to ${email}`)
      } catch (e) {
        console.error('MailerLite error:', e)
      }
    }
  }
}

// Hook into saveRegistration flow to trigger notifications
// (Ensure your existing saveRegistration calls notifyOnEventConfirmed when an event becomes confirmed)

async function init() {
  try {
    await runMigrations()
    console.log('Migrations complete.')

    await setWebhook()

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`)
    })
  } catch (err) {
    console.error('Startup error:', err)
    process.exit(1)
  }
}

init()

