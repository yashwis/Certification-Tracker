import fs from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

if (!url || !token) {
  throw new Error("Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN before seeding locally.");
}

const root = path.resolve(import.meta.dirname, "..");
const cases = JSON.parse(fs.readFileSync(path.join(root, "data/certification-seed.json"), "utf8"));
const redis = new Redis({ url, token });
await redis.set("niubiz-certification:dashboard-state", {
  version: "2026-10-27-explicit-scope-workbook",
  cases,
});
console.log("Seeded the Upstash Redis dashboard state.");
