#!/usr/bin/env node

import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const jsonOutput = process.argv.includes("--json");
const requireMotion = process.argv.includes("--require-motion");
const unsupportedArgs = process.argv
  .slice(2)
  .filter((arg) => !["--json", "--require-motion"].includes(arg));

if (unsupportedArgs.length > 0) {
  console.error(`Unknown argument(s): ${unsupportedArgs.join(", ")}`);
  process.exit(2);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
  });

  return {
    available: !result.error && result.status === 0,
    status: result.status,
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
    error: result.error?.message,
  };
}

function commandCheck(name, args, required, note) {
  const result = run(name, args);

  return {
    id: name,
    status: result.available ? "pass" : required ? "fail" : "warn",
    required,
    detail:
      result.stdout.split("\n")[0] ||
      result.stderr.split("\n")[0] ||
      result.error ||
      `${name} unavailable`,
    note,
  };
}

const checks = [];
const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);

checks.push({
  id: "node",
  status: nodeMajor >= 24 ? "pass" : "fail",
  required: true,
  detail: process.version,
  note: "Node.js 24 or newer is required by the template.",
});

const gitResult = run("git", ["rev-parse", "--is-inside-work-tree"]);
checks.push({
  id: "git-worktree",
  status: gitResult.available && gitResult.stdout === "true" ? "pass" : "fail",
  required: true,
  detail: gitResult.available ? gitResult.stdout : gitResult.error ?? gitResult.stderr,
  note: "Agent Harness execution requires a Git worktree.",
});

for (const skillName of [
  "clone-website",
  "inspect-site",
  "audit-motion",
  "clone-qa",
  "blend-references",
]) {
  const relativePath = `.claude/skills/${skillName}/SKILL.md`;
  const available = existsSync(join(root, relativePath));
  checks.push({
    id: `skill:${skillName}`,
    status: available ? "pass" : "fail",
    required: true,
    detail: relativePath,
    note: "Canonical source skill.",
  });
}

const syncResult = run(process.execPath, [
  join(root, "scripts", "sync-skills.mjs"),
  "--check",
]);
checks.push({
  id: "skill-sync",
  status: syncResult.available ? "pass" : "fail",
  required: true,
  detail:
    syncResult.stdout.split("\n").at(-1) ||
    syncResult.stderr.split("\n")[0] ||
    syncResult.error ||
    "skill sync check failed",
  note: "Generated platform skills must match .claude/skills.",
});

checks.push(
  commandCheck(
    "agent-browser",
    ["--version"],
    false,
    "Preferred browser CLI. A connected browser tool may be used instead.",
  ),
);
checks.push(
  commandCheck(
    "ffmpeg",
    ["-version"],
    requireMotion,
    "Required when motion or video analysis is in scope.",
  ),
);
checks.push(
  commandCheck(
    "ffprobe",
    ["-version"],
    requireMotion,
    "Required when motion or video analysis is in scope.",
  ),
);

const failed = checks.filter((check) => check.status === "fail");
const report = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  root,
  requireMotion,
  status: failed.length === 0 ? "pass" : "fail",
  checks,
};

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Clone preflight: ${report.status.toUpperCase()}`);

  for (const check of checks) {
    console.log(
      `${check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "✗"} ` +
        `${check.id}: ${check.detail}`,
    );
  }
}

process.exit(failed.length === 0 ? 0 : 1);
