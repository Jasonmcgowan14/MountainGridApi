// getOrCreateAppUser.js
import { pool } from "./db.js";

/**
 * Returns the app_user row for a firebase uid.
 * DOES NOT create.
 */
export async function getOrCreateAppUser({ firebaseUid }) {
  const sql = `
    SELECT id, firebase_uid, email, display_name
    FROM public.app_user
    WHERE firebase_uid = $1
    LIMIT 1
  `;

  const result = await pool.query(sql, [firebaseUid]);
  return result.rows[0] ?? null;
}

