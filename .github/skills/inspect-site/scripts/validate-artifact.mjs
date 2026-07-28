#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import {
  detectArtifactKind,
  formatErrors,
  validateCapture,
  validateCaptureScenarios,
  validateSiteInspection
} from "./lib/artifacts.mjs";

const validators = {
  capture: validateCapture,
  "capture-scenarios": validateCaptureScenarios,
  "site-inspection": validateSiteInspection
};

function usage() {
  return [
    "Usage: node validate-artifact.mjs [--kind auto|capture|capture-scenarios|site-inspection] <file> [...]",
    "Validates inspect-site JSON without external npm dependencies."
  ].join("\n");
}

const argumentsList = process.argv.slice(2);
let kind = "auto";
const files = [];
for (let index = 0; index < argumentsList.length; index += 1) {
  const argument = argumentsList[index];
  if (argument === "--kind") {
    kind = argumentsList[index + 1] ?? "";
    index += 1;
  } else if (argument === "--help" || argument === "-h") {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  } else {
    files.push(argument);
  }
}

if (!["auto", ...Object.keys(validators)].includes(kind) || files.length === 0) {
  process.stderr.write(`${usage()}\n`);
  process.exit(2);
}

let failed = false;
for (const file of files) {
  let artifact;
  try {
    artifact = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    failed = true;
    process.stderr.write(`${file}: ${error.message}\n`);
    continue;
  }
  const detectedKind = kind === "auto" ? detectArtifactKind(artifact) : kind;
  if (!detectedKind) {
    failed = true;
    process.stderr.write(`${file}: could not detect artifact kind\n`);
    continue;
  }
  const result = validators[detectedKind](artifact);
  if (!result.valid) {
    failed = true;
    process.stderr.write(`${file} (${detectedKind}): invalid\n${formatErrors(result.errors)}\n`);
  } else {
    process.stdout.write(`${file} (${detectedKind}): valid\n`);
  }
}

process.exit(failed ? 1 : 0);
