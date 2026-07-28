import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const skillDirectory = resolve(testDirectory, "..");
const repositoryRoot = resolve(skillDirectory, "..", "..", "..");
const validator = join(skillDirectory, "scripts", "validate-motion-manifest.mjs");
const schema = join(
  repositoryRoot,
  "docs",
  "research",
  "schemas",
  "motion-manifest.schema.json",
);

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function evidence(level, claim, sourceId, artifact, measurement) {
  return {
    level,
    claim,
    source: {
      sourceId,
      url: "https://example.com/",
      capturedAt: "2026-07-29T00:00:00.000Z",
      viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      scenario: "desktop-slow-scroll",
      selector: "[data-hero]",
      artifact,
      scrollProgress: 0.5,
    },
    ...(measurement ? { measurement } : {}),
  };
}

function validManifest(sourceContent, telemetryContent) {
  const measured = {
    name: "scrollProgress",
    value: 0.5,
    unit: "ratio",
    tolerance: 0.02,
    samplingIntervalMs: 16.667,
  };

  return {
    schemaVersion: "1.0.0",
    target: {
      slug: "example",
      url: "https://example.com/",
      capturedAt: "2026-07-29T00:00:00.000Z",
      scenario: "desktop-slow-scroll",
      runId: "run-001",
      viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      prefersReducedMotion: "no-preference",
    },
    sources: [
      {
        id: "recording",
        kind: "deterministic-recording",
        path: "recording.bin",
        sha256: sha256(sourceContent),
        bytes: Buffer.byteLength(sourceContent),
        capturedAt: "2026-07-29T00:00:00.000Z",
        media: {
          durationSeconds: 2,
          width: 1440,
          height: 900,
          frameRate: "30/1",
          codec: "h264",
          pixelFormat: "yuv420p",
        },
      },
    ],
    telemetry: [
      {
        id: "scroll-dom",
        kind: "scroll",
        artifact: "telemetry.json",
        sha256: sha256(telemetryContent),
        capturedAt: "2026-07-29T00:00:00.000Z",
        clock: "performance",
        samplingIntervalMs: 16.667,
        channels: ["scrollY", "hero.transform"],
      },
    ],
    events: [
      {
        id: "hero-parallax",
        label: "Hero layer parallax",
        mode: "continuous",
        evidence: evidence(
          "measured",
          "The hero layer translates 120px over the audited scroll range.",
          "scroll-dom",
          "telemetry.json",
          measured,
        ),
        time: { startSeconds: 0.2, endSeconds: 1.8 },
        scroll: {
          container: "document",
          axis: "y",
          startPx: 400,
          endPx: 1200,
          startProgress: 0,
          endProgress: 1,
          clamp: true,
        },
        trigger: {
          type: "scroll-progress",
          selector: "[data-hero]",
          telemetryRef: "scroll-dom",
        },
        stateA: {
          label: "range start",
          properties: [
            {
              target: "[data-hero-layer]",
              property: "translateY",
              value: 0,
              unit: "px",
              tolerance: 2,
            },
          ],
        },
        stateB: {
          label: "range end",
          properties: [
            {
              target: "[data-hero-layer]",
              property: "translateY",
              value: -120,
              unit: "px",
              tolerance: 2,
            },
          ],
        },
        timing: { easing: "scroll-linked", staggerMs: 0 },
        telemetryRefs: ["scroll-dom"],
        unknownRefs: [],
      },
    ],
    responsiveFallbacks: [
      {
        condition: "width >= 1024px",
        behavior: "Use the measured desktop scroll range.",
        eventRefs: ["hero-parallax"],
        evidence: evidence(
          "observed",
          "The deterministic desktop recording shows the parallax scene.",
          "recording",
          "recording.bin",
        ),
      },
    ],
    reducedMotionFallback: {
      behavior: "disable",
      details: "Keep the final readable hero state without scroll-linked translation.",
      eventRefs: ["hero-parallax"],
      evidence: evidence(
        "invented",
        "The clone contract permits an accessible static fallback.",
        "recording",
        "recording.bin",
      ),
    },
    unknowns: [],
    implementationReading: [
      {
        id: "reading-hero",
        eventRefs: ["hero-parallax"],
        level: "inferred",
        claim: "A normalized scroll mapping can reproduce the measured trajectory.",
        mechanism: "A narrow client controller maps scroll progress to translateY.",
        proposedEngine: "requestAnimationFrame",
        evidenceRefs: ["scroll-dom", "recording"],
        builderGuidance: "Preserve server-rendered hero content.",
      },
    ],
    qaCheckpoints: [
      {
        id: "hero-midpoint",
        eventRef: "hero-parallax",
        at: { timeSeconds: 1, scrollPx: 800, scrollProgress: 0.5, state: "intermediate" },
        expected: [
          {
            target: "[data-hero-layer]",
            property: "translateY",
            value: -60,
            unit: "px",
            tolerance: 2,
          },
        ],
        evidence: evidence(
          "measured",
          "The midpoint transform is -60px.",
          "scroll-dom",
          "telemetry.json",
          {
            name: "translateY",
            value: -60,
            unit: "px",
            tolerance: 2,
            samplingIntervalMs: 16.667,
          },
        ),
      },
    ],
  };
}

test("validator checks the manifest contract and artifact hashes", () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "motion-manifest-test-"));

  try {
    const sourceContent = "deterministic recording bytes";
    const telemetryContent = '{"scrollY":800,"translateY":-60}\n';
    writeFileSync(join(temporaryDirectory, "recording.bin"), sourceContent);
    writeFileSync(join(temporaryDirectory, "telemetry.json"), telemetryContent);

    const manifestPath = join(temporaryDirectory, "motion-manifest.json");
    const manifest = validManifest(sourceContent, telemetryContent);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const valid = spawnSync(
      process.execPath,
      [
        validator,
        manifestPath,
        "--schema",
        schema,
        "--root",
        temporaryDirectory,
        "--check-artifacts",
      ],
      { encoding: "utf8" },
    );
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /2 artifacts checked/);

    manifest.unexpectedTopLevel = true;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const structurallyInvalid = spawnSync(
      process.execPath,
      [validator, manifestPath, "--schema", schema, "--root", temporaryDirectory],
      { encoding: "utf8" },
    );
    assert.equal(structurallyInvalid.status, 1);
    assert.match(structurallyInvalid.stderr, /additional property is not allowed/);
    delete manifest.unexpectedTopLevel;

    delete manifest.events[0].evidence.measurement;
    manifest.events[0].telemetryRefs = ["missing-channel"];
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const invalid = spawnSync(
      process.execPath,
      [validator, manifestPath, "--schema", schema, "--root", temporaryDirectory],
      { encoding: "utf8" },
    );
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /measurement is required/);
    assert.match(invalid.stderr, /missing-channel/);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("the bundled schema is valid JSON with the expected contract version", () => {
  const parsed = JSON.parse(readFileSync(schema, "utf8"));
  assert.equal(parsed.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(parsed.properties.schemaVersion.const, "1.0.0");
  assert.ok(parsed.required.includes("qaCheckpoints"));
  assert.ok(parsed.$defs.motionEvent.required.includes("stateA"));
  assert.ok(parsed.$defs.motionEvent.required.includes("stateB"));
});
