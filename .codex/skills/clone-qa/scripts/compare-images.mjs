#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareImages } from "./lib/image-diff.mjs";
import { readJson } from "./lib/report.mjs";

function usage() {
  return [
    "Usage: compare-images.mjs <source-image> <clone-image> --threshold <0..1> [options]",
    "Options:",
    "  --adapter <auto|imagemagick|ffmpeg>  Adapter selection (default auto)",
    "  --masks <mask-contract.json>          Dynamic-region mask contract",
    "  --diff <diff.png>                     Write a masked visual diff",
    "  --out <result.json>                    Write result JSON instead of stdout",
    "Exit codes: 0 pass, 1 fail/blocked, 2 invocation, adapter, or I/O error.",
  ].join("\n");
}

function takeOption(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  if (!argv[index + 1]) throw new Error(`${name} requires a value`);
  const value = argv[index + 1];
  argv.splice(index, 2);
  return value;
}

async function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const thresholdText = takeOption(argv, "--threshold");
  const adapter = takeOption(argv, "--adapter") ?? "auto";
  const masksPath = takeOption(argv, "--masks");
  const diffPath = takeOption(argv, "--diff");
  const outputPath = takeOption(argv, "--out");
  if (argv.length !== 2 || thresholdText === undefined) throw new Error(usage());
  const threshold = Number(thresholdText);
  const maskContract = masksPath ? await readJson(resolve(masksPath)) : null;
  const result = await compareImages({
    sourcePath: resolve(argv[0]),
    clonePath: resolve(argv[1]),
    threshold,
    adapter,
    maskContract,
    diffPath: diffPath ? resolve(diffPath) : null,
  });
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) await writeFile(resolve(outputPath), serialized);
  else process.stdout.write(serialized);
  return result.status === "pass" ? 0 : 1;
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
