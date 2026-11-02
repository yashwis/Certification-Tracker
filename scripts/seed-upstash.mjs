import fs from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error("Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN before seeding locally.");
}

const root = path.resolve(import.meta.dirname, "..");
const cases = JSON.parse(fs.readFileSync(path.join(root, "data/certification-seed.json"), "utf8"));
const redis = Redis.fromEnv();
await redis.set("niubiz-certification:dashboard-state", {
  version: "2026-10-27-explicit-scope-workbook",
  cases,
});
console.log("Seeded the Upstash Redis dashboard state.");
