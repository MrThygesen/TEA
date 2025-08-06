import { pool } from './postgres.js'

export async function runMigrations() {
  const client = await pool.connect()

  try {
    // Check if the constraint already exists
    const checkConstraint = await client.query(`
      SELECT 1 FROM pg_constraint WHERE conname = 'registrations_event_user_unique';
    `)

    if (checkConstraint.rowCount === 0) {
      console.log('🔧 Adding UNIQUE constraint (event_id, telegram_user_id)...')

      await client.query(`
        ALTER TABLE registrations
        ADD CONSTRAINT registrations_event_user_unique UNIQUE (event_id, telegram_user_id);
      `)

      console.log('✅ Constraint added successfully.')
    } else {
      console.log('✅ Constraint already exists, no action needed.')
    }
  } catch (err) {
    console.error('❌ Migration error:', err.message)
  } finally {
    client.release()
  }
}

