#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  assertDistinctPaths,
  assertReadableFile,
  printError,
  run,
  valueAfter,
} from "./lib.mjs";

function usage() {
  process.stdout.write(
    [
      "Usage: video-use-timeline.mjs <video> <start> <end> --output <png> [options]",
      "  --timeline-view <path>  Explicit helpers/timeline_view.py path",
      "  --transcript <path>     Existing transcript JSON (optional)",
      "  --frames <n>             Filmstrip frame count, 1-60 (default 10)",
      "  --python <path-or-name>  Python interpreter (default python3)",
      "  --locate                 Print resolved timeline_view.py and exit",
      "  --dry-run                Print invocation as JSON without executing",
      "",
    ].join("\n"),
  );
}

function parseArgs(args) {
  const options = {
    frames: 10,
    python: "python3",
    positional: [],
    locate: false,
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg === "--locate" || arg === "--dry-run") {
      options[arg === "--locate" ? "locate" : "dryRun"] = true;
      continue;
    }

    if (
      arg === "--timeline-view"
      || arg === "--output"
      || arg === "--transcript"
      || arg === "--frames"
      || arg === "--python"
    ) {
      const value = valueAfter(args, index, arg);
      const key = {
        "--timeline-view": "timelineView",
        "--output": "output",
        "--transcript": "transcript",
        "--frames": "frames",
        "--python": "python",
      }[arg];
      options[key] = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`unknown option: ${arg}`);
    }
    options.positional.push(arg);
  }

  options.frames = Number(options.frames);
  if (!Number.isInteger(options.frames) || options.frames < 1 || options.frames > 60) {
    throw new Error("--frames must be an integer from 1 to 60");
  }

  return options;
}

function knownCandidates(explicitPath) {
  const current = process.cwd();
  const home = homedir();
  return [
    explicitPath,
    process.env.VIDEO_USE_TIMELINE_VIEW,
    join(current, ".claude", "skills", "video-use", "helpers", "timeline_view.py"),
    join(current, ".codex", "skills", "video-use", "helpers", "timeline_view.py"),
    join(home, ".claude", "skills", "video-use", "helpers", "timeline_view.py"),
    join(home, ".codex", "skills", "video-use", "helpers", "timeline_view.py"),
    join(home, "Developer", "video-use", "helpers", "timeline_view.py"),
  ].filter(Boolean);
}

export function locateTimelineView(explicitPath) {
  for (const candidate of knownCandidates(explicitPath)) {
    const absolutePath = resolve(candidate);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const stat = statSync(absolutePath);
    if (!stat.isFile() || basename(absolutePath) !== "timeline_view.py") {
      continue;
    }

    const content = readFileSync(absolutePath, "utf8");
    if (!content.includes("argparse") || !content.includes("render_timeline")) {
      continue;
    }

    return realpathSync(absolutePath);
  }

  throw new Error(
    "video-use timeline_view.py was not found; pass --timeline-view with an explicit path",
  );
}

function parseTime(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return parsed;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const timelineView = locateTimelineView(options.timelineView);

  if (options.locate) {
    process.stdout.write(`${timelineView}\n`);
    return;
  }

  const [video, startValue, endValue] = options.positional;
  if (!video || startValue === undefined || endValue === undefined) {
    throw new Error("video, start, and end are required unless --locate is used");
  }
  if (!options.output) {
    throw new Error("--output is required");
  }

  const { absolutePath: videoPath } = assertReadableFile(video, "source video");
  const start = parseTime(startValue, "start");
  const end = parseTime(endValue, "end");
  const outputPath = resolve(options.output);

  if (end <= start) {
    throw new Error("end must be greater than start");
  }
  assertDistinctPaths(videoPath, [outputPath]);

  const commandArgs = [
    timelineView,
    videoPath,
    String(start),
    String(end),
    "--output",
    outputPath,
    "--n-frames",
    String(options.frames),
  ];

  if (options.transcript) {
    const { absolutePath: transcriptPath } = assertReadableFile(
      options.transcript,
      "transcript",
    );
    commandArgs.push("--transcript", transcriptPath);
  }

  if (options.dryRun) {
    process.stdout.write(
      `${JSON.stringify({ command: options.python, args: commandArgs }, null, 2)}\n`,
    );
    return;
  }

  run(options.python, commandArgs, { stdio: "inherit" });
  assertReadableFile(outputPath, "timeline output");
  process.stdout.write(`${outputPath}\n`);
}

try {
  main();
} catch (error) {
  printError(error);
  process.exitCode = 1;
}
