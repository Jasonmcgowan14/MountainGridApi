// requireAuth.js
import { admin } from "./firebaseAdmin.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer (.+)$/);

    if (!match) {
      return res.status(401).json({ error: "Missing Authorization Bearer token" });
    }

    const decoded = await admin.auth().verifyIdToken(match[1]);

    // Put trusted identity on the request
    req.user = {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: decoded.name ?? null,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid/expired token" });
  }
}
