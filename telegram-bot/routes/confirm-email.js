import express from "express"
import { pool } from "../lib/postgres.js"
import bot from "../bot.js" // import your TelegramBot instance

const router = express.Router()

router.get("/confirm-email", async (req, res) => {
  const { token } = req.query
  if (!token) return res.status(400).json({ error: "Missing token" })

  try {
    const { rows } = await pool.query(
      `SELECT user_id, email FROM email_verification_tokens WHERE token=$1 LIMIT 1`,
      [token]
    )

    if (!rows.length) return res.status(400).json({ error: "Invalid or expired token" })

    const record = rows[0]

    // Mark email verified
    await pool.query(
      `UPDATE user_profiles SET email_verified=TRUE WHERE id=$1`,
      [record.user_id]
    )

    // Remove token
    await pool.query(`DELETE FROM email_verification_tokens WHERE token=$1`, [token])

    // Fetch Telegram ID
    const { rows: userRows } = await pool.query(
      `SELECT telegram_user_id FROM user_profiles WHERE id=$1`,
      [record.user_id]
    )
    const tgId = userRows[0]?.telegram_user_id

    if (tgId) {
      await bot.sendMessage(tgId, `✅ Your email ${record.email} has been verified successfully!`)
    }

    res.status(200).json({ success: true, message: "Email verified successfully" })
  } catch (err) {
    console.error("Telegram bot confirm-email error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router

