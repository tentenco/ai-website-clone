#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const args = process.argv.slice(2);
const target = args[0];

function option(name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}

const mode = option("--mode", "clone");
const sourceUrl = option("--url", "");
const dryRun = args.includes("--dry-run");
const knownOptions = new Set(["--mode", "--url", "--dry-run"]);

for (let index = 1; index < args.length; index += 1) {
  const value = args[index];

  if (value === "--dry-run") {
    continue;
  }

  if (!knownOptions.has(value)) {
    console.error(`Unknown argument: ${value}`);
    process.exit(2);
  }

  if (value === "--mode" || value === "--url") {
    index += 1;

    if (index >= args.length) {
      console.error(`Missing value for ${value}`);
      process.exit(2);
    }
  }
}

if (!target || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(target)) {
  console.error(
    "Usage: node scripts/init-clone-target.mjs <target-slug> " +
      "[--mode clone|adapt|blend] [--url https://example.com] [--dry-run]",
  );
  process.exit(2);
}

if (!["clone", "adapt", "blend"].includes(mode)) {
  console.error(`Invalid mode: ${mode}`);
  process.exit(2);
}

if (sourceUrl) {
  try {
    const parsed = new URL(sourceUrl);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("URL must use http or https");
    }
  } catch (error) {
    console.error(
      `Invalid --url: ${error instanceof Error ? error.message : error}`,
    );
    process.exit(2);
  }
}

const researchDirectory = join(root, "docs", "research", target);
const referencesDirectory = join(root, "docs", "design-references", target);
const templateDirectory = join(root, "docs", "research", "templates");
const operations = [
  { type: "directory", path: researchDirectory },
  { type: "directory", path: join(researchDirectory, "components") },
  { type: "directory", path: join(researchDirectory, "qa") },
  { type: "directory", path: referencesDirectory },
  {
    type: "file",
    path: join(researchDirectory, "CLONE_CONTRACT.md"),
    template: join(templateDirectory, "CLONE_CONTRACT.md"),
    transform(content) {
      return content
        .replace("- Target:", `- Target: ${sourceUrl || target}`)
        .replace("- Mode: `clone`", `- Mode: \`${mode}\``);
    },
  },
];

if (mode !== "clone") {
  operations.push({
    type: "file",
    path: join(researchDirectory, "REFERENCE_LEDGER.md"),
    template: join(templateDirectory, "REFERENCE_LEDGER.md"),
    transform(content) {
      return content.replaceAll("`clone`", `\`${mode}\``);
    },
  });
}

for (const operation of operations) {
  const relativePath = operation.path.slice(root.length + 1);

  if (existsSync(operation.path)) {
    console.log(`keep   ${relativePath}`);
    continue;
  }

  if (dryRun) {
    console.log(`create ${relativePath}`);
    continue;
  }

  if (operation.type === "directory") {
    mkdirSync(operation.path, { recursive: true });
  } else {
    mkdirSync(join(operation.path, ".."), { recursive: true });
    const template = readFileSync(operation.template, "utf8");
    writeFileSync(operation.path, operation.transform(template), "utf8");
  }

  console.log(`create ${relativePath}`);
}

console.log(
  dryRun
    ? `Dry run complete for ${target}.`
    : `Initialized ${target} in ${mode} mode.`,
);
