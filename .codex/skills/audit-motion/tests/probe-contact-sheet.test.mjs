import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const scriptsDirectory = join(testDirectory, "..", "scripts");

function hasCommand(command) {
  const result = spawnSync(command, ["-version"], { encoding: "utf8" });
  return !result.error && result.status === 0;
}

function runNode(script, args) {
  return spawnSync(process.execPath, [join(scriptsDirectory, script), ...args], {
    encoding: "utf8",
  });
}

function hashFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

test(
  "probe and contact sheet preserve and deterministically sample a synthetic video",
  { skip: !hasCommand("ffmpeg") || !hasCommand("ffprobe"), timeout: 30_000 },
  () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "audit-motion-test-"));

    try {
      const source = join(temporaryDirectory, "synthetic.mp4");
      const probePath = join(temporaryDirectory, "probe.json");
      const sheetA = join(temporaryDirectory, "sheet-a.png");
      const timelineA = join(temporaryDirectory, "sheet-a.timeline.json");
      const sheetB = join(temporaryDirectory, "sheet-b.png");
      const timelineB = join(temporaryDirectory, "sheet-b.timeline.json");

      const generate = spawnSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "testsrc2=size=160x90:rate=10:duration=1.2",
          "-c:v",
          "mpeg4",
          "-q:v",
          "4",
          "-pix_fmt",
          "yuv420p",
          "-y",
          source,
        ],
        { encoding: "utf8" },
      );
      assert.equal(generate.status, 0, generate.stderr);

      const sourceHashBefore = hashFile(source);
      const probe = runNode("probe-video.mjs", [source, "--output", probePath]);
      assert.equal(probe.status, 0, probe.stderr);

      const probeJson = JSON.parse(readFileSync(probePath, "utf8"));
      assert.equal(probeJson.schemaVersion, "1.0.0");
      assert.equal(probeJson.source.sha256, sourceHashBefore);
      assert.ok(probeJson.media.durationSeconds >= 1);
      assert.equal(
        probeJson.media.streams.find((stream) => stream.type === "video").width,
        160,
      );

      const commonArgs = ["--count", "6", "--columns", "3", "--cell-width", "120"];
      const firstSheet = runNode("contact-sheet.mjs", [
        source,
        "--output",
        sheetA,
        "--metadata",
        timelineA,
        ...commonArgs,
      ]);
      assert.equal(firstSheet.status, 0, firstSheet.stderr);

      const secondSheet = runNode("contact-sheet.mjs", [
        source,
        "--output",
        sheetB,
        "--metadata",
        timelineB,
        ...commonArgs,
      ]);
      assert.equal(secondSheet.status, 0, secondSheet.stderr);

      const timeline = JSON.parse(readFileSync(timelineA, "utf8"));
      assert.equal(timeline.artifact.frames.length, 6);
      assert.equal(timeline.artifact.columns, 3);
      assert.equal(timeline.artifact.rows, 2);
      assert.equal(timeline.artifact.frames[0].normalizedTime, 0.083333);
      assert.equal(hashFile(sheetA), hashFile(sheetB));
      assert.equal(hashFile(source), sourceHashBefore);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  },
);
