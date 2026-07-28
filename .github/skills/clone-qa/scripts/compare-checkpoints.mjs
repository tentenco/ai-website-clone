#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareCheckpointDocuments } from "./lib/checkpoints.mjs";
import { readJson } from "./lib/report.mjs";

function usage() {
  return [
    "Usage: compare-checkpoints.mjs <source.json> <clone.json> [options]",
    "Options:",
    "  --geometry-px <number>       Geometry tolerance (default 2)",
    "  --timing-ms <number>         Timing tolerance (default 100)",
    "  --scroll-progress <number>   Normalized scroll tolerance (default 0.02)",
    "  --out <path>                 Write JSON result instead of stdout",
    "Exit codes: 0 pass, 1 comparison failure, 2 invocation or I/O error.",
  ].join("\n");
}

function takeOption(argv, name, parse = (value) => value) {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  if (!argv[index + 1]) throw new Error(`${name} requires a value`);
  const value = parse(argv[index + 1]);
  argv.splice(index, 2);
  return value;
}

function finiteNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${name} must be a finite number`);
  return number;
}

async function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const geometryPx = takeOption(argv, "--geometry-px", (value) => finiteNumber(value, "--geometry-px"));
  const timingMs = takeOption(argv, "--timing-ms", (value) => finiteNumber(value, "--timing-ms"));
  const scrollProgress = takeOption(
    argv,
    "--scroll-progress",
    (value) => finiteNumber(value, "--scroll-progress"),
  );
  const outputPath = takeOption(argv, "--out", resolve);
  if (argv.length !== 2) throw new Error(usage());

  const [source, clone] = await Promise.all(argv.map((path) => readJson(resolve(path))));
  const result = compareCheckpointDocuments(source, clone, {
    geometryPx,
    timingMs,
    scrollProgress,
  });
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) await writeFile(outputPath, serialized);
  else process.stdout.write(serialized);
  return result.summary.status === "pass" ? 0 : 1;
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
