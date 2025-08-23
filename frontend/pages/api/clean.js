// pages/api/clean.js
import { pool } from '../../lib/postgres.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const client = await pool.connect();
  try {
    await client.query('DROP TABLE IF EXISTS registrations CASCADE;');
    await client.query('DROP TABLE IF EXISTS invitations CASCADE;');
    await client.query('DROP TABLE IF EXISTS user_emails CASCADE;');
    await client.query('DROP TABLE IF EXISTS user_profiles CASCADE;');
    await client.query('DROP TABLE IF EXISTS events CASCADE;');

    res.status(200).json({ message: '✅ All tables dropped successfully' });
  } catch (err) {
    console.error('❌ Error dropping tables:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

