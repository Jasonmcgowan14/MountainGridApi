import fs from "fs";
import { pool } from "./db.js";

const USER_ID = 2; // temporary user id for now

async function migrate() {
    console.log("Reading JSON file...");
    const raw = fs.readFileSync("./activitiesshay.json", "utf-8");
    console.log("Parsing JSON...");
    const activities = JSON.parse(raw);
    console.log("Loaded activities:", activities.length);
    

  const client = await pool.connect();
  const ping = await client.query("select 1 as ok");
  console.log("DB connected:", ping.rows[0]);
  

  try {
    await client.query("BEGIN");

    for (const a of activities) {
      await client.query(
        `
        INSERT INTO activities (
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
          payload
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11, $12
        )
        ON CONFLICT (user_id, strava_activity_id) DO NOTHING
        `,
        [
          USER_ID,
          a.id,
          a.name ?? null,
          a.sport_type ?? null,
          a.type ?? null,
          a.start_date ?? null,
          a.start_date_local ?? null,
          a.distance ?? null,
          a.moving_time ?? null,
          a.elapsed_time ?? null,
          a.total_elevation_gain ?? null,
          a
        ]
      );
    }

    await client.query("COMMIT");
    console.log(`Migrated ${activities.length} activities`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
