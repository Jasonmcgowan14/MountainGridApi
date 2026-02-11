import "dotenv/config";
import express from "express";
import cors from "cors";
import { admin } from "./firebaseAdmin.js";
import { requireAuth } from "./requireAuth.js";
import { requireDbUser } from "./requireDbUser.js";
import { getPeaksFromDb } from "./getPeaksFromDb.js";
import { getRangesFromDb } from "./getRangesFromDb.js";


import { getActivitiesFromDb } from "./getActivitiesFromDb.js";
import {
  buildGroupedByDayFromActivities,
  buildDayCountsFromActivities,
} from "./dailyGroups.js";
import { createManualActivityInDb } from "./createManualActivityInDb.js";

const app = express();
const corsOptions = {
  origin: [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "https://mountaingridangular.onrender.com",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions)); // ✅ handle preflight for all routes


app.use(express.json());

// --------------------
// Simple in-memory cache (PER USER)
// --------------------
const cachedGroupsByUser = new Map(); // userId -> grouped data
const buildingGroupsByUser = new Map(); // userId -> Promise

const cachedCountsByUser = new Map(); // userId -> counts data
const buildingCountsByUser = new Map(); // userId -> Promise

function invalidateCachesForUser(userId, reason = "") {
  cachedGroupsByUser.delete(userId);
  buildingGroupsByUser.delete(userId);

  cachedCountsByUser.delete(userId);
  buildingCountsByUser.delete(userId);

  console.log(`🧹 invalidateCachesForUser(${userId})${reason ? ` - ${reason}` : ""}`);
}

function invalidateAllCaches(reason = "") {
  cachedGroupsByUser.clear();
  buildingGroupsByUser.clear();

  cachedCountsByUser.clear();
  buildingCountsByUser.clear();

  console.log(`🧹 invalidateAllCaches${reason ? ` - ${reason}` : ""}`);
}

// --------------------
// Cached getters (PER USER)
// --------------------
async function getGroupedData(userId) {
  if (cachedGroupsByUser.has(userId)) {
    console.log(`🟡 /by-day served from cache (userId=${userId})`);
    return cachedGroupsByUser.get(userId);
  }

  if (!buildingGroupsByUser.has(userId)) {
    console.log(`🟢 /by-day rebuilding from DB (userId=${userId})`);
    buildingGroupsByUser.set(
      userId,
      (async () => {
        const activities = await getActivitiesFromDb({ userId });
        const grouped = buildGroupedByDayFromActivities(activities);
        cachedGroupsByUser.set(userId, grouped);
        buildingGroupsByUser.delete(userId);
        return grouped;
      })()
    );
  }

  return buildingGroupsByUser.get(userId);
}

async function getDayCounts(userId) {
  if (cachedCountsByUser.has(userId)) {
    console.log(`🟡 /day-counts served from cache (userId=${userId})`);
    return cachedCountsByUser.get(userId);
  }

  if (!buildingCountsByUser.has(userId)) {
    console.log(`🟢 /day-counts rebuilding from DB (userId=${userId})`);
    buildingCountsByUser.set(
      userId,
      (async () => {
        const activities = await getActivitiesFromDb({ userId });
        const counts = buildDayCountsFromActivities(activities);
        cachedCountsByUser.set(userId, counts);
        buildingCountsByUser.delete(userId);
        return counts;
      })()
    );
  }

  return buildingCountsByUser.get(userId);
}

// --------------------
// Routes
// --------------------

app.get("/api/debug/dbuser", requireAuth, requireDbUser, (req, res) => {
  res.json({
    ok: true,
    firebaseUid: req.user.uid,
    dbUser: req.dbUser,
  });
});

app.get("/api/ranges", requireAuth, requireDbUser, async (req, res) => {
  try {
    const rows = await getRangesFromDb();
    res.json(rows);
  } catch (err) {
    console.error("GET /api/ranges failed", err);
    res.status(500).json({ error: "Failed to load ranges" });
  }
});


// Public health check (ok to keep public)
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    usingDb: true,
    routes: ["by-day", "day-counts", "activities", "activities/manual", "peaks"],
  });
});

app.get("/api/peaks", requireAuth, requireDbUser, async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 5000);
    const state = req.query.state ? String(req.query.state) : null;

    const peaks = await getPeaksFromDb({ state, limit });
    return res.json(peaks);
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
});

// 🔒 Who am I (Firebase identity)
app.get("/api/whoami", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// 🔒 Protect: grouped-by-day data (scoped to caller)
app.get("/api/activities/by-day", requireAuth, requireDbUser, async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const data = await getGroupedData(userId);

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

// 🔒 Protect: day counts (scoped to caller)
app.get("/api/activities/day-counts", requireAuth, requireDbUser, async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const counts = await getDayCounts(userId);
    return res.json(counts);
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
});

// 🔒 Protect: raw activities (scoped to caller)
app.get("/api/activities", requireAuth, requireDbUser, async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const limit = Number(req.query.limit ?? 5000);

    // IMPORTANT: no userId from query/body. Always from verified token -> DB user.
    const activities = await getActivitiesFromDb({ userId, limit });
    return res.json(activities);
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
});

// 🔒 Protect: create manual activity (scoped to caller)
app.post("/api/activities/manual", requireAuth, requireDbUser, async (req, res) => {
  try {
    console.log("✅ POST /api/activities/manual");

    const userId = req.dbUser.id;

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

    // Bust caches so /by-day and /day-counts reflect the new row (for this user only)
    invalidateCachesForUser(userId, "manual activity created");

    return res.status(201).json(created);
  } catch (err) {
    console.error("❌ POST /api/activities/manual error:", err);
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
});

// 🔒 Protect: cache clear
app.post("/api/cache/clear", requireAuth, requireDbUser, (req, res) => {
  // Allow clearing only your own caches
  const userId = req.dbUser.id;
  invalidateCachesForUser(userId, "manual clear endpoint");
  res.json({ ok: true });
});

// Debug route (keep public only locally; consider removing/locking in prod)
app.get("/api/debug/firebase", (req, res) => {
  try {
    const appInstance = admin.app();
    res.json({
      ok: true,
      appName: appInstance.name,
      projectId: appInstance.options.projectId ?? null,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message ?? err) });
  }
});

// --------------------
// Server
// --------------------

// If broken check here comment out 3000 for prod, comment in for local
//const port = process.env.PORT || 3000;
const port = process.env.PORT;
app.listen(port, () => {
    console.log(`✅ Server running on http://localhost:${port}`);
});
