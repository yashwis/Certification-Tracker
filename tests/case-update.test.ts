import assert from "node:assert/strict";
import test from "node:test";
import { applyCaseUpdate, definedCaseUpdate, restoreMissingScope, selectVersionedCases } from "../lib/case-update.ts";

const original = {
  key: "PAC:TC-001",
  status: "Not Executed Yet",
  inScope: true,
  description: "Original description",
};

test("status-only update preserves in-scope state", () => {
  const updated = applyCaseUpdate(original, { status: "Pass", inScope: undefined });
  assert.equal(updated.status, "Pass");
  assert.equal(updated.inScope, true);
  assert.equal(updated.description, original.description);
});

test("status-only update preserves out-of-scope state", () => {
  const updated = applyCaseUpdate({ ...original, inScope: false }, { status: "Fail" });
  assert.equal(updated.status, "Fail");
  assert.equal(updated.inScope, false);
});

test("scope-only update preserves status", () => {
  const updated = applyCaseUpdate(original, { inScope: false, status: undefined });
  assert.equal(updated.status, "Not Executed Yet");
  assert.equal(updated.inScope, false);
});

test("combined update changes both fields", () => {
  const updated = applyCaseUpdate(original, { status: "Blocked", inScope: false });
  assert.equal(updated.status, "Blocked");
  assert.equal(updated.inScope, false);
});

test("updates do not mutate the original record", () => {
  applyCaseUpdate(original, { status: "Pass" });
  assert.equal(original.status, "Not Executed Yet");
  assert.equal(original.inScope, true);
});

test("API-style status payload omits an undefined scope field", () => {
  const update = definedCaseUpdate({ status: "Pass", inScope: undefined });
  assert.deepEqual(update, { status: "Pass" });
  assert.equal(Object.hasOwn(update, "inScope"), false);
});

test("status-only result keeps scope through JSON persistence", () => {
  const saved = JSON.parse(JSON.stringify(applyCaseUpdate(original, definedCaseUpdate({ status: "Pass" }))));
  assert.equal(saved.status, "Pass");
  assert.equal(saved.inScope, true);
});

test("previously damaged records recover their known scope", () => {
  const damaged = JSON.parse('{"key":"PAC:TC-001","status":"Pass"}');
  const [recovered] = restoreMissingScope([damaged], new Map([["PAC:TC-001", true]]));
  assert.equal(recovered.inScope, true);
});

test("scope recovery never overwrites an explicit admin scope", () => {
  const [recovered] = restoreMissingScope([{ ...original, inScope: false }], new Map([[original.key, true]]));
  assert.equal(recovered.inScope, false);
});

test("an old stored dataset is replaced once by the new workbook version", () => {
  const fallback = [{ key: "PAC:NEW" }];
  assert.deepEqual(selectVersionedCases([{ key: "PAC:OLD" }], "v2", fallback), { cases: fallback, needsMigration: true });
});

test("admin changes persist after the workbook version is current", () => {
  const cases = [{ key: "PAC:NEW", status: "Blocked" }];
  assert.deepEqual(selectVersionedCases({ version: "v2", cases }, "v2", []), { cases, needsMigration: false });
});
