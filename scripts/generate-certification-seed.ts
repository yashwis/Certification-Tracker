import fs from "node:fs";
import { combineApTemplateCases, markMutual, parseApTemplate, parsePacWorkbook, validateCases } from "../lib/source-parser.ts";

const [, , workbookPath, remitterPath, beneficiaryPath, outputPath] = process.argv;
if (!workbookPath || !remitterPath || !beneficiaryPath || !outputPath) {
  throw new Error("Usage: node --experimental-strip-types scripts/generate-certification-seed.ts <PAC.xlsx> <remitter.csv> <beneficiary.csv> <output.json>");
}

const arrayBuffer = (path: string) => {
  const buffer = fs.readFileSync(path);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
};

const pac = parsePacWorkbook(arrayBuffer(workbookPath), workbookPath.split("/").at(-1) ?? workbookPath);
const apGroups = [
  parseApTemplate(arrayBuffer(remitterPath), remitterPath.split("/").at(-1) ?? remitterPath, pac.passedApIds),
  parseApTemplate(arrayBuffer(beneficiaryPath), beneficiaryPath.split("/").at(-1) ?? beneficiaryPath, pac.passedApIds),
];
const unique = new Map([...pac.pac, ...pac.mutualAp, ...combineApTemplateCases(apGroups)].map(item => [item.key, item]));
const cases = markMutual([...unique.values()]);
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
