// export.js
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();
const fs = require('fs');

const db = new sqlite3.Database('./db.sqlite');

const EVENT_ID = process.env.EVENT_ID;

db.all(
  `SELECT telegram_user_id, email, wallet_address FROM registrations WHERE event_id = ?`,
  [EVENT_ID],
  (err, rows) => {
    if (err) {
      console.error('❌ Failed to export:', err);
      return;
    }

    const output = rows.map((row) => ({
      telegram_user_id: row.telegram_user_id,
      email: row.email || '',
      wallet_address: row.wallet_address || '',
    }));

    const csv = ['Telegram User ID,Email,Wallet Address']
      .concat(
        output.map(
          (row) => `${row.telegram_user_id},${row.email},${row.wallet_address}`
        )
      )
      .join('\n');

    fs.writeFileSync('event_export.csv', csv);
    console.log(`✅ Export complete. Saved to event_export.csv`);
    db.close();
  }
);
























