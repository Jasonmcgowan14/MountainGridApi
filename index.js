import express from "express";
import cors from "cors";
import { getActivitiesFromDb } from "./getActivitiesFromDb.js";
import {
  buildGroupedByDayFromActivities,
  buildDayCountsFromActivities,
} from "./dailyGroups.js";
import { createManualActivityInDb } from "./createManualActivityInDb.js";

const app = express();
app.use(cors());
app.use(express.json());

// --------------------
// Simple in-memory cache
// --------------------
let cachedGroups = null;
let buildingGroups = null;

let cachedCounts = null;
let buildingCounts = null;

function invalidateCaches(reason = "") {
  cachedGroups = null;
  buildingGroups = null;

  cachedCounts = null;
  buildingCounts = null;

  console.log(`🧹 invalidateCaches${reason ? ` - ${reason}` : ""}`);
}

const DEFAULT_USER_ID = Number(process.env.DEFAULT_USER_ID || 1);

// --------------------
// Cached getters
// --------------------
async function getGroupedData() {
  if (cachedGroups) {
    console.log("🟡 /by-day served from cache");
    return cachedGroups;
  }

  if (!buildingGroups) {
    console.log("🟢 /by-day rebuilding from DB");
    buildingGroups = (async () => {
      const activities = await getActivitiesFromDb({ userId: DEFAULT_USER_ID });
      cachedGroups = buildGroupedByDayFromActivities(activities);
      return cachedGroups;
    })();
  }

  return buildingGroups;
}

async function getDayCounts() {
  if (cachedCounts) {
    console.log("🟡 /day-counts served from cache");
    return cachedCounts;
  }

  if (!buildingCounts) {
    console.log("🟢 /day-counts rebuilding from DB");
    buildingCounts = (async () => {
      const activities = await getActivitiesFromDb({ userId: DEFAULT_USER_ID });
      cachedCounts = buildDayCountsFromActivities(activities);
      return cachedCounts;
    })();
  }

  return buildingCounts;
}

// --------------------
// Routes
// --------------------
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    usingDb: true,
    routes: ["by-day", "day-counts", "activities", "activities/manual"],
  });
});

app.get("/api/activities/by-day", async (req, res) => {
  try {
    const data = await getGroupedData();
    const { dayKey } = req.query;

    if (dayKey) {
      const one = data.find((g) => g.dayKey === dayKey);
      return res.json(one ?? null);
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
});

app.get("/api/activities/day-counts", async (req, res) => {
  try {
    const counts = await getDayCounts();
    return res.json(counts);
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
});

app.get("/api/activities", async (req, res) => {
  try {
    const userId = Number(req.query.userId ?? DEFAULT_USER_ID);
    const limit = Number(req.query.limit ?? 5000);

    const activities = await getActivitiesFromDb({ userId, limit });
    return res.json(activities);
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
});

app.post("/api/activities/manual", async (req, res) => {
  try {
    console.log("✅ POST /api/activities/manual");

    const userId = DEFAULT_USER_ID; // assume everything is you for now

    const {
      name,
      sportType,
      activityType,
      startDateLocal,
      distance,
      elapsedTime,
      movingTime,
      totalElevationGain,
      notes,
    } = req.body ?? {};

    // Mandatory fields
    if (!name || !sportType || !activityType || !startDateLocal || elapsedTime == null) {
      return res.status(400).json({
        error:
          "Missing required fields. Required: name, sportType, activityType, startDateLocal, elapsedTime",
      });
    }

    const created = await createManualActivityInDb({
      userId,
      name: String(name),
      sportType: String(sportType),
      activityType: String(activityType),
      startDateLocal: String(startDateLocal),
      distance: distance == null ? null : Number(distance),
      elapsedTime: Number(elapsedTime),
      movingTime: movingTime == null ? null : Number(movingTime),
      totalElevationGain: totalElevationGain == null ? null : Number(totalElevationGain),
      notes: notes == null ? null : String(notes),
    });

    // Bust caches so /by-day and /day-counts reflect the new row
    invalidateCaches("manual activity created");

    return res.status(201).json(created);
  } catch (err) {
    console.error("❌ POST /api/activities/manual error:", err);
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
});

// Optional: manual cache clear endpoint for debugging
app.post("/api/cache/clear", (req, res) => {
  invalidateCaches("manual clear endpoint");
  res.json({ ok: true });
});

// --------------------
// Server
// --------------------


// If broken check here comment out 3000 for prod, comment in for local
// const port = process.env.PORT || 3000;
const port = process.env.PORT;
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
