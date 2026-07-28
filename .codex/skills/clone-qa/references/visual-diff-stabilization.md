# Visual diff stabilization

Stabilize capture before assigning meaning to pixels.

## Replay controls

Use the same scenario definition for source and clone:

- exact viewport, device scale factor, locale, timezone, color scheme, and reduced-motion preference;
- identical route, fixture data, consent state, cookies, and authentication boundary;
- fixed font availability and a completed `document.fonts.ready`;
- completed image decode and an explicit network-idle or application-ready signal;
- deterministic scroll offsets and named interaction checkpoints;
- disabled caret, selection, browser chrome, and capture-tool overlays;
- fixed clock or masked timestamps when clock control is impossible.

Persist the scenario input and both outputs. A screenshot without its replay inputs
is review evidence, not a deterministic gate.

## Static comparison sequence

1. Confirm equal image dimensions. A mismatch is a geometry failure, not an image
   diff result.
2. Confirm that the source and clone represent the same scenario and state.
3. Inspect asset decode and font failures before interpreting pixel noise.
4. Apply only reviewed dynamic-region masks.
5. Run the numeric adapter with the contract threshold.
6. Inspect the diff artifact and record geometry, typography, color, and asset
   discrepancies separately. One image metric cannot diagnose the cause.

Anti-aliasing, subpixel font rasterization, and video decoding vary by platform.
Pin the browser and host when those pixels are acceptance-critical. Otherwise use
the numeric result as supporting evidence and keep explicit typography and geometry
gates authoritative.

## Image adapter

Run:

```bash
node .claude/skills/clone-qa/scripts/compare-images.mjs \
  source.png clone.png \
  --threshold 0.01 \
  --masks qa/masks/desktop-hero.json \
  --diff qa/diffs/desktop-hero.png \
  --out qa/results/desktop-hero.json
```

The adapter prefers ImageMagick and falls back to `ffmpeg` plus `ffprobe`. It
reports normalized mean absolute RGB error over comparable pixels. The threshold
must come from the clone contract; do not tune it after seeing a failure.

If neither adapter is installed, mark the image gate `blocked`. Do not substitute
an undocumented metric.
