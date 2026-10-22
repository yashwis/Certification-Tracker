import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";

if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Set BLOB_READ_WRITE_TOKEN before seeding locally.");
const root = path.resolve(import.meta.dirname, "..");
const body = fs.readFileSync(path.join(root, "data/certification-seed.local.json"), "utf8");
await put("niubiz-certification/dashboard-state.json", body, {
  access: "private",
  allowOverwrite: true,
  cacheControlMaxAge: 60,
  contentType: "application/json",
});
console.log("Seeded the Vercel Blob dashboard state.");
