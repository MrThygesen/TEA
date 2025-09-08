import pkg from "pg";
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

export async function runMigrations() {
  try {
    await client.connect();
    console.log("Connected to database for migrations.");

    // Example migration: add a new column safely
    await client.query(`
      ALTER TABLE user_profiles
      ADD COLUMN IF NOT EXISTS phone_number TEXT;
    `);

    // Example migration: add index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_city ON user_profiles(LOWER(city));
    `);

    console.log("Migrations completed.");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

