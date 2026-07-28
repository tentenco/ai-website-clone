#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readJson, summarizeReport } from "./lib/report.mjs";
import { validateFidelityReport } from "./validate-fidelity-report.mjs";

export async function summarizeFiles(paths) {
  const reports = [];
  for (const path of paths) {
    const report = await readJson(path);
    reports.push({ path, ...summarizeReport(report) });
  }
  const counts = reports.reduce(
    (total, report) => ({
      pass: total.pass + report.counts.pass,
      fail: total.fail + report.counts.fail,
      blocked: total.blocked + report.counts.blocked,
    }),
    { pass: 0, fail: 0, blocked: 0 },
  );
  const derivedStatus = reports.some((report) => report.derivedStatus === "fail")
    ? "fail"
    : reports.some((report) => report.derivedStatus === "blocked")
      ? "blocked"
      : "pass";
  return {
    status: derivedStatus,
    counts,
    consistent: reports.every((report) => report.consistent),
    reports,
  };
}

function usage() {
  return [
    "Usage: summarize-gates.mjs <report.json> [<report.json> ...] [--out <summary.json>]",
    "Exit codes: 0 all pass and consistent, 1 fail/blocked/inconsistent, 2 invocation or I/O error.",
  ].join("\n");
}

async function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const outputIndex = argv.indexOf("--out");
  let outputPath = null;
  if (outputIndex >= 0) {
    if (!argv[outputIndex + 1]) throw new Error("--out requires a path");
    outputPath = resolve(argv[outputIndex + 1]);
    argv.splice(outputIndex, 2);
  }
  if (argv.length === 0) throw new Error(usage());
  const reportPaths = argv.map((path) => resolve(path));
  for (const reportPath of reportPaths) {
    const validation = await validateFidelityReport(reportPath);
    if (!validation.valid) {
      const details = validation.errors
        .map((error) => `${error.path}: ${error.message}`)
        .join("; ");
      throw new Error(`Invalid fidelity report ${reportPath}: ${details}`);
    }
  }
  const summary = await summarizeFiles(reportPaths);
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;
  if (outputPath) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(outputPath, serialized);
  } else {
    process.stdout.write(serialized);
  }
  return summary.status === "pass" && summary.consistent ? 0 : 1;
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
