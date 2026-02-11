// getPeaksFromDb.js
import { pool } from "./db.js";

export async function getPeaksFromDb({ state = null, limit = 5000 } = {}) {
  const client = await pool.connect();
  try {
    const params = [];
    let where = "";

    if (state) {
      params.push(String(state));
      where = `WHERE state = $${params.length}`;
    }

    params.push(Number(limit));
    const limitSql = `$${params.length}`;

    const result = await client.query(
      `
      SELECT
        peak_id,
        peak_name,
        state,
        range_id,
        latitude,
        longitude,
        enter_m,
        exit_m,
        exit_consec_points
      FROM peaks
      ${where}
      ORDER BY peak_name ASC
      LIMIT ${limitSql}
      `,
      params
    );

    return result.rows;
  } finally {
    client.release();
  }
}
