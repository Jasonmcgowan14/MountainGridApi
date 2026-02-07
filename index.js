import express from "express";
import cors from "cors";
import { getActivitiesFromDb } from "./getActivitiesFromDb.js";
import { buildGroupedByDayFromActivities, buildDayCountsFromActivities } from "./dailyGroups.js";

const app = express();
app.use(cors());
app.use(express.json());

let cachedGroups = null;
let buildingGroups = null;

let cachedCounts = null;
let buildingCounts = null;

const DEFAULT_USER_ID = Number(process.env.DEFAULT_USER_ID || 1);

async function getGroupedData() {
  if (cachedGroups) return cachedGroups;

  if (!buildingGroups) {
    buildingGroups = (async () => {
      const activities = await getActivitiesFromDb({ userId: DEFAULT_USER_ID });
      cachedGroups = buildGroupedByDayFromActivities(activities);
      return cachedGroups;
    })();
  }
  return buildingGroups;
}

async function getDayCounts() {
  if (cachedCounts) return cachedCounts;

  if (!buildingCounts) {
    buildingCounts = (async () => {
      const activities = await getActivitiesFromDb({ userId: DEFAULT_USER_ID });
      cachedCounts = buildDayCountsFromActivities(activities);
      return cachedCounts;
    })();
  }
  return buildingCounts;
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    usingDb: true,
    routes: ["by-day", "day-counts"]
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

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

app.get("/api/activities/day-counts", async (req, res) => {
  try {
    const counts = await getDayCounts();
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

app.get("/api/activities", async (req, res) => {
    try {
      const userId = Number(req.query.userId ?? 1);
      const limit = Number(req.query.limit ?? 5000);
  
      const activities = await getActivitiesFromDb({ userId, limit });
      res.json(activities);
    } catch (err) {
      res.status(500).json({ error: String(err?.message ?? err) });
    }
  });
  


const port = process.env.PORT;
//const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});

