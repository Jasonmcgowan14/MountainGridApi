// dailyGroups.js
import fs from "node:fs";

import streamChain from "stream-chain";
const { chain } = streamChain;

import streamJson from "stream-json";
const { parser } = streamJson;

import streamJsonStreamers from "stream-json/streamers/StreamArray.js";
const { streamArray } = streamJsonStreamers;


function pad2(n) {
  return String(n).padStart(2, "0");
}

function toMiles(meters) {
  return meters / 1609.344;
}

// Returns { key: "MM-DD", fullDate: "YYYY-MM-DD", time: "HH:MM" }
function extractLocalDateParts(activity) {
  // prefer local; fallback to UTC
  const iso = activity.start_date_local ?? activity.start_date;
  if (!iso) return null;

  // "2026-02-03T16:08:11Z" or "...:11Z" or sometimes without Z
  const datePart = iso.slice(0, 10);  // YYYY-MM-DD
  const timePart = iso.slice(11, 16); // HH:MM

  const month = datePart.slice(5, 7);
  const day = datePart.slice(8, 10);

  return {
    key: `${month}-${day}`,
    fullDate: datePart,
    time: timePart,
  };
}

function summarizeActivity(a) {
  const sport = a.sport_type ?? a.type ?? "UNKNOWN";
  const parts = extractLocalDateParts(a);

  return {
    id: a.id,
    name: a.name ?? null,
    sport,
    // keep both the grouped key and the actual date (year kept for context)
    dayKey: parts?.key ?? null,         // "MM-DD"
    dateLocal: parts?.fullDate ?? null, // "YYYY-MM-DD"
    startTimeLocal: parts?.time ?? null, // "HH:MM"

    distance_m: Number(a.distance ?? 0),
    distance_mi: Number.isFinite(a.distance) ? toMiles(Number(a.distance)) : 0,

    moving_time_s: Number(a.moving_time ?? 0),
    elapsed_time_s: Number(a.elapsed_time ?? 0),

    elevation_gain_m: Number(a.total_elevation_gain ?? 0),

    timezone: a.timezone ?? null,
    utc_offset: a.utc_offset ?? null,

    // “some location data” without getting too deep
    start_latlng: Array.isArray(a.start_latlng) ? a.start_latlng : null,
    end_latlng: Array.isArray(a.end_latlng) ? a.end_latlng : null,
    location_city: a.location_city ?? null,
    location_state: a.location_state ?? null,
    location_country: a.location_country ?? null,
  };
}

/**
 * Streams activities.json (root array) and groups by MM-DD ignoring year.
 * Returns:
 * [
 *   { dayKey: "02-03", activities: [ ... ], count: 12, totalDistanceMi: 42.1 },
 *   ...
 * ]
 */
export async function buildGroupedByDay(filePath) {
  const groups = new Map(); // "MM-DD" -> array of summaries

  await new Promise((resolve, reject) => {
    const pipeline = chain([
      fs.createReadStream(filePath, { encoding: "utf8" }),
      parser(),
      streamArray(),
    ]);

    pipeline.on("data", ({ value }) => {
      const parts = extractLocalDateParts(value);
      if (!parts?.key) return;

      const summary = summarizeActivity(value);
      const arr = groups.get(parts.key) ?? [];
      arr.push(summary);
      groups.set(parts.key, arr);
    });

    pipeline.on("end", resolve);
    pipeline.on("error", reject);
  });

  // Turn map into sorted response
  const result = [];
  for (const [dayKey, activities] of groups.entries()) {
    // Sort activities within a day by time, then by date
    activities.sort((a, b) => {
      const t = String(a.startTimeLocal ?? "").localeCompare(String(b.startTimeLocal ?? ""));
      if (t !== 0) return t;
      return String(a.dateLocal ?? "").localeCompare(String(b.dateLocal ?? ""));
    });

    const totalDistanceMi = activities.reduce((sum, x) => sum + (x.distance_mi ?? 0), 0);

    result.push({
      dayKey,
      count: activities.length,
      totalDistanceMi,
      activities,
    });
  }

  // Sort by month-day
  result.sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  return result;
}

/**
 * Streams activities.json and returns counts per MM-DD ignoring year.
 * Returns: { "01-11": 5, "02-03": 12, ... }
 */
export async function buildDayCounts(filePath) {
  const counts = new Map(); // "MM-DD" -> number

  await new Promise((resolve, reject) => {
    const pipeline = chain([
      fs.createReadStream(filePath, { encoding: "utf8" }),
      parser(),
      streamArray(),
    ]);

    pipeline.on("data", ({ value }) => {
      const parts = extractLocalDateParts(value);
      if (!parts?.key) return;

      counts.set(parts.key, (counts.get(parts.key) ?? 0) + 1);
    });

    pipeline.on("end", resolve);
    pipeline.on("error", reject);
  });

  // convert Map -> plain object
  const out = {};
  for (const [k, v] of counts.entries()) out[k] = v;

  // optional: keep it sorted by key
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

