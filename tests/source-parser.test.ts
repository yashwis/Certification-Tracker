import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { combineApTemplateCases, mergeImportedCases, missingApCatalogCategories, parseApTemplate, parsePacWorkbook, prepareForPacWorkbookRefresh } from "../lib/source-parser.ts";
import type { CertificationCase } from "../lib/types.ts";

function pacWorkbook(rows: unknown[][], passedIds: string[] = []) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["PAC certification template"],
    ["Date", "Test ID", "Details", "Description", "Status", "Reserved", "Category", "Reserved", "Initiated By", "Flow Type", "Expected Result", "Reserved", "Remarks", "In Scope"],
    ...rows,
  ]), "Main Tracker");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Test Case"], ...passedIds.map(id => [id])]), "Our AP");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function apCsv(rows: string[][]) {
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet([
    ["TEST ID", "DESCRIPTION", "DETAILS", "TXN STATUS", "TEST STEPS", "RESPONSE/ ERROR CODE", "TXN INITIATED BY", "TYPE", "TEST COMMENTS"],
    ...rows,
  ]));
  return new TextEncoder().encode(csv).buffer;
}

function caseRow(overrides: Partial<CertificationCase>): CertificationCase {
  return {
    key: "PAC:TC-NEW",
    certification: "PAC",
    testId: "TC-NEW",
    description: "New scenario",
    status: "Not Executed Yet",
    inScope: true,
    isMutual: false,
    category: "PAC",
    date: "2026-10-12",
    details: "",
    txnStatus: "",
    testSteps: "",
    responseCode: "",
    initiatedBy: "",
    flowType: "",
    expectedResult: "",
    remarks: "",
    sourceFile: "template.xlsx",
    sortOrder: 1,
    updatedAt: "2026-10-27T00:00:00.000Z",
    ...overrides,
  };
}

test("PAC scope is explicit and does not depend on the test date", () => {
  const parsed = parsePacWorkbook(pacWorkbook([
    ["2026-10-12", "TC-IN", "", "In-scope case"],
    ["2026-10-13", "TC-LATER", "", "Later in-scope case"],
    ["2026-10-10", "TC-OUT", "", "Explicitly excluded case", "Not Executed Yet", "", "", "", "", "", "", "", "", "No"],
  ]), "PAC-Certification-Template.xlsx");

  assert.equal(parsed.pac.length, 3);
  assert.equal(parsed.mutualAp.length, 3);
  assert.equal(parsed.pac[0].inScope, true);
  assert.equal(parsed.mutualAp[0].inScope, true);
  assert.equal(parsed.pac[1].inScope, true);
  assert.equal(parsed.mutualAp[1].inScope, true);
  assert.equal(parsed.pac[2].inScope, false);
  assert.equal(parsed.mutualAp[2].inScope, false);
  assert.equal(parsed.pac[0].status, "Not Executed Yet");
  assert.equal(parsed.mutualAp[0].isMutual, true);
});

test("invalid explicit scope values are rejected", () => {
  assert.throws(
    () => parsePacWorkbook(pacWorkbook([["2026-10-13", "TC-BAD", "", "Bad scope", "Not Executed Yet", "", "", "", "", "", "", "", "", "Maybe"]]), "PAC.xlsx"),
    /Invalid In Scope value for TC-BAD/,
  );
});

test("a new AP row gets the correct defaults and category", () => {
  const [created] = parseApTemplate(apCsv([["AP-NEW", "New remitter case"]]), "AP-Remitter-Bank-Template.csv");
  assert.equal(created.key, "AP:AP-NEW");
  assert.equal(created.certification, "AP");
  assert.equal(created.category, "Remitter Bank");
  assert.equal(created.status, "Not Executed Yet");
  assert.equal(created.inScope, true);
  assert.equal(created.isMutual, false);
});

test("a misspelled Beneficary filename is classified as Beneficiary Bank", () => {
  const [created] = parseApTemplate(apCsv([["BE_01", "Beneficiary case"]]), "Niubiz Certification Tracker - AP-Beneficary.csv");
  assert.equal(created.category, "Beneficiary Bank");
});

