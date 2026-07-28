import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRowIntervals,
  resolveMaskRegions,
} from "../scripts/lib/image-diff.mjs";

test("overlapping masks count excluded pixels once", () => {
  const dimensions = { width: 10, height: 10 };
  const regions = resolveMaskRegions({
    schemaVersion: "1.0.0",
    regions: [
      {
        id: "first",
        dynamicKind: "cursor",
        coordinateSpace: "image-pixel",
        geometry: { x: 1, y: 1, width: 2, height: 2 },
        treatment: "exclude",
        reason: "test cursor",
        evidenceIds: ["cursor-capture"]
      },
      {
        id: "second",
        dynamicKind: "cursor",
        coordinateSpace: "image-pixel",
        geometry: { x: 2, y: 2, width: 2, height: 2 },
        treatment: "exclude",
        reason: "test cursor shadow",
        evidenceIds: ["cursor-shadow-capture"]
      }
    ]
  }, dimensions);

  assert.equal(buildRowIntervals(dimensions, regions).excludedPixels, 7);
});

test("normalized masks resolve to deterministic pixel bounds", () => {
  const regions = resolveMaskRegions({
    schemaVersion: "1.0.0",
    regions: [{
      id: "video",
      dynamicKind: "live-media",
      coordinateSpace: "normalized",
      geometry: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
      treatment: "separate-review",
      reason: "unlocked video frame",
      evidenceIds: ["video-capture"]
    }]
  }, { width: 100, height: 50 });

  assert.deepEqual(
    {
      x: regions[0].x,
      y: regions[0].y,
      width: regions[0].width,
      height: regions[0].height,
    },
    { x: 10, y: 10, width: 50, height: 20 },
  );
});

test("mask regions outside the image are rejected", () => {
  assert.throws(
    () => resolveMaskRegions({
      schemaVersion: "1.0.0",
      regions: [{
        id: "bad",
        dynamicKind: "other",
        coordinateSpace: "image-pixel",
        geometry: { x: 9, y: 0, width: 2, height: 1 },
        treatment: "exclude",
        reason: "invalid bounds",
        evidenceIds: ["invalid-mask-capture"]
      }]
    }, { width: 10, height: 10 }),
    /extends outside/,
  );
});
