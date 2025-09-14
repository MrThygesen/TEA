// tea-project/telegram-bot/routes/confirm-email.js
import express from "express"
import { pool } from "../lib/postgres.js"

const router = express.Router()

router.get("/confirm-email", async (req, res) => {
  const { token } = req.query
  if (!token) return res.status(400).json({ error: "Missing token" })

  try {
    const { rows } = await pool.query(
      `SELECT user_id, expires_at
       FROM email_verification_tokens
       WHERE token=$1
       LIMIT 1`,
      [token]
    )

    if (!rows.length) {
      return res.status(400).json({ error: "Invalid or expired token" })
    }

    const record = rows[0]
    const now = new Date()
    const expiresAt = new Date(record.expires_at)

    if (now > expiresAt) {
      return res.status(400).json({ error: "Token expired" })
    }

    await pool.query(
      `UPDATE user_profiles
       SET email_verified=TRUE
       WHERE id=$1`,
      [record.user_id]
    )

    await pool.query(`DELETE FROM email_verification_tokens WHERE token=$1`, [token])

    res.status(200).json({ success: true, message: "Email verified successfully (Telegram bot)" })
  } catch (err) {
    console.error("Telegram bot confirm-email error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router

