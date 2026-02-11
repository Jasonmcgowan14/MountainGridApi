// getOrCreateAppUser.js
import { pool } from "./db.js";

/**
 * Get-or-create the app_user row for a firebase uid.
 * Safe to call repeatedly (idempotent).
 *
 * Requires: UNIQUE(firebase_uid) on public.app_user
 */
export async function getOrCreateAppUser({ firebaseUid, email = null, displayName = null }) {
  const sql = `
    INSERT INTO public.app_user (firebase_uid, email, display_name, last_seen_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (firebase_uid)
    DO UPDATE SET
      email = COALESCE(EXCLUDED.email, public.app_user.email),
      display_name = COALESCE(EXCLUDED.display_name, public.app_user.display_name),
      last_seen_at = NOW()
    RETURNING id, firebase_uid, email, display_name, created_at, last_seen_at
  `;

  const result = await pool.query(sql, [String(firebaseUid), email, displayName]);
  return result.rows[0];
}
