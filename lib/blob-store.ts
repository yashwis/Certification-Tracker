import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import seed from "../data/certification-seed.json";
import type { CertificationCase } from "./types";

const DATA_PATH = "niubiz-certification/dashboard-state.json";

export function storageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export async function readState(): Promise<{ cases: CertificationCase[]; etag?: string; stored: boolean }> {
  if (!storageConfigured()) return { cases: seed as CertificationCase[], stored: false };
  const result = await get(DATA_PATH, { access: "private", useCache: false });
  if (!result) return { cases: seed as CertificationCase[], stored: false };
  if (result.statusCode !== 200) throw new Error(`Could not read shared dashboard data (${result.statusCode}).`);
  const cases = await new Response(result.stream).json() as CertificationCase[];
  return { cases, etag: result.blob.etag, stored: true };
}

export async function writeState(cases: CertificationCase[], etag?: string) {
  try {
    return await put(DATA_PATH, JSON.stringify(cases), {
      access: "private",
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      contentType: "application/json",
      ...(etag ? { ifMatch: etag } : {}),
    });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) {
      throw new Error("The dashboard changed while this update was being saved. Refresh and try again.");
    }
    throw error;
  }
}

export async function patchStoredCase(key: string, updates: { status?: string; inScope?: boolean }) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await readState();
    const index = current.cases.findIndex(item => item.key === key);
    if (index < 0) throw new Error("Test case was not found.");
    const updated = { ...current.cases[index], ...updates, updatedAt: new Date().toISOString() };
    const cases = [...current.cases];
    cases[index] = updated;
    try {
      await writeState(cases, current.etag);
      const confirmed = await readState();
      const saved = confirmed.cases.find(item => item.key === key);
      if (!saved || (updates.status !== undefined && saved.status !== updates.status) || (updates.inScope !== undefined && saved.inScope !== updates.inScope)) {
        throw new Error("The saved status could not be confirmed. Please try again.");
      }
      return saved;
    } catch (error) {
      const conflicted = error instanceof Error && error.message.startsWith("The dashboard changed while this update was being saved");
      if (!conflicted || attempt === 1) throw error;
    }
  }
  throw new Error("Could not update test case.");
}
