import fs from "fs";
import path from "path";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  try {
    console.log("Connecting to database...");

    // Drop all tables first
    await pool.query(`
      DROP TABLE IF EXISTS 
        user_emails,
        invitations,
        registrations,
        events,
        email_verification_tokens,
        user_profiles
      CASCADE;
    `);
    console.log("All tables dropped.");

    // Read schema.sql file
    const schemaPath = path.join(process.cwd(), "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    await pool.query(schema);
    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("Error initializing database:", err);
    throw err; // ensures Vercel returns 500 if failure
  } finally {
    await pool.end();
  }
}

// Only run if executed directly (not imported)
if (require.main === module) {
  initDb();
}

export default initDb;

