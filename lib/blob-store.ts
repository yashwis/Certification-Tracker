import { Redis } from "@upstash/redis";
import seed from "../data/certification-seed.json";
import type { CertificationCase } from "./types";
import { applyCaseUpdate, restoreMissingScope, selectVersionedCases, type CaseUpdate } from "./case-update";

const DATA_KEY = "niubiz-certification:dashboard-state";
const DATA_VERSION = "2026-10-27-explicit-scope-workbook";
const DEFAULT_SCOPES = new Map((seed as CertificationCase[]).map(item => [item.key, item.inScope]));

function redisCredentials() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
  };
}

export function storageConfigured() {
  const { url, token } = redisCredentials();
  return Boolean(url && token);
}

function redisClient() {
  const { url, token } = redisCredentials();
  if (!url || !token) throw new Error("Upstash Redis is not connected.");
  return new Redis({
    url,
    token,
  });
}

export async function readState(): Promise<{ cases: CertificationCase[]; etag?: string; stored: boolean }> {
  if (!storageConfigured()) return { cases: seed as CertificationCase[], stored: false };
  const stored = await redisClient().get<unknown>(DATA_KEY);
  if (stored == null) return { cases: seed as CertificationCase[], stored: false };
  const selected = selectVersionedCases<CertificationCase>(stored, DATA_VERSION, seed as CertificationCase[]);
  const cases = restoreMissingScope(selected.cases, DEFAULT_SCOPES);
  if (selected.needsMigration && cases.length) await writeState(cases);
  return { cases, stored: true };
}

export async function writeState(cases: CertificationCase[]) {
  if (!storageConfigured()) throw new Error("Upstash Redis is not connected.");
  return redisClient().set(DATA_KEY, { version: DATA_VERSION, cases });
}

export async function patchStoredCase(key: string, updates: CaseUpdate) {
  const current = await readState();
  const index = current.cases.findIndex(item => item.key === key);
  if (index < 0) throw new Error("Test case was not found.");
  const updated = { ...applyCaseUpdate(current.cases[index], updates), updatedAt: new Date().toISOString() };
  const cases = [...current.cases];
  cases[index] = updated;
  await writeState(cases);
  return updated;
}
