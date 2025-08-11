// tea-project/frontend/pages/api/initdb.js
import path from 'path'

// Import your existing init script
import { run as initDB } from '../../../telegram-bot/scripts/initProgres.js'

// API handler
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    await initDB()
    res.status(200).json({ message: '✅ Database initialized/updated successfully' })
  } catch (err) {
    console.error('❌ Init DB error:', err)
    res.status(500).json({ error: err.message })
  }
}

