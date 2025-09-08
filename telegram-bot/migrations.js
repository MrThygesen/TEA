import fs from "fs";
import path from "path";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration(fileName) {
  try {
    console.log(`Running migration: ${fileName}`);
    const migrationPath = path.join(process.cwd(), "migrations", fileName);
    const sql = fs.readFileSync(migrationPath, "utf8");
    await pool.query(sql);
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Error running migration:", err);
    throw err;
  } finally {
    await pool.end();
  }
}

// Example usage:
// runMigration("001_add_column_to_user_profiles.sql");

export default runMigration;

