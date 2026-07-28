# Dynamic-region treatment

A mask declares pixels outside a static comparison. It does not prove fidelity and
must never turn unknown pixels into passing pixels.

## Mask contract

Pass a JSON object with `regions` to `compare-images.mjs`:

```json
{
  "schemaVersion": "1.0.0",
  "regions": [
    {
      "id": "hero-video",
      "dynamicKind": "live-media",
      "coordinateSpace": "normalized",
      "geometry": { "x": 0.1, "y": 0.2, "width": 0.8, "height": 0.4 },
      "reason": "Source video frames cannot be phase-locked in this environment.",
      "treatment": "separate-review",
      "review": {
        "status": "pass",
        "notes": "Event timing and three deterministic motion checkpoints pass.",
        "evidenceArtifact": "docs/design-references/acme/qa/hero-video-review.md"
      },
      "evidenceIds": ["evidence-hero-video"]
    }
  ]
}
```

Use `image-pixel` coordinates for exact screenshot rectangles or `normalized`
coordinates from 0 to 1. Rectangles use a top-left origin. Keep masks as small and
stable as possible.

## Treatments

- `exclude`: Ignore pixels that have no fidelity meaning, such as a test cursor or
  an unavoidable source timestamp. The reason and evidence remain required.
- `separate-review`: Exclude the static pixels but require a dedicated review of
  the dynamic content. A missing or blocked review makes the image gate blocked; a
  failed review makes it fail.

Do not mask an entire component because one child is dynamic. Do not mask font,
layout, clipping, or asset defects. Overlapping rectangles are counted once, and a
contract that excludes every pixel is invalid.

Dynamic regions should move to deterministic checkpoints whenever possible:
phase-lock videos, freeze clocks, seed random canvases, or replay captured network
fixtures. A mask is a documented evidence boundary, not a convenience.
