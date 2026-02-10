import admin from "firebase-admin";
import fs from "fs";

if (!admin.apps.length) {
  let serviceAccount;

  // ✅ Render / production: JSON in env var (unchanged behavior)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  // ✅ Local dev: load from file path
  else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const raw = fs.readFileSync(
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      "utf-8"
    );
    serviceAccount = JSON.parse(raw);
  }
  // Optional: standard Google env fallback
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const raw = fs.readFileSync(
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      "utf-8"
    );
    serviceAccount = JSON.parse(raw);
  }
  else {
    throw new Error(
      "Missing FIREBASE_SERVICE_ACCOUNT_JSON (Render) or FIREBASE_SERVICE_ACCOUNT_PATH (local)"
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export { admin };
