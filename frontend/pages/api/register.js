import bcrypt from 'bcryptjs'
import { pool } from '../../lib/postgres.js'
import crypto from 'crypto'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, telegram_user_id, telegram_username } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO user_profiles (email, password_hash, telegram_user_id, telegram_username)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role, tier`,
      [email, hashedPassword, telegram_user_id || null, telegram_username || null]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already registered' });
    }
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

