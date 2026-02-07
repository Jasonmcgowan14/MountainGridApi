import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

console.log("DB CONFIG LOADED. SSL FORCED =", true);


// If DATABASE_URL includes "?sslmode=require", pg will still want ssl options sometimes.
// This makes it explicit and works with Render.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
