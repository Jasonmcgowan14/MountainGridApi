// getRangesFromDb.js
import { pool } from "./db.js";

export async function getRangesFromDb() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT range_id, range_name
      FROM public.range
      ORDER BY range_id ASC
    `);

    return result.rows;
  } finally {
    client.release();
  }
}
