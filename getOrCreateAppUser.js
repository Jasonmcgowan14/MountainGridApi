// getOrCreateAppUser.js
import { pool } from "./db.js";

/**
 * Get or create app_user for a firebase uid.
 * Safe for concurrent sign-ins (UPSERT).
 */
export async function getOrCreateAppUser({ firebaseUid, email, displayName }) {
  const sql = `
    INSERT INTO public.app_user (firebase_uid, email, display_name, created_at, last_seen_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    ON CONFLICT (firebase_uid)
    DO UPDATE SET
      email = COALESCE(EXCLUDED.email, public.app_user.email),
      display_name = COALESCE(EXCLUDED.display_name, public.app_user.display_name),
      last_seen_at = NOW()
    RETURNING id, firebase_uid, email, display_name, created_at, last_seen_at
  `;

  const result = await pool.query(sql, [
    firebaseUid,
    email ?? null,
    displayName ?? null,
  ]);

  return result.rows[0] ?? null;
}
