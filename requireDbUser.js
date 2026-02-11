// requireDbUser.js
import { getOrCreateAppUser } from "./getOrCreateAppUser.js";

export async function requireDbUser(req, res, next) {
  try {
    const firebaseUid = req.user?.uid;
    if (!firebaseUid) return res.status(401).json({ error: "Missing firebase user" });

    const dbUser = await getOrCreateAppUser({
      firebaseUid,
      email: req.user.email ?? null,
      displayName: req.user.name ?? req.user.displayName ?? null,
    });

    if (!dbUser) return res.status(500).json({ error: "Failed to load/create db user" });

    req.dbUser = dbUser;
    next();
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}
