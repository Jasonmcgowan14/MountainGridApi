// createManualActivityInDb.js
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function createManualActivityInDb({
  userId,
  name,
  sportType,
  activityType,
  startDateLocal, // ISO string
  distance,
  elapsedTime,
  movingTime,
  totalElevationGain,
  notes,
}) {
  // For now: start_date == start_date_local (basic, no TZ work)
  const start = startDateLocal;

  // ✅ Make payload compatible with Strava-shaped UI expectations
  const payload = {
    source: "manual",
    name: name ?? null,
    type: activityType ?? null,
    sport_type: sportType ?? null,
    start_date: start ?? null,
    start_date_local: start ?? null,
    distance: distance ?? null,
    moving_time: movingTime ?? null,
    elapsed_time: elapsedTime ?? null,
    total_elevation_gain: totalElevationGain ?? null,
    notes: notes ?? null,
  };

  const sql = `
    INSERT INTO public.activities (
      user_id,
      strava_activity_id,
      name,
      sport_type,
      activity_type,
      start_date,
      start_date_local,
      distance,
      moving_time,
      elapsed_time,
      total_elevation_gain,
      payload,
      activity_source
    )
    VALUES (
      $1,
      NULL,
      $2,
      $3,
      $4,
      $5::timestamptz,
      $6::timestamptz,
      $7::double precision,
      $8::integer,
      $9::integer,
      $10::double precision,
      $11::jsonb,
      'manual'
    )
    RETURNING *;
  `;

  const values = [
    userId,
    name,
    sportType,
    activityType,
    start,
    start,
    distance ?? null,
    movingTime ?? null,
    elapsedTime,
    totalElevationGain ?? null,
    JSON.stringify(payload),
  ];

  const result = await pool.query(sql, values);
  return result.rows[0];
}