test("BE and RE test IDs classify renamed AP files", () => {
  const [beneficiary] = parseApTemplate(apCsv([["BE_01", "Beneficiary case"]]), "ap-cases.csv");
  const [remitter] = parseApTemplate(apCsv([["RE_01", "Remitter case"]]), "ap-cases.csv");
  assert.equal(beneficiary.category, "Beneficiary Bank");
  assert.equal(remitter.category, "Remitter Bank");
});

test("a new AP row matching an existing PAC row marks both as mutual", () => {
  const pac = caseRow({ status: "Pass", inScope: true });
  const ap = caseRow({ key: "AP:TC-NEW", certification: "AP", category: "Remitter Bank", status: "Not Executed Yet" });
  const merged = mergeImportedCases([pac], [ap]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find(item => item.key === pac.key)?.isMutual, true);
  assert.equal(merged.find(item => item.key === ap.key)?.isMutual, true);
  assert.equal(merged.find(item => item.key === pac.key)?.status, "Pass");
});

test("re-importing a row uses the uploaded status and scope", () => {
  const current = caseRow({ key: "AP:AP-NEW", certification: "AP", status: "Blocked", inScope: false });
  const imported = caseRow({ key: "AP:AP-NEW", certification: "AP", status: "Not Executed Yet", inScope: true, description: "Updated description" });
  const [merged] = mergeImportedCases([current], [imported]);
  assert.equal(merged.status, "Not Executed Yet");
  assert.equal(merged.inScope, true);
  assert.equal(merged.description, "Updated description");
});

test("PAC workbook refresh removes stale PAC rows and refreshes AP-only successes", () => {
  const current = [
    caseRow({ key: "PAC:OLD", testId: "OLD" }),
    caseRow({ key: "AP:OLD", certification: "AP", testId: "OLD", category: "Mutual PAC/AP" }),
    caseRow({ key: "AP:RE_01", certification: "AP", testId: "RE_01", category: "Remitter Bank", status: "Pass", inScope: false }),
    caseRow({ key: "AP:BE_01", certification: "AP", testId: "BE_01", category: "Beneficiary Bank", status: "Blocked", inScope: false }),
  ];
  const prepared = prepareForPacWorkbookRefresh(current, new Set(["BE_01"]));
  assert.equal(prepared.length, 2);
  assert.equal(prepared.find(item => item.testId === "RE_01")?.status, "Not Executed Yet");
  assert.equal(prepared.find(item => item.testId === "BE_01")?.status, "Pass");
  assert.equal(prepared.every(item => item.inScope), true);
});

test("adding one row leaves unrelated existing rows unchanged", () => {
  const existing = caseRow({ key: "PAC:EXISTING", testId: "EXISTING", status: "Fail" });
  const added = caseRow({ key: "AP:ADDED", certification: "AP", testId: "ADDED" });
  const merged = mergeImportedCases([existing], [added]);
  assert.deepEqual(merged.find(item => item.key === existing.key), existing);
  assert.equal(merged.find(item => item.key === added.key)?.status, "Not Executed Yet");
});

test("duplicate IDs across AP templates are rejected instead of overwritten", () => {
  const remitter = parseApTemplate(apCsv([["AP-DUP", "Remitter scenario"]]), "AP-Remitter-Bank-Template.csv");
  const beneficiary = parseApTemplate(apCsv([["AP-DUP", "Beneficiary scenario"]]), "AP-Beneficiary-Bank-Template.csv");
  assert.throws(
    () => combineApTemplateCases([remitter, beneficiary]),
    /Duplicate AP Test ID AP-DUP across AP-Remitter-Bank-Template.csv and AP-Beneficiary-Bank-Template.csv/,
  );
});

test("a first PAC refresh identifies missing AP catalog files", () => {
  const pacOnly = [caseRow({}), caseRow({ key: "AP:TC-NEW", certification: "AP", category: "Mutual PAC/AP" })];
  assert.deepEqual(missingApCatalogCategories([], pacOnly), ["Remitter Bank", "Beneficiary Bank"]);

  const remitter = caseRow({ key: "AP:RE_01", certification: "AP", testId: "RE_01", category: "Remitter Bank" });
  assert.deepEqual(missingApCatalogCategories([], [...pacOnly, remitter]), ["Beneficiary Bank"]);

  const beneficiary = caseRow({ key: "AP:BE_01", certification: "AP", testId: "BE_01", category: "Beneficiary Bank" });
  assert.deepEqual(missingApCatalogCategories([remitter], [...pacOnly, beneficiary]), []);
});
