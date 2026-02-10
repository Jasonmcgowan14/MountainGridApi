// getActivitiesFromDb.js
import { pool } from "./db.js";

export async function getActivitiesFromDb({ userId, limit = 5000 } = {}) {
  if (userId == null) {
    throw new Error("getActivitiesFromDb: userId is required");
  }

  const sql = `
    SELECT payload
    FROM activities
    WHERE user_id = $1
    ORDER BY start_date DESC NULLS LAST
    LIMIT $2
  `;

  const result = await pool.query(sql, [userId, limit]);

  // payload comes back as a JS object already (jsonb)
  return result.rows.map((r) => r.payload);
}
