import fs from "node:fs";
import { markMutual, parseApWorkbook, parsePacWorkbook, validateCases } from "../lib/source-parser.ts";

const [, , pacWorkbookPath, apWorkbookPath, outputPath] = process.argv;
if (!pacWorkbookPath || !apWorkbookPath || !outputPath) {
  throw new Error("Usage: node --experimental-strip-types scripts/generate-certification-seed.ts <PAC.xlsx> <AP.xlsx> <output.json>");
}

const arrayBuffer = (path: string) => {
  const buffer = fs.readFileSync(path);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
};

const pac = parsePacWorkbook(arrayBuffer(pacWorkbookPath), pacWorkbookPath.split("/").at(-1) ?? pacWorkbookPath).pac;
const ap = parseApWorkbook(arrayBuffer(apWorkbookPath), apWorkbookPath.split("/").at(-1) ?? apWorkbookPath);
const cases = markMutual([...pac, ...ap]);
if (!validateCases(cases)) throw new Error("Generated certification data is invalid.");
fs.writeFileSync(outputPath, `${JSON.stringify(cases, null, 2)}\n`);

const summary = {
  pac: cases.filter(item => item.certification === "PAC").length,
  pacInScope: cases.filter(item => item.certification === "PAC" && item.inScope).length,
  pacPass: cases.filter(item => item.certification === "PAC" && item.status === "Pass").length,
  ap: cases.filter(item => item.certification === "AP").length,
  apInScope: cases.filter(item => item.certification === "AP" && item.inScope).length,
  apPass: cases.filter(item => item.certification === "AP" && item.status === "Pass").length,
};
console.log(JSON.stringify(summary));
