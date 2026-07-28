#!/usr/bin/env node

import {
  assertDistinctPaths,
  assertReadableFile,
  integerOrNull,
  numberOrNull,
  printError,
  probeRaw,
  sha256File,
  valueAfter,
  writeJson,
} from "./lib.mjs";

function usage() {
  process.stdout.write(
    "Usage: probe-video.mjs <video> [--output <probe.json>]\n",
  );
}

function parseArgs(args) {
  let source;
  let output;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg === "--output") {
      output = valueAfter(args, index, arg);
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

  return { source, output };
}

function normalizeStream(stream) {
  const normalized = {
    index: integerOrNull(stream.index),
    type: stream.codec_type ?? null,
    codec: stream.codec_name ?? null,
    codecLongName: stream.codec_long_name ?? null,
    profile: stream.profile ?? null,
    durationSeconds: numberOrNull(stream.duration),
    bitrateBitsPerSecond: integerOrNull(stream.bit_rate),
  };

  if (stream.codec_type === "video") {
    Object.assign(normalized, {
      width: integerOrNull(stream.width),
      height: integerOrNull(stream.height),
      pixelFormat: stream.pix_fmt ?? null,
      frameRate: stream.avg_frame_rate ?? null,
      nominalFrameRate: stream.r_frame_rate ?? null,
      frameCount: integerOrNull(stream.nb_frames),
    });
  }

  if (stream.codec_type === "audio") {
    Object.assign(normalized, {
      sampleRateHertz: integerOrNull(stream.sample_rate),
      channels: integerOrNull(stream.channels),
      channelLayout: stream.channel_layout ?? null,
    });
  }

  if (stream.tags?.language) {
    normalized.language = stream.tags.language;
  }

  return normalized;
}

export async function buildProbe(sourcePath) {
  const { absolutePath, stat } = assertReadableFile(sourcePath, "source video");
  const raw = probeRaw(absolutePath);
  const streams = Array.isArray(raw.streams)
    ? raw.streams.map(normalizeStream).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    : [];

  if (!streams.some((stream) => stream.type === "video")) {
    throw new Error(`no video stream found: ${absolutePath}`);
  }

  return {
    schemaVersion: "1.0.0",
    source: {
      path: absolutePath,
      bytes: stat.size,
      sha256: await sha256File(absolutePath),
    },
    media: {
      formatName: raw.format?.format_name ?? null,
      formatLongName: raw.format?.format_long_name ?? null,
      durationSeconds: numberOrNull(raw.format?.duration),
      startSeconds: numberOrNull(raw.format?.start_time),
      bitrateBitsPerSecond: integerOrNull(raw.format?.bit_rate),
      streams,
    },
  };
}

async function main() {
  const { source, output } = parseArgs(process.argv.slice(2));
  assertDistinctPaths(source, [output]);
  const probe = await buildProbe(source);

  if (output) {
    const written = writeJson(output, probe);
    process.stdout.write(`${written}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(probe, null, 2)}\n`);
  }
}

main().catch((error) => {
  printError(error);
  process.exitCode = 1;
});
