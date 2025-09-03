// pages/api/login.js
import bcrypt from 'bcryptjs'
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, role, tier FROM user_profiles WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0)
      return res.status(400).json({ error: 'Invalid email or password' });

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid)
      return res.status(400).json({ error: 'Invalid email or password' });

    res.status(200).json({ user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

