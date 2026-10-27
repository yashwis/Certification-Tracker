import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";

if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Set BLOB_READ_WRITE_TOKEN before seeding locally.");
const root = path.resolve(import.meta.dirname, "..");
const cases = JSON.parse(fs.readFileSync(path.join(root, "data/certification-seed.json"), "utf8"));
const body = JSON.stringify({ version: "2026-10-27-explicit-scope-workbook", cases });
await put("niubiz-certification/dashboard-state.json", body, {
  access: "private",
  allowOverwrite: true,
  cacheControlMaxAge: 60,
  contentType: "application/json",
});
console.log("Seeded the Vercel Blob dashboard state.");
