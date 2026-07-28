import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer,
  });
  if (result.error) throw new Error(`${command} failed: ${result.error.message}`);
  if (result.status !== 0) {
    const stderr = typeof result.stderr === "string"
      ? result.stderr.trim()
      : result.stderr?.toString("utf8").trim();
    throw new Error(`${command} exited ${result.status}${stderr ? `: ${stderr}` : ""}`);
  }
  return result;
}

export function adapterAvailable(adapter) {
  const command = adapter === "imagemagick" ? "magick" : adapter;
  return spawnSync(command, ["-version"], { encoding: "utf8" }).status === 0;
}

function parseDimensions(text, label) {
  const match = text.trim().match(/^(\d+)\s+(\d+)$/);
  if (!match) throw new Error(`Cannot determine ${label} dimensions from ${JSON.stringify(text)}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function imageMagickDimensions(path) {
  return parseDimensions(
    run("magick", ["identify", "-format", "%w %h", path]).stdout,
    path,
  );
}

function ffmpegDimensions(path) {
  const result = run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    path,
  ]);
  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new Error(`ffprobe returned malformed JSON for ${path}`);
  }
  const stream = payload.streams?.[0];
  if (!Number.isInteger(stream?.width) || !Number.isInteger(stream?.height)) {
    throw new Error(`Cannot determine ${path} dimensions with ffprobe`);
  }
  return { width: stream.width, height: stream.height };
}

function assertRect(rect, label) {
  for (const key of ["x", "y", "width", "height"]) {
    if (typeof rect?.[key] !== "number" || !Number.isFinite(rect[key])) {
      throw new Error(`${label}.${key} must be a finite number`);
    }
  }
  if (rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0) {
    throw new Error(`${label} must have non-negative origin and positive size`);
  }
}

function stablePixelEdge(value, size, direction) {
  const scaled = value * size;
  const nearest = Math.round(scaled);
  const slack = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  if (Math.abs(scaled - nearest) <= slack) return nearest;
  return direction === "start" ? Math.floor(scaled) : Math.ceil(scaled);
}

export function resolveMaskRegions(contract, dimensions) {
  if (!contract) return [];
  if (contract.schemaVersion !== "1.0.0") {
    throw new Error("mask contract schemaVersion must be 1.0.0");
  }
  if (!Array.isArray(contract.regions)) {
    throw new Error("mask contract must contain a regions array");
  }
  const dynamicKinds = new Set([
    "animation",
    "cursor",
    "live-media",
    "network-content",
    "personalized",
    "timestamp",
    "other",
  ]);
  const ids = new Set();
  return contract.regions.map((region, index) => {
    const label = `regions[${index}]`;
    if (!region || typeof region.id !== "string" || !region.id) {
      throw new Error(`${label}.id must be a non-empty string`);
    }
    if (ids.has(region.id)) throw new Error(`duplicate mask region id ${region.id}`);
    ids.add(region.id);
    if (!["exclude", "separate-review"].includes(region.treatment)) {
      throw new Error(`${label}.treatment must be exclude or separate-review`);
    }
    if (!dynamicKinds.has(region.dynamicKind)) {
      throw new Error(`${label}.dynamicKind is not recognized`);
    }
    if (typeof region.reason !== "string" || !region.reason) {
      throw new Error(`${label}.reason must explain why pixels are not directly comparable`);
    }
    if (
      !Array.isArray(region.evidenceIds)
      || region.evidenceIds.length === 0
      || region.evidenceIds.some((id) => typeof id !== "string" || !id)
      || new Set(region.evidenceIds).size !== region.evidenceIds.length
    ) {
      throw new Error(`${label}.evidenceIds must contain unique non-empty strings`);
    }
    if (region.review) {
      if (!["pass", "fail", "blocked"].includes(region.review.status)) {
        throw new Error(`${label}.review.status must be pass, fail, or blocked`);
      }
      if (
        typeof region.review.notes !== "string"
        || !region.review.notes
        || typeof region.review.evidenceArtifact !== "string"
        || !region.review.evidenceArtifact
      ) {
        throw new Error(`${label}.review requires notes and evidenceArtifact`);
      }
    }
    assertRect(region.geometry, `${label}.geometry`);
    let x;
    let y;
    let right;
    let bottom;
    if (region.coordinateSpace === "normalized") {
      if (
        region.geometry.x > 1
        || region.geometry.y > 1
        || region.geometry.width > 1
        || region.geometry.height > 1
      ) {
        throw new Error(`${label} normalized coordinates must be <= 1`);
      }
      x = stablePixelEdge(region.geometry.x, dimensions.width, "start");
      y = stablePixelEdge(region.geometry.y, dimensions.height, "start");
      right = stablePixelEdge(
        region.geometry.x + region.geometry.width,
        dimensions.width,
        "end",
      );
      bottom = stablePixelEdge(
        region.geometry.y + region.geometry.height,
        dimensions.height,
        "end",
      );
    } else if (region.coordinateSpace === "image-pixel") {
      x = Math.floor(region.geometry.x);
      y = Math.floor(region.geometry.y);
      right = Math.ceil(region.geometry.x + region.geometry.width);
      bottom = Math.ceil(region.geometry.y + region.geometry.height);
    } else {
      throw new Error(`${label}.coordinateSpace must be image-pixel or normalized`);
    }
    if (right > dimensions.width || bottom > dimensions.height) {
      throw new Error(`${label} extends outside ${dimensions.width}x${dimensions.height} image`);
    }
    return {
      ...region,
      x,
      y,
      width: right - x,
      height: bottom - y,
      right,
      bottom,
    };
  });
}

export function buildRowIntervals(dimensions, regions) {
  const rows = Array.from({ length: dimensions.height }, () => []);
  for (const region of regions) {
    for (let y = region.y; y < region.bottom; y += 1) {
      rows[y].push([region.x, region.right]);
    }
  }
  let excludedPixels = 0;
  for (let y = 0; y < rows.length; y += 1) {
    const merged = [];
    for (const interval of rows[y].sort((left, right) => left[0] - right[0])) {
      const previous = merged.at(-1);
      if (!previous || interval[0] > previous[1]) merged.push([...interval]);
      else previous[1] = Math.max(previous[1], interval[1]);
    }
    rows[y] = merged;
    excludedPixels += merged.reduce((sum, [start, end]) => sum + end - start, 0);
  }
  return { rows, excludedPixels };
}

function reviewStatus(regions) {
  const separate = regions.filter((region) => region.treatment === "separate-review");
  if (separate.some((region) => region.review?.status === "fail")) return "fail";
  if (separate.some((region) => !region.review || region.review.status === "blocked")) {
    return "blocked";
  }
  return "pass";
}

function drawArguments(regions) {
  return regions.map(
    (region) => `rectangle ${region.x},${region.y} ${region.right - 1},${region.bottom - 1}`,
  );
}

async function compareWithImageMagick(sourcePath, clonePath, dimensions, regions, diffPath) {
  const temporary = await mkdtemp(join(tmpdir(), "clone-qa-image-"));
  try {
    const differencePath = join(temporary, "difference.png");
    const maskedPath = join(temporary, "difference-masked.png");
    run("magick", [
      sourcePath,
      clonePath,
      "-alpha",
      "off",
      "-compose",
      "difference",
      "-composite",
      differencePath,
    ]);
    let metricPath = differencePath;
    if (regions.length > 0) {
      const maskPath = join(temporary, "mask.png");
      const args = [
        "-size",
        `${dimensions.width}x${dimensions.height}`,
        "xc:white",
        "-fill",
        "black",
      ];
      for (const drawing of drawArguments(regions)) args.push("-draw", drawing);
      args.push(maskPath);
      run("magick", args);
      run("magick", [
        differencePath,
        maskPath,
        "-compose",
        "Multiply",
        "-composite",
        maskedPath,
      ]);
      metricPath = maskedPath;
    }
    const rawMean = Number(
      run("magick", [metricPath, "-format", "%[fx:mean]", "info:"]).stdout.trim(),
    );
    if (!Number.isFinite(rawMean)) throw new Error("ImageMagick returned a non-numeric metric");
    if (diffPath) await copyFile(metricPath, diffPath);
    return rawMean;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

function isExcluded(intervals, x) {
  return intervals.some(([start, end]) => x >= start && x < end);
}

function ffmpegFilter(regions) {
  const boxes = regions.map(
    (region) => [
      "drawbox",
      `x=${region.x}`,
      `y=${region.y}`,
      `w=${region.width}`,
      `h=${region.height}`,
      "color=black",
      "t=fill",
    ].join(":"),
  );
  return ["[0:v][1:v]blend=all_mode=difference", "format=rgb24", ...boxes].join(",");
}

function compareWithFfmpeg(sourcePath, clonePath, dimensions, rows, regions, diffPath) {
  const expectedBytes = dimensions.width * dimensions.height * 3;
  const result = run("ffmpeg", [
    "-v",
    "error",
    "-i",
    sourcePath,
    "-i",
    clonePath,
    "-filter_complex",
    ffmpegFilter([]),
    "-frames:v",
    "1",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    "pipe:1",
  ], { encoding: "buffer", maxBuffer: expectedBytes + 1024 * 1024 });
  if (result.stdout.length !== expectedBytes) {
    throw new Error(`ffmpeg returned ${result.stdout.length} bytes; expected ${expectedBytes}`);
  }
  let channelSum = 0;
  let comparablePixels = 0;
  for (let y = 0; y < dimensions.height; y += 1) {
    for (let x = 0; x < dimensions.width; x += 1) {
      if (isExcluded(rows[y], x)) continue;
      const offset = (y * dimensions.width + x) * 3;
      channelSum += result.stdout[offset] + result.stdout[offset + 1] + result.stdout[offset + 2];
      comparablePixels += 1;
    }
  }
  if (diffPath) {
    run("ffmpeg", [
      "-v",
      "error",
      "-i",
      sourcePath,
      "-i",
      clonePath,
      "-filter_complex",
      ffmpegFilter(regions),
      "-frames:v",
      "1",
      "-y",
      diffPath,
    ]);
  }
  return channelSum / (comparablePixels * 3 * 255);
}

export async function compareImages({
  sourcePath,
  clonePath,
  threshold,
  adapter = "auto",
  maskContract = null,
  diffPath = null,
}) {
  if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold < 0) {
    throw new Error("threshold must be a finite non-negative number");
  }
  if (threshold > 1) throw new Error("threshold must be <= 1");
  if (!["auto", "imagemagick", "ffmpeg"].includes(adapter)) {
    throw new Error("adapter must be auto, imagemagick, or ffmpeg");
  }
  let selected = adapter;
  if (selected === "auto") {
    if (adapterAvailable("imagemagick")) selected = "imagemagick";
    else if (adapterAvailable("ffmpeg") && adapterAvailable("ffprobe")) selected = "ffmpeg";
    else throw new Error("No supported image adapter found (ImageMagick or ffmpeg + ffprobe)");
  }
  if (selected === "imagemagick" && !adapterAvailable("imagemagick")) {
    throw new Error("ImageMagick adapter requested but magick is unavailable");
  }
  if (
    selected === "ffmpeg"
    && (!adapterAvailable("ffmpeg") || !adapterAvailable("ffprobe"))
  ) {
    throw new Error("ffmpeg adapter requires both ffmpeg and ffprobe");
  }

  const dimensionsFor = selected === "imagemagick" ? imageMagickDimensions : ffmpegDimensions;
  const sourceDimensions = dimensionsFor(sourcePath);
  const cloneDimensions = dimensionsFor(clonePath);
  if (
    sourceDimensions.width !== cloneDimensions.width
    || sourceDimensions.height !== cloneDimensions.height
  ) {
    throw new Error(
      `Image dimensions differ: source ${sourceDimensions.width}x${sourceDimensions.height}, `
      + `clone ${cloneDimensions.width}x${cloneDimensions.height}`,
    );
  }
  const regions = resolveMaskRegions(maskContract, sourceDimensions);
  const { rows, excludedPixels } = buildRowIntervals(sourceDimensions, regions);
  const totalPixels = sourceDimensions.width * sourceDimensions.height;
  const comparablePixels = totalPixels - excludedPixels;
  if (comparablePixels < 1) throw new Error("Masks exclude every pixel; no comparison is possible");

  let rawMean;
  if (selected === "imagemagick") {
    rawMean = await compareWithImageMagick(
      sourcePath,
      clonePath,
      sourceDimensions,
      regions,
      diffPath,
    );
    rawMean = rawMean * totalPixels / comparablePixels;
  } else {
    rawMean = compareWithFfmpeg(
      sourcePath,
      clonePath,
      sourceDimensions,
      rows,
      regions,
      diffPath,
    );
  }
  const dynamicReviewStatus = reviewStatus(regions);
  const numericStatus = rawMean <= threshold ? "pass" : "fail";
  const status = numericStatus === "fail" || dynamicReviewStatus === "fail"
    ? "fail"
    : dynamicReviewStatus === "blocked"
      ? "blocked"
      : "pass";
  return {
    adapter: selected,
    dimensions: sourceDimensions,
    metric: {
      name: "normalized-mae",
      value: rawMean,
      threshold,
      status: numericStatus,
    },
    comparablePixels,
    excludedPixels,
    excludedRatio: excludedPixels / totalPixels,
    dynamicReviewStatus,
    maskedRegionIds: regions.map((region) => region.id),
    diffArtifact: diffPath,
    status,
  };
}
