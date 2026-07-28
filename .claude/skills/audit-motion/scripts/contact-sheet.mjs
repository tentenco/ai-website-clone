#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  assertDistinctPaths,
  assertReadableFile,
  numberOrNull,
  printError,
  probeRaw,
  run,
  sha256File,
  valueAfter,
  writeJson,
} from "./lib.mjs";

function usage() {
  process.stdout.write(
    [
      "Usage: contact-sheet.mjs <video> --output <sheet.png> [options]",
      "  --metadata <timeline.json>  Sidecar path (default <sheet>.timeline.json)",
      "  --count <n>                 Number of samples, 1-64 (default 12)",
      "  --columns <n>               Grid columns (default 4)",
      "  --cell-width <px>           Thumbnail width, 64-1920 (default 320)",
      "",
    ].join("\n"),
  );
}

function parseInteger(value, flag, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${flag} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

function parseArgs(args) {
  const options = {
    count: 12,
    columns: 4,
    cellWidth: 320,
  };
  let source;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg === "--output" || arg === "--metadata") {
      const key = arg === "--output" ? "output" : "metadata";
      options[key] = valueAfter(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--count" || arg === "--columns" || arg === "--cell-width") {
      const value = valueAfter(args, index, arg);
      const limits = arg === "--count"
        ? [1, 64]
        : arg === "--columns"
          ? [1, 16]
          : [64, 1920];
      const key = arg === "--count"
        ? "count"
        : arg === "--columns"
          ? "columns"
          : "cellWidth";
      options[key] = parseInteger(value, arg, limits[0], limits[1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`unknown option: ${arg}`);
    }

    if (source) {
      throw new Error(`unexpected argument: ${arg}`);
    }
    source = arg;
  }

  if (!source) {
    throw new Error("source video is required");
  }
  if (!options.output) {
    throw new Error("--output is required");
  }
  if (extname(options.output).toLowerCase() !== ".png") {
    throw new Error("--output must use the .png extension");
  }
  if (options.columns > options.count) {
    options.columns = options.count;
  }
  if (!options.metadata) {
    options.metadata = `${options.output.slice(0, -4)}.timeline.json`;
  }

  return { source, ...options };
}

function sampleTimes(durationSeconds, count) {
  return Array.from(
    { length: count },
    (_, index) => ((index + 0.5) * durationSeconds) / count,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { absolutePath: sourcePath, stat } = assertReadableFile(
    options.source,
    "source video",
  );
  const outputPath = resolve(options.output);
  const metadataPath = resolve(options.metadata);
  assertDistinctPaths(sourcePath, [outputPath, metadataPath]);

  if (outputPath === metadataPath) {
    throw new Error("contact sheet and metadata paths must differ");
  }

  const raw = probeRaw(sourcePath);
  const durationSeconds = numberOrNull(raw.format?.duration);
  const videoStream = raw.streams?.find((stream) => stream.codec_type === "video");

  if (!durationSeconds || durationSeconds <= 0) {
    throw new Error("ffprobe did not report a positive video duration");
  }
  if (!videoStream?.width || !videoStream?.height) {
    throw new Error("ffprobe did not report video dimensions");
  }

  const times = sampleTimes(durationSeconds, options.count);
  const rows = Math.ceil(options.count / options.columns);
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "audit-motion-sheet-"));
  mkdirSync(dirname(outputPath), { recursive: true });

  try {
    for (const [index, seconds] of times.entries()) {
      const framePath = join(
        temporaryDirectory,
        `frame-${String(index).padStart(3, "0")}.png`,
      );
      run("ffmpeg", [
        "-v",
        "error",
        "-i",
        sourcePath,
        "-ss",
        seconds.toFixed(6),
        "-frames:v",
        "1",
        "-an",
        "-vf",
        `scale=${options.cellWidth}:-2:flags=lanczos`,
        "-compression_level",
        "9",
        "-y",
        framePath,
      ]);
    }

    run("ffmpeg", [
      "-v",
      "error",
      "-framerate",
      "1",
      "-start_number",
      "0",
      "-i",
      join(temporaryDirectory, "frame-%03d.png"),
      "-vf",
      `tile=${options.columns}x${rows}:nb_frames=${options.count}:padding=8:margin=8:color=black`,
      "-frames:v",
      "1",
      "-compression_level",
      "9",
      "-y",
      outputPath,
    ]);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }

  if (!existsSync(outputPath)) {
    throw new Error(`ffmpeg did not create contact sheet: ${outputPath}`);
  }

  const sourceHash = await sha256File(sourcePath);
  const metadata = {
    schemaVersion: "1.0.0",
    source: {
      path: sourcePath,
      bytes: stat.size,
      sha256: sourceHash,
      durationSeconds,
      width: Number(videoStream.width),
      height: Number(videoStream.height),
    },
    artifact: {
      path: outputPath,
      sha256: await sha256File(outputPath),
      columns: options.columns,
      rows,
      cellWidth: options.cellWidth,
      frames: times.map((seconds, index) => ({
        index,
        seconds: Number(seconds.toFixed(6)),
        normalizedTime: Number(((index + 0.5) / options.count).toFixed(6)),
        column: index % options.columns,
        row: Math.floor(index / options.columns),
      })),
    },
  };

  writeJson(metadataPath, metadata);
  process.stdout.write(`${outputPath}\n${metadataPath}\n`);
}

main().catch((error) => {
  printError(error);
  process.exitCode = 1;
});
