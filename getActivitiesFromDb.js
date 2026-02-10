// getActivitiesFromDb.js
import { pool } from "./db.js";

export async function getActivitiesFromDb({ userId, limit = 5000 } = {}) {
  if (userId == null) {
    throw new Error("getActivitiesFromDb: userId is required");
  }

  const sql = `
    SELECT
      payload,
      COALESCE(
        (SELECT jsonb_agg(x::text) FROM unnest(qualifies_as_route) AS x),
        '[]'::jsonb
      ) AS qualifies_as_route
    FROM public.activities
    WHERE user_id = $1
    ORDER BY start_date DESC NULLS LAST
    LIMIT $2
  `;

  const result = await pool.query(sql, [userId, limit]);

  // payload is a JS object already (jsonb)
  // attach qualifies_as_route as string[]
  return result.rows.map((r) => ({
    ...r.payload,
    qualifies_as_route: r.qualifies_as_route, // already JSON array of strings
  }));
}
