#!/usr/bin/env node

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { mergeSiteInspection } from "./lib/artifacts.mjs";

function usage() {
  return [
    "Usage: node merge-site-inspection.mjs --target <slug> --output <site-inspection.json> <capture.json> [...]",
    "Replaces a prior capture with the same scenario/source/viewport key and writes atomically."
  ].join("\n");
}

const argumentsList = process.argv.slice(2);
let target = "";
let output = "";
const capturePaths = [];
for (let index = 0; index < argumentsList.length; index += 1) {
  const argument = argumentsList[index];
  if (argument === "--target") {
    target = argumentsList[index + 1] ?? "";
    index += 1;
  } else if (argument === "--output") {
    output = argumentsList[index + 1] ?? "";
    index += 1;
  } else if (argument === "--help" || argument === "-h") {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  } else {
    capturePaths.push(argument);
  }
}

if (!target || !output || capturePaths.length === 0) {
  process.stderr.write(`${usage()}\n`);
  process.exit(2);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

let existing = null;
try {
  existing = await readJson(output);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const incoming = await Promise.all(capturePaths.map(readJson));
const merged = mergeSiteInspection(existing, target, incoming);
const absoluteOutput = resolve(output);
const outputDirectory = dirname(absoluteOutput);
const temporaryOutput = `${absoluteOutput}.tmp-${process.pid}`;
await mkdir(outputDirectory, { recursive: true });
await writeFile(temporaryOutput, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
await rename(temporaryOutput, absoluteOutput);
process.stdout.write(
  `${output}: wrote ${merged.captures.length} capture(s) for target ${merged.target}\n`
);
