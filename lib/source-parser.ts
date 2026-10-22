import * as XLSX from "xlsx";
import { CUTOFF, type CertificationCase } from "./types";

const clean = (value: unknown) => value == null ? "" : String(value).trim();

function isoDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const raw = clean(value);
  if (!raw) return "";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[0];
  const parsed = new Date(raw);
  return Number.isNaN(parsed.valueOf()) ? "" : parsed.toISOString().slice(0, 10);
}

function baseCase(certification: "PAC" | "AP", testId: string, sourceFile: string, sortOrder: number): CertificationCase {
  return {
    key: `${certification}:${testId}`,
    certification,
    testId,
    description: "",
    status: "Not Executed Yet",
    inScope: true,
    isMutual: false,
    category: "",
    date: "",
    details: "",
    txnStatus: "",
    testSteps: "",
    responseCode: "",
    initiatedBy: "",
    flowType: "",
    expectedResult: "",
    remarks: "",
    sourceFile,
    sortOrder,
    updatedAt: new Date().toISOString(),
  };
}

export function parsePacWorkbook(buffer: ArrayBuffer, sourceFile: string) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true, cellFormula: true });
  const mainSheet = workbook.Sheets["Main Tracker"];
  const apSheet = workbook.Sheets["Our AP"];
  if (!mainSheet || !apSheet) throw new Error('PAC workbook must contain "Main Tracker" and "Our AP" sheets.');
  const main = XLSX.utils.sheet_to_json<unknown[]>(mainSheet, { header: 1, raw: true, defval: "" });
  const ap = XLSX.utils.sheet_to_json<unknown[]>(apSheet, { header: 1, raw: true, defval: "" });
  if (clean(main[1]?.[0]) !== "Date" || clean(main[1]?.[1]) !== "Test ID") throw new Error('"Main Tracker" must have Date and Test ID in row 2.');
  if (clean(ap[0]?.[0]) !== "Test Case") throw new Error('"Our AP" must have Test Case in cell A1.');

  const passedApIds = new Set(ap.slice(1).map(row => clean(row[0])).filter(Boolean));
  const pac: CertificationCase[] = [];
  const seen = new Set<string>();
  main.slice(2).forEach((row, index) => {
    const testId = clean(row[1]);
    if (!testId) return;
    if (seen.has(testId)) throw new Error(`Duplicate PAC Test ID: ${testId}`);
    seen.add(testId);
    const date = isoDate(row[0]);
    const item = {
      ...baseCase("PAC", testId, sourceFile, index + 1),
      date,
      description: clean(row[3]),
      status: clean(row[4]) || "Not Executed Yet",
      inScope: Boolean(date && date <= CUTOFF),
      category: clean(row[6]),
      details: clean(row[2]),
      initiatedBy: clean(row[8]),
      flowType: clean(row[9]),
      expectedResult: clean(row[10]),
      remarks: clean(row[12]),
    };
    pac.push(item);
  });
  if (!pac.length) throw new Error("No PAC test cases were found.");

  const mutualAp: CertificationCase[] = pac.map((source, index) => {
    const testId = source.testId;
    return {
      ...baseCase("AP", testId, sourceFile, 1000 + index),
      description: source.description,
      status: passedApIds.has(testId) ? "Pass" : "Not Executed Yet",
      inScope: source.inScope,
      isMutual: true,
      category: "Mutual PAC/AP",
      date: source.date,
      details: source.details,
      initiatedBy: source.initiatedBy,
      flowType: source.flowType,
      expectedResult: source.expectedResult,
      remarks: source.remarks,
    };
  });
  return { pac, mutualAp, passedApIds };
}

export function parseApTemplate(buffer: ArrayBuffer, sourceFile: string, passedIds = new Set<string>()) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("AP template is empty.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
  const headerIndex = rows.findIndex(row => row.some(cell => clean(cell).toUpperCase() === "TEST ID"));
  if (headerIndex < 0) throw new Error('AP template must contain a "TEST ID" column.');
  const headers = rows[headerIndex].map(value => clean(value).toUpperCase());
  const col = (names: string[]) => headers.findIndex(value => names.includes(value));
  const idCol = col(["TEST ID"]), descCol = col(["DESCRIPTION", "TEST DESCRIPTION"]);
  const detailsCol = col(["DETAILS"]), txnCol = col(["TXN STATUS"]), stepsCol = col(["TEST STEPS"]);
  const responseCol = col(["RESPONSE/ ERROR CODE", "RESPONSE / ERROR CODE"]), initiatedCol = col(["TXN INITIATED BY"]);
  const typeCol = col(["TYPE"]), commentsCol = col(["TEST COMMENTS"]);
  const category = sourceFile.toLowerCase().includes("beneficiary") ? "Beneficiary Bank" : sourceFile.toLowerCase().includes("remitter") ? "Remitter Bank" : "AP";
  const seen = new Set<string>();
  const cases: CertificationCase[] = [];
  rows.slice(headerIndex + 1).forEach((row, index) => {
    const testId = clean(row[idCol]);
    if (!testId) return;
    if (seen.has(testId)) throw new Error(`Duplicate AP Test ID in ${sourceFile}: ${testId}`);
    seen.add(testId);
    cases.push({
      ...baseCase("AP", testId, sourceFile, index + 1),
      description: descCol >= 0 ? clean(row[descCol]) : "",
      status: passedIds.has(testId) ? "Pass" : "Not Executed Yet",
      category,
      details: detailsCol >= 0 ? clean(row[detailsCol]) : "",
      txnStatus: txnCol >= 0 ? clean(row[txnCol]) : "",
      testSteps: stepsCol >= 0 ? clean(row[stepsCol]) : "",
      responseCode: responseCol >= 0 ? clean(row[responseCol]) : "",
      initiatedBy: initiatedCol >= 0 ? clean(row[initiatedCol]) : "",
      flowType: typeCol >= 0 ? clean(row[typeCol]) : "",
      remarks: commentsCol >= 0 ? clean(row[commentsCol]) : "",
    });
  });
  if (!cases.length) throw new Error(`No AP test cases found in ${sourceFile}.`);
  return cases;
}

export function markMutual(cases: CertificationCase[]) {
  const pacIds = new Set(cases.filter(item => item.certification === "PAC").map(item => item.testId));
  const apIds = new Set(cases.filter(item => item.certification === "AP").map(item => item.testId));
  return cases.map(item => ({ ...item, isMutual: pacIds.has(item.testId) && apIds.has(item.testId) }));
}

export function validateCases(value: unknown): value is CertificationCase[] {
  if (!Array.isArray(value) || !value.length) return false;
  const keys = new Set<string>();
  return value.every(item => {
    if (!item || typeof item !== "object") return false;
    const row = item as CertificationCase;
    if (!row.key || !row.testId || !["PAC", "AP"].includes(row.certification) || keys.has(row.key)) return false;
    keys.add(row.key);
    return typeof row.inScope === "boolean" && typeof row.status === "string";
  });
}
