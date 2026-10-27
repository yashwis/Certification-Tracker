import { get, put } from "@vercel/blob";
import seed from "../data/certification-seed.json";
import type { CertificationCase } from "./types";
import { applyCaseUpdate, restoreMissingScope, selectVersionedCases, type CaseUpdate } from "./case-update";

const DATA_PATH = "niubiz-certification/dashboard-state.json";
const DATA_VERSION = "2026-10-27-explicit-scope-workbook";
const DEFAULT_SCOPES = new Map((seed as CertificationCase[]).map(item => [item.key, item.inScope]));

export function storageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export async function readState(): Promise<{ cases: CertificationCase[]; etag?: string; stored: boolean }> {
  if (!storageConfigured()) return { cases: seed as CertificationCase[], stored: false };
  const result = await get(DATA_PATH, { access: "private", useCache: false });
  if (!result) return { cases: seed as CertificationCase[], stored: false };
  if (result.statusCode !== 200) throw new Error(`Could not read shared dashboard data (${result.statusCode}).`);
  const stored = await new Response(result.stream).json() as unknown;
  const selected = selectVersionedCases<CertificationCase>(stored, DATA_VERSION, seed as CertificationCase[]);
  const cases = restoreMissingScope(selected.cases, DEFAULT_SCOPES);
  if (selected.needsMigration && cases.length) await writeState(cases);
  return { cases, etag: result.blob.etag, stored: true };
}

export async function writeState(cases: CertificationCase[]) {
  return put(DATA_PATH, JSON.stringify({ version: DATA_VERSION, cases }), {
    access: "private",
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json",
  });
}

export async function patchStoredCase(key: string, updates: CaseUpdate) {
  const current = await readState();
  const index = current.cases.findIndex(item => item.key === key);
  if (index < 0) throw new Error("Test case was not found.");
  const updated = { ...applyCaseUpdate(current.cases[index], updates), updatedAt: new Date().toISOString() };
  const cases = [...current.cases];
  cases[index] = updated;
  await writeState(cases);
  const confirmed = await readState();
  const saved = confirmed.cases.find(item => item.key === key);
  if (!saved || (updates.status !== undefined && saved.status !== updates.status) || (updates.inScope !== undefined && saved.inScope !== updates.inScope)) {
    throw new Error("The saved status could not be confirmed. Please try again.");
  }
  return saved;
}
