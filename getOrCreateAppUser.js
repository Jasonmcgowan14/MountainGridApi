// getOrCreateAppUser.js
import { pool } from "./db.js";

/**
 * Returns the app_user row for a firebase uid.
 * If it doesn't exist yet, it creates it.
 */
export async function getOrCreateAppUser({ firebaseUid, email = null, displayName = null }) {
  // Use UPSERT so it's safe if two requests happen at once.
  const sql = `
    INSERT INTO public.app_user (firebase_uid, email, display_name, created_at, last_seen_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    ON CONFLICT (firebase_uid)
    DO UPDATE SET
      email = COALESCE(EXCLUDED.email, public.app_user.email),
      display_name = COALESCE(EXCLUDED.display_name, public.app_user.display_name),
      last_seen_at = NOW()
    RETURNING id, firebase_uid, email, display_name
  `;

  const result = await pool.query(sql, [firebaseUid, email, displayName]);
  return result.rows[0];
}
