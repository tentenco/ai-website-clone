import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export function fail(message) {
  throw new Error(message);
}

export function assertReadableFile(filePath, label = "file") {
  const absolutePath = resolve(filePath);
  let stat;

  try {
    stat = statSync(absolutePath);
  } catch {
    fail(`${label} not found: ${absolutePath}`);
  }

  if (!stat.isFile()) {
    fail(`${label} is not a file: ${absolutePath}`);
  }

  return { absolutePath, stat };
}

export function assertDistinctPaths(sourcePath, outputPaths) {
  const source = resolve(sourcePath);

  for (const outputPath of outputPaths) {
    if (outputPath && resolve(outputPath) === source) {
      fail(`refusing to overwrite source: ${source}`);
    }
  }
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });

  if (result.error) {
    fail(`unable to run ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
    const suffix = stderr ? `\n${stderr}` : "";
    fail(`${command} exited with status ${result.status}${suffix}`);
  }

  return result;
}

export function probeRaw(videoPath) {
  const { absolutePath } = assertReadableFile(videoPath, "source video");
  const result = run("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    absolutePath,
  ]);

  try {
    return JSON.parse(result.stdout);
  } catch {
    fail("ffprobe returned invalid JSON");
  }
}

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

export function numberOrNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function integerOrNull(value) {
  const parsed = numberOrNull(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

export function writeJson(filePath, value) {
  const absolutePath = resolve(filePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return absolutePath;
}

export function valueAfter(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    fail(`${flag} requires a value`);
  }
  return value;
}

export function printError(error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`audit-motion: ${message}\n`);
}
