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
const BOT_USERNAME = process.env.BOT_USERNAME // e.g. 'YourBotName' without @

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

// --- Invitation commands & handling ---

// /invite command to list events for inviting
bot.onText(/\/invite/, async (msg) => {
  const chatId = msg.chat.id
  const events = await getOpenEvents()

  if (events.length === 0) {
    return bot.sendMessage(chatId, "📭 No upcoming events to invite for.")
  }

  let buttons = events.map((e, i) => [{
    text: `${e.name} (${e.datetime ? new Date(e.datetime).toLocaleString() : 'TBA'})`,
    callback_data: `invite_event_${e.id}`
  }])

  bot.sendMessage(chatId, 'Select the event you want to invite someone to:', {
    reply_markup: { inline_keyboard: buttons }
  })
})

// Handle callback query for event selection in invite flow
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message
  const chatId = msg.chat.id
  const data = callbackQuery.data
  const inviterId = callbackQuery.from.id.toString()
  const inviterUsername = callbackQuery.from.username || ''

  if (data.startsWith('invite_event_')) {
    const eventId = parseInt(data.replace('invite_event_', ''), 10)

    try {
      // Create a new invitation record with inviter & event, invitee info empty for now
      const result = await pool.query(
        `INSERT INTO invitations (event_id, inviter_id, inviter_username)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [eventId, inviterId, inviterUsername]
      )
      const inviteId = result.rows[0].id

      // Create token: eventId-inviterId-inviteId
      const token = `${eventId}-${inviterId}-${inviteId}`
      const inviteLink = `https://t.me/${BOT_USERNAME}?start=${token}`

      await bot.sendMessage(chatId, `📨 Here is your invite link for event #${eventId}:\n${inviteLink}`)
      await bot.answerCallbackQuery(callbackQuery.id)
    } catch (err) {
      console.error('❌ Error creating invitation:', err)
      await bot.sendMessage(chatId, '❌ Failed to create invite link. Please try again later.')
    }
  }
})

// Modified /start to handle invite tokens
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id
  const username = msg.from?.username || ''
  const payload = match ? match[1] : null

  // If no invite token, run your existing /start logic:
  if (!payload) {
    // Your existing /start code here
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
    return
  }

  // --- Handle invite token payload ---
  try {
    const [eventIdStr, inviterId, inviteIdStr] = payload.split('-')
    const eventId = parseInt(eventIdStr)
    const inviteId = parseInt(inviteIdStr)
    const inviteeId = chatId.toString()

    // Count how many distinct inviters have invited this invitee for this event
    const countRes = await pool.query(
      `SELECT COUNT(DISTINCT inviter_id) AS count FROM invitations WHERE event_id = $1 AND invitee_id = $2`,
      [eventId, inviteeId]
    )
    const inviteCount = parseInt(countRes.rows[0].count, 10)

    if (inviteCount >= 3) {
      await bot.sendMessage(chatId, '⚠️ You have already received 3 invitations for this event. No more invites allowed.')

      // Notify inviter that invitee already maxed out invites
      try {
        await bot.sendMessage(inviterId, `🚫 Your invite to @${username || 'this user'} was blocked — they already have 3 invitations for event #${eventId}.`)
      } catch {}

      return
    }

    // Mark invitation as confirmed
    await pool.query(
      `UPDATE invitations
       SET invitee_id = $1, invitee_username = $2, confirmed = true
       WHERE id = $3 AND event_id = $4 AND inviter_id = $5`,
      [inviteeId, username, inviteId, eventId, inviterId]
    )

    // Register invitee to event if not already registered
    await pool.query(
      `INSERT INTO registrations (event_id, telegram_user_id, telegram_username)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id, telegram_user_id) DO NOTHING`,
      [eventId, inviteeId, username]
    )

    // Auto-add invitee to group if group_id exists for event
    const groupRes = await pool.query(`SELECT group_id FROM events WHERE id = $1`, [eventId])
    if (groupRes.rows.length > 0 && groupRes.rows[0].group_id) {
      const groupId = groupRes.rows[0].group_id
      try {
        // Telegram Bot API allows approveChatJoinRequest only if group uses join requests
        // If group_id is numeric chat ID
        await bot.approveChatJoinRequest(groupId, inviteeId)
        await bot.sendMessage(chatId, `✅ Welcome, @${username || 'guest'}! You are confirmed for event #${eventId} and added to the group.`)
      } catch (err) {
        console.error('Error auto-adding user to group:', err.message)
        await bot.sendMessage(chatId, `✅ Welcome, @${username || 'guest'}! You are confirmed for event #${eventId}. Please join the group manually if not added automatically.`)
      }
    } else {
      await bot.sendMessage(chatId, `✅ Welcome, @${username || 'guest'}! You are confirmed for event #${eventId}.`)
    }

  } catch (err) {
    console.error('Error handling /start invite token:', err)
    bot.sendMessage(chatId, '❌ Invalid or expired invite link.')
  }
})

// Existing message flow for registration (unchanged)
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
    let wallet = input.toLowerCase()

    if (wallet === 'no') {
      state.wallet = null
    } else {
      const walletRegex = /^0x[a-fA-F0-9]{40}$/
      if (!walletRegex.test(wallet)) {
        return bot.sendMessage(
          chatId,
          "❌ Invalid wallet address. It must start with `0x` and be 42 characters long (40 hex digits).\nPlease try again or type `no` to skip.",
          { parse_mode: 'Markdown' }
        )
      }
      state.wallet = wallet
    }

    await saveRegistration(chatId, username, state.email, state.wallet, state.event_id)

    const tier = state.wallet ? 3 : (state.email ? 2 : 1)
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

// /myevents, /attendees, /status commands unchanged from your original code below...

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

async function init() {
  try {
    await runMigrations()
    console.log('✅ Migrations completed.')

    await setWebhook()

    app.listen(PORT, () => {
      console.log(`🚀 Express server listening on port ${PORT}`)
    })
  } catch (err) {
    console.error('❌ Startup error:', err)
    process.exit(1)
  }
}

init()

