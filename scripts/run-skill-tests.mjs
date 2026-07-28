#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const skillRoot = join(root, ".claude", "skills");

function findTests(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  const tests = [];

  for (const entry of readdirSync(directory).sort()) {
    const absolutePath = join(directory, entry);

    if (statSync(absolutePath).isDirectory()) {
      tests.push(...findTests(absolutePath));
    } else if (entry.endsWith(".test.mjs")) {
      tests.push(absolutePath);
    }
  }

  return tests;
}

const tests = findTests(skillRoot);

if (tests.length === 0) {
  console.error("No skill tests found under .claude/skills.");
  process.exit(1);
}

console.log(`Running ${tests.length} skill test files:`);
tests.forEach((test) => console.log(`  - ${relative(root, test)}`));

const result = spawnSync(process.execPath, ["--test", ...tests], {
  cwd: root,
  encoding: "utf8",
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
