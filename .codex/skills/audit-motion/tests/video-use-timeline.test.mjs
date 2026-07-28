import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const script = join(testDirectory, "..", "scripts", "video-use-timeline.mjs");

test("video-use adapter resolves an explicit helper and dry-runs without transcription", () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "audit-motion-video-use-"));

  try {
    const helpers = join(temporaryDirectory, "helpers");
    const timelineView = join(helpers, "timeline_view.py");
    const video = join(temporaryDirectory, "recording.mp4");
    const output = join(temporaryDirectory, "range.png");
    mkdirSync(helpers, { recursive: true });
    writeFileSync(
      timelineView,
      "import argparse\n\ndef render_timeline():\n    pass\n",
      "utf8",
    );
    writeFileSync(video, "synthetic test input", "utf8");

    const locate = spawnSync(
      process.execPath,
      [script, "--locate", "--timeline-view", timelineView],
      { encoding: "utf8" },
    );
    assert.equal(locate.status, 0, locate.stderr);
    assert.equal(locate.stdout.trim(), realpathSync(timelineView));

    const dryRun = spawnSync(
      process.execPath,
      [
        script,
        video,
        "1.25",
        "2.75",
        "--output",
        output,
        "--timeline-view",
        timelineView,
        "--frames",
        "8",
        "--dry-run",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          ELEVENLABS_API_KEY: "must-not-be-used",
        },
      },
    );
    assert.equal(dryRun.status, 0, dryRun.stderr);

    const invocation = JSON.parse(dryRun.stdout);
    assert.equal(invocation.command, "python3");
    assert.deepEqual(invocation.args.slice(0, 4), [
      realpathSync(timelineView),
      video,
      "1.25",
      "2.75",
    ]);
    assert.ok(invocation.args.includes("--n-frames"));
    assert.doesNotMatch(JSON.stringify(invocation), /transcrib|eleven/i);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
