
import bcrypt from 'bcryptjs';
import { pool } from '../../lib/postgres.js';
import { getUserFromJWT } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUserFromJWT(req); // identify logged-in user
  const { password } = req.body;

  if (!password || password.length < 8) return res.status(400).json({ error: 'Password too short' });

  const hash = await bcrypt.hash(password, 12);
  await pool.query(`UPDATE user_profiles SET password_hash=$1, updated_at=NOW() WHERE id=$2`, [hash, user.id]);

  return res.json({ ok: true });
}


async function savePassword() {
  if (!profilePasswordInput || profilePasswordInput.length < 8) return;
  const res = await fetch('/api/user/updatePassword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: profilePasswordInput }),
  });
  if (res.ok) {
    setProfilePassword(profilePasswordInput);
    setProfilePasswordInput('');
    alert('✅ Password saved!');
  } else {
    alert('❌ Failed to save password.');
  }
}

