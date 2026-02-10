// requireDbUser.js
import { getOrCreateAppUser } from "./getOrCreateAppUser.js";

export async function requireDbUser(req, res, next) {
  try {
    // requireAuth must have run first
    const firebaseUid = req.user?.uid;
    if (!firebaseUid) return res.status(401).json({ error: "Missing firebase user" });

    const dbUser = await getOrCreateAppUser({
      firebaseUid,
      email: req.user.email ?? null,
      displayName: null, // optionally from token if present
    });

    req.dbUser = dbUser; // { id, firebase_uid, email, display_name }
    next();
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}
