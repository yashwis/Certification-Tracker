import { NextResponse } from "next/server";
import { isAdmin } from "../../../lib/admin-auth";
import { certificationWorkbookKind, combineApTemplateCases, markMutual, mergeImportedCases, parseApTemplate, parseApWorkbook, parsePacWorkbook, validateCases } from "../../../lib/source-parser";
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
    const apGroups: CertificationCase[][] = [];
    let pacWorkbookUploaded = false;
    let apWorkbookUploaded = false;
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const kind = certificationWorkbookKind(buffer);
        if (kind === "PAC") {
          if (pacWorkbookUploaded) throw new Error("Choose only one PAC workbook per import.");
          parsed.push(...parsePacWorkbook(buffer, file.name).pac);
          pacWorkbookUploaded = true;
        } else {
          if (apWorkbookUploaded) throw new Error("Choose only one AP workbook per import.");
          parsed.push(...parseApWorkbook(buffer, file.name));
          apWorkbookUploaded = true;
        }
      }
    }
    for (const file of files) if (file.name.toLowerCase().endsWith(".csv")) apGroups.push(parseApTemplate(await file.arrayBuffer(), file.name));
    parsed.push(...combineApTemplateCases(apGroups));
    if (!parsed.length) throw new Error("No test cases were found. Upload a PAC or AP .xlsx workbook.");
    const unique = new Map<string, CertificationCase>();
    for (const item of parsed) unique.set(item.key, item);
    const cases = markMutual([...unique.values()]);
    if (!validateCases(cases)) throw new Error("The imported test-case data is invalid.");
    let next = cases;
    if (storageConfigured()) {
      const current = await readState();
      let base = current.cases;
      if (pacWorkbookUploaded) base = base.filter(item => item.certification !== "PAC");
      if (apWorkbookUploaded) base = base.filter(item => item.certification !== "AP");
      next = mergeImportedCases(base, cases);
    }
    if (form.get("mode") === "preview") return NextResponse.json({ summary: summarize(next), files: files.map(file => file.name) });
    if (!storageConfigured()) return NextResponse.json({ error: "Connect a Vercel Blob store before applying imports." }, { status: 503 });
    await writeState(next);
    return NextResponse.json({ summary: summarize(next), files: files.map(file => file.name) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not import files." }, { status: 400 });
  }
}

function summarize(cases: CertificationCase[]) {
  const pac = cases.filter(item => item.certification === "PAC"), ap = cases.filter(item => item.certification === "AP");
  return { pacCases: pac.length, pacInScope: pac.filter(item => item.inScope).length, pacPassed: pac.filter(item => item.inScope && item.status === "Pass").length, apCases: ap.length, apInScope: ap.filter(item => item.inScope).length, apPassed: ap.filter(item => item.inScope && item.status === "Pass").length, mutual: ap.filter(item => item.isMutual).length };
}
