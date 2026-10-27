import { NextResponse } from "next/server";
import { isAdmin } from "../../../lib/admin-auth";
import { markMutual, parseApTemplate, parsePacWorkbook, validateCases } from "../../../lib/source-parser";
import { readState, storageConfigured, writeState } from "../../../lib/blob-store";
import type { CertificationCase } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Admin session required." }, { status: 401 });
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((value): value is File => value instanceof File);
    if (!files.length) return NextResponse.json({ error: "Choose at least one .xlsx or .csv file." }, { status: 400 });
    if (files.some(file => file.size > 15 * 1024 * 1024)) return NextResponse.json({ error: "Each file must be 15 MB or smaller." }, { status: 400 });
    const parsed: CertificationCase[] = [];
    let passedIds = new Set<string>();
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const result = parsePacWorkbook(buffer, file.name);
        parsed.push(...result.pac, ...result.mutualAp);
        passedIds = result.passedApIds;
      }
    }
    for (const file of files) if (file.name.toLowerCase().endsWith(".csv")) parsed.push(...parseApTemplate(await file.arrayBuffer(), file.name, passedIds));
    const unique = new Map<string, CertificationCase>();
    for (const item of parsed) unique.set(item.key, item);
    const cases = markMutual([...unique.values()]);
    if (!validateCases(cases)) throw new Error("The imported test-case data is invalid.");
    if (form.get("mode") === "preview") return NextResponse.json({ summary: summarize(cases), files: files.map(file => file.name) });
    if (!storageConfigured()) return NextResponse.json({ error: "Connect a Vercel Blob store before applying imports." }, { status: 503 });
    const current = await readState();
    const byKey = new Map(current.cases.map(item => [item.key, item]));
    const merged = cases.map(item => {
      const current = byKey.get(item.key);
      return current ? { ...item, status: current.status, inScope: current.inScope, isMutual: current.isMutual || item.isMutual, updatedAt: new Date().toISOString() } : item;
    });
    const incomingKeys = new Set(merged.map(item => item.key));
    const next = [...current.cases.filter(item => !incomingKeys.has(item.key)), ...merged];
    await writeState(next);
    return NextResponse.json({ summary: summarize(merged), files: files.map(file => file.name) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not import files." }, { status: 400 });
  }
}

function summarize(cases: CertificationCase[]) {
  const pac = cases.filter(item => item.certification === "PAC"), ap = cases.filter(item => item.certification === "AP");
  return { pacCases: pac.length, pacInScope: pac.filter(item => item.inScope).length, apCases: ap.length, apInScope: ap.filter(item => item.inScope).length, mutual: ap.filter(item => item.isMutual).length };
}
