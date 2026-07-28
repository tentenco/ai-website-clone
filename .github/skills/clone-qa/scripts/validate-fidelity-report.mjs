#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { validateAgainstSchema } from "./lib/json-schema.mjs";
import { readJson, validateReportSemantics } from "./lib/report.mjs";

const defaultSchema = fileURLToPath(
  new URL("../../../../docs/research/schemas/fidelity-report.schema.json", import.meta.url),
);

export async function validateFidelityReport(reportPath, schemaPath = defaultSchema) {
  const [report, schema] = await Promise.all([readJson(reportPath), readJson(schemaPath)]);
  const structural = validateAgainstSchema(report, schema);
  const semanticErrors = structural.valid ? validateReportSemantics(report) : [];
  const errors = [...structural.errors, ...semanticErrors];
  return { valid: errors.length === 0, errors, report };
}

function usage() {
  return [
    "Usage: validate-fidelity-report.mjs <report.json> [--schema <schema.json>]",
    "Exit codes: 0 valid, 1 invalid report, 2 invocation or I/O error.",
  ].join("\n");
}

async function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const reportPath = argv[0];
  if (!reportPath) throw new Error(usage());
  let schemaPath = defaultSchema;
  const schemaIndex = argv.indexOf("--schema");
  if (schemaIndex >= 0) {
    if (!argv[schemaIndex + 1]) throw new Error("--schema requires a path");
    schemaPath = resolve(argv[schemaIndex + 1]);
  }
  const result = await validateFidelityReport(resolve(reportPath), schemaPath);
  if (result.valid) {
    process.stdout.write(`VALID ${reportPath}\n`);
    return 0;
  }
  process.stderr.write(`INVALID ${reportPath}\n`);
  result.errors.forEach((error) => {
    process.stderr.write(`- ${error.path}: ${error.message}\n`);
  });
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 2;
    });
}
