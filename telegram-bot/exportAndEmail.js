const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const nodemailer = require('nodemailer');
require('dotenv').config();

const db = new sqlite3.Database('./db.sqlite');
const EVENT_ID = process.env.EVENT_ID;
const OUTPUT_FILE = `${EVENT_ID}_export.csv`;

// Step 1: Query DB and generate CSV
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
          (row) =>
            `${row.telegram_user_id},${row.email},${row.wallet_address}`
        )
      )
      .join('\n');

    fs.writeFileSync(OUTPUT_FILE, csv);
    console.log(`✅ Export complete: ${OUTPUT_FILE}`);

    sendEmailWithAttachment();
  }
);

// Step 2: Send Email with CSV
function sendEmailWithAttachment() {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // Or use MailerLite SMTP or any other
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"TEA Network Bot" <${process.env.EMAIL_FROM}>`,
    to: process.env.EMAIL_TO,
    subject: `Export for Event: ${EVENT_ID}`,
    text: `Attached is the list of participants for event "${EVENT_ID}".`,
    attachments: [
      {
        filename: OUTPUT_FILE,
        path: `./${OUTPUT_FILE}`,
      },
    ],
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('❌ Failed to send email:', err);
    } else {
      console.log(`📧 Email sent to ${process.env.EMAIL_TO}: ${info.response}`);
    }
    db.close();
  });
}

