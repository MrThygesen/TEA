import TelegramBot from 'node-telegram-bot-api'
import dotenv from 'dotenv'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

dotenv.config()
const token = process.env.TELEGRAM_BOT_TOKEN

const bot = new TelegramBot(token, { polling: true })

const openDB = () =>
  open({
    filename: './meetings.db',
    driver: sqlite3.Database
  })

// Example command to "join meeting"
bot.onText(/\/join (.+)/, async (msg, match) => {
  const chatId = msg.chat.id
  const userId = msg.from.id
  const username = msg.from.username
  const meetingName = match[1]

  const db = await openDB()
  await db.run(
    'INSERT INTO meetings (meeting_name, user_id, username) VALUES (?, ?, ?)',
    [meetingName, userId.toString(), username]
  )
  await db.close()

  bot.sendMessage(chatId, `✅ You joined the meeting: ${meetingName}`)
})

// Optional: Show current join count
bot.onText(/\/count (.+)/, async (msg, match) => {
  const chatId = msg.chat.id
  const meetingName = match[1]

  const db = await openDB()
  const result = await db.get(
    'SELECT COUNT(*) as count FROM meetings WHERE meeting_name = ?',
    [meetingName]
  )
  await db.close()

  bot.sendMessage(chatId, `👥 ${result.count} people joined "${meetingName}"`)
})

