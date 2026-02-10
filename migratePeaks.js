import fs from "fs";
import { pool } from "./db.js";

function parseCSV(text) {
  // simple CSV parser (handles commas; does not handle quoted commas)
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const header = lines[0].split(",").map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    if (cols.length !== header.length) {
      throw new Error(
        `CSV column mismatch on line ${i + 1}. Expected ${header.length}, got ${cols.length}. Line: ${lines[i]}`
      );
    }
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = cols[j];
    rows.push(obj);
  }

  return rows;
}

async function migratePeaks() {
  const CSV_PATH = "./peaks.csv"; // <- change if needed

  console.log("Reading CSV file...");
  const raw = fs.readFileSync(CSV_PATH, "utf-8");

  console.log("Parsing CSV...");
  const peaks = parseCSV(raw);

  console.log("Loaded peaks:", peaks.length);

  const client = await pool.connect();
  const ping = await client.query("select 1 as ok");
  console.log("DB connected:", ping.rows[0]);

  try {
    await client.query("BEGIN");

    for (const p of peaks) {
      // Convert types explicitly
      const peakId = BigInt(p.peak_id);
      const peakName = p.peak_name || null;
      const state = p.state || null;

      const latitude = Number(p.latitude);
      const longitude = Number(p.longitude);

      const enterM = Number(p.enter_m);
      const exitM = Number(p.exit_m);
      const exitConsecPoints = Number(p.exit_consec_points);

      if (
        !peakName ||
        !state ||
        Number.isNaN(latitude) ||
        Number.isNaN(longitude) ||
        Number.isNaN(enterM) ||
        Number.isNaN(exitM) ||
        Number.isNaN(exitConsecPoints)
      ) {
        throw new Error(`Bad row detected: ${JSON.stringify(p)}`);
      }

      await client.query(
        `
        INSERT INTO peaks (
          peak_id,
          peak_name,
          state,
          latitude,
          longitude,
          enter_m,
          exit_m,
          exit_consec_points
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8
        )
        ON CONFLICT (peak_id) DO NOTHING
        `,
        [
          peakId.toString(), // pg can accept string for bigint safely
          peakName,
          state,
          latitude,
          longitude,
          enterM,
          exitM,
          exitConsecPoints
        ]
      );
    }

    await client.query("COMMIT");
    console.log(`Migrated ${peaks.length} peaks`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migratePeaks();
