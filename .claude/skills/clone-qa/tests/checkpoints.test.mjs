import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { compareCheckpointDocuments } from "../scripts/lib/checkpoints.mjs";

const fixture = (name) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url));
const readFixture = async (name) => JSON.parse(await readFile(fixture(name), "utf8"));

test("values exactly on every configured tolerance pass", async () => {
  const source = await readFixture("checkpoints-source.json");
  const clone = await readFixture("checkpoints-boundary.json");
  const result = compareCheckpointDocuments(source, clone, {
    geometryPx: 2,
    timingMs: 100,
    scrollProgress: 0.02,
  });

  assert.equal(result.summary.status, "pass");
  assert.equal(result.summary.comparisonCounts.fail, 0);
  assert.equal(result.summary.comparisonCounts.pass, 6);
});

test("values above geometry, timing, and scroll tolerances fail", async () => {
  const source = await readFixture("checkpoints-source.json");
  const clone = await readFixture("checkpoints-over.json");
  const result = compareCheckpointDocuments(source, clone, {
    geometryPx: 2,
    timingMs: 100,
    scrollProgress: 0.02,
  });

  assert.equal(result.summary.status, "fail");
  const failedDomains = new Set(
    result.checkpoints[0].comparisons
      .filter((comparison) => comparison.status === "fail")
      .map((comparison) => comparison.domain),
  );
  assert.deepEqual(
    [...failedDomains].sort(),
    ["geometry", "scrollProgress", "timingMs"],
  );
});

test("missing checkpoints fail instead of being silently ignored", async () => {
  const source = await readFixture("checkpoints-source.json");
  const result = compareCheckpointDocuments(
    source,
    { schemaVersion: "1.0.0", scenarioId: "desktop-motion", checkpoints: [] },
  );

  assert.equal(result.summary.status, "fail");
  assert.match(result.checkpoints[0].comparisons[0].reason, /missing clone checkpoint/);
});

test("malformed normalized numeric leaves are rejected", () => {
  assert.throws(
    () => compareCheckpointDocuments(
      {
        checkpoints: [{
          id: "bad",
          kind: "motion",
          geometry: { x: "10px" },
        }],
      },
      {
        checkpoints: [{
          id: "bad",
          kind: "motion",
          geometry: { x: 10 },
        }],
      },
    ),
    /must be a finite number/,
  );
});
