//index.js
require('dotenv').config()
const { ethers } = require('ethers')
const TelegramBot = require('node-telegram-bot-api')

const token = process.env.TELEGRAM_BOT_TOKEN
const bot = new TelegramBot(token, { polling: true })

const provider = new ethers.JsonRpcProvider(`https://polygon-amoy.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
const contractABI = require('./WebAccessSBT_ABI.json') // Make sure this matches deployed version
const contract = new ethers.Contract(process.env.SBT_CONTRACT_ADDRESS, contractABI, provider)

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Welcome! Please send your wallet address to verify SBT ownership.')
})

bot.on('message', async (msg) => {
  const userInput = msg.text
  if (userInput && userInput.startsWith('0x') && userInput.length === 42) {
    const wallet = userInput
    const typeId = 35 // You can also dynamically load this per group or use a DB

    try {
      const hasSBT = await contract.hasTokenOfType(wallet, typeId)
      if (hasSBT) {
        bot.sendMessage(msg.chat.id, '✅ Verified! You have access.')
        // optionally: send a group invite link here
      } else {
        bot.sendMessage(msg.chat.id, '❌ Sorry, you do not own this SBT.')
      }
    } catch (err) {
      bot.sendMessage(msg.chat.id, '⚠️ Verification failed. Try again later.')
      console.error(err)
    }
  }
})

