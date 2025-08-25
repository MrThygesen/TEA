import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  const { method, body, query } = req

  const parseIntOrFail = (val, field) => {
    const num = Number(val)
    if (!num || isNaN(num)) throw new Error(`${field} must be a valid number`)
    return num
  }

  // ===== POST: Create new event =====
 if (method === 'POST') {
  const {
    name, city, datetime,
    min_attendees, max_attendees,
    is_confirmed, description, details,
    venue, basic_perk, advanced_perk,
    tag1, tag2, tag3, price, image_url
  } = body;

  if (!name || !city || !datetime) {
    return res.status(400).json({ error: 'Missing required fields: name, city, datetime' });
  }

  try {
    // Insert event with group_id = id in a single transaction
    const result = await pool.query(`
      INSERT INTO events
        (name, city, datetime, min_attendees, max_attendees, is_confirmed,
         description, details, venue, basic_perk, advanced_perk, tag1, tag2, tag3, price, image_url, group_id)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, $16, DEFAULT)
      RETURNING id
    `, [
      name,
      city,
      new Date(datetime).toISOString(),
      min_attendees ?? 1,
      max_attendees ?? 40,
      is_confirmed ?? false,
      description || null,
      details || null,
      venue || null,
      basic_perk || null,
      advanced_perk || null,
      tag1 || null,
      tag2 || null,
      tag3 || null,
      price || null,
      image_url || null
    ]);

    const newId = result.rows[0].id;

    // Set group_id = id
    const insertedEvent = await pool.query(`
      UPDATE events
      SET group_id = $1
      WHERE id = $1
      RETURNING *
    `, [newId]);

    return res.status(201).json(insertedEvent.rows[0]);
  } catch (err) {
    console.error('[POST] Error inserting event:', err);
    return res.status(500).json({ error: 'Failed to insert event', details: err.message });
  }
}


  // ===== PUT: Update existing event =====
  if (method === 'PUT') {
    try {
      const {
        id, name, city, datetime,
        min_attendees, max_attendees,
        is_confirmed, description, details,
        venue, basic_perk, advanced_perk,
        tag1, tag2, tag3, price, image_url
      } = body;

      if (!id || !name || !city || !datetime) {
        return res.status(400).json({ error: 'Missing required fields for update' });
      }

      const group_id = parseIntOrFail(id, 'id');

      const result = await pool.query(
        `UPDATE events
         SET group_id=$1, name=$2, city=$3, datetime=$4, min_attendees=$5, max_attendees=$6, is_confirmed=$7,
             description=$8, details=$9, venue=$10, basic_perk=$11, advanced_perk=$12,
             tag1=$13, tag2=$14, tag3=$15, image_url=$16, image_url=$17, updated_at=NOW()
         WHERE id=$18
         RETURNING *`,
        [
          group_id,
          name,
          city,
          new Date(datetime).toISOString(),
          min_attendees ?? 1,
          max_attendees ?? 40,
          is_confirmed ?? false,
          description || null,
          details || null,
          venue || null,
          basic_perk || null,
          advanced_perk || null,
          tag1 || null,
          tag2 || null,
          tag3 || null,
          price || null,
          image_url || null,
          id
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Event not found for update' });
      }

      return res.status(200).json(result.rows[0]);

    } catch (err) {
      console.error('[PUT] Error updating event:', err);
      return res.status(500).json({ error: 'Failed to update event', details: err.message });
    }
  }

  // ===== GET: Fetch events =====
  if (method === 'GET') {
    try {
      const approvedOnly = query.approvedOnly === 'true';
     const result = await pool.query(
  approvedOnly
    ? `
      SELECT e.*, COUNT(r.id) AS registered_users
      FROM events e
      LEFT JOIN registrations r ON r.event_id = e.id
      WHERE e.is_confirmed = TRUE
      GROUP BY e.id
      ORDER BY e.datetime ASC
    `
    : `
      SELECT e.*, COUNT(r.id) AS registered_users
      FROM events e
      LEFT JOIN registrations r ON r.event_id = e.id
      GROUP BY e.id
      ORDER BY e.datetime ASC
    `
);

          return res.status(200).json(result.rows);
        } catch (err) {
          console.error('[GET] Error fetching events:', err);
          return res.status(500).json({ error: 'Failed to fetch events', details: err.message });
        }
      }

  return res.status(405).json({ error: `Method ${method} Not Allowed` });
}

