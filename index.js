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


const port = process.env.PORT;
// const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});


// // index.js
// import express from "express";
// import cors from "cors";
// import { getActivitiesFromDb } from "./getActivitiesFromDb.js";
// import { buildGroupedByDay, buildDayCounts } from "./dailyGroups.js";

// const app = express();
// app.use(cors());
// app.use(express.json());

// // IMPORTANT: single, consistent file path
// //const FILE_PATH = "./activities.json";

// /**
//  * ============================
//  * In-memory caches
//  * ============================
//  */
// let cachedGroups = null;
// let buildingGroups = null;

// let cachedCounts = null;
// let buildingCounts = null;

// /**
//  * Build + cache grouped-by-day data
//  */
// async function getGroupedData() {
//   if (cachedGroups) return cachedGroups;

//   if (!buildingGroups) {
//     buildingGroups = buildGroupedByDay(FILE_PATH).then((data) => {
//       cachedGroups = data;
//       return cachedGroups;
//     });
//   }

//   return buildingGroups;
// }

// /**
//  * Build + cache day-counts data
//  */
// async function getDayCounts() {
//   if (cachedCounts) return cachedCounts;

//   if (!buildingCounts) {
//     buildingCounts = buildDayCounts(FILE_PATH).then((data) => {
//       cachedCounts = data;
//       return cachedCounts;
//     });
//   }

//   return buildingCounts;
// }

// /**
//  * ============================
//  * Routes
//  * ============================
//  */

// // sanity check
// app.get("/api/health", (req, res) => {
//   res.json({
//     ok: true,
//     routes: ["by-day", "day-counts"]
//   });
// });

// // GET /api/activities/by-day
// // Optional:
// //   ?dayKey=MM-DD
// app.get("/api/activities/by-day", async (req, res) => {
//   try {
//     const data = await getGroupedData();
//     const { dayKey } = req.query;

//     if (dayKey) {
//       const one = data.find((g) => g.dayKey === dayKey);
//       return res.json(one ?? null);
//     }

//     res.json(data);
//   } catch (err) {
//     res.status(500).json({ error: String(err?.message ?? err) });
//   }
// });

// // GET /api/activities/day-counts
// // Returns: { "MM-DD": number }
// app.get("/api/activities/day-counts", async (req, res) => {
//   try {
//     const counts = await getDayCounts();
//     res.json(counts);
//   } catch (err) {
//     res.status(500).json({ error: String(err?.message ?? err) });
//   }
// });

// /**
//  * ============================
//  * Server start
//  * ============================
//  */
// const port = process.env.PORT || 3000;
// //const port = process.env.PORT;
// app.listen(port, () => {
//   console.log("====================================");
//   console.log(`✅ Server running on http://localhost:${port}`);
//   console.log("✅ Routes registered:");
//   console.log("   GET /api/activities/by-day");
//   console.log("   GET /api/activities/day-counts");
//   console.log("====================================");
// });
