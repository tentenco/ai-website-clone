---
name: audit-motion
description: Analyze supplied videos and deterministic website recordings, pair visual timelines with DOM, scroll, media, canvas, WebGL, and network telemetry, and produce evidence-labeled motion manifests and QA checkpoints. Use for website-clone motion audits involving scroll triggers, sticky or parallax scenes, scrubbed video, canvas/WebGL animation, responsive motion, or reduced-motion behavior.
---

# Audit Motion

Turn a recording plus synchronized runtime telemetry into a reviewable motion
contract. Preserve the boundary between visible behavior and implementation
mechanism.

## Inputs and gate

Require:

- a clone contract, target URL, scenario name, viewport, and capture time;
- an untouched source video or deterministic browser recording;
- telemetry artifacts when the audit makes DOM or implementation claims.

Stop and record an `unknown` when the recording, capture conditions, or telemetry
cannot support a material conclusion. Do not dispatch a builder until the motion
manifest and human motion audit are frozen.

## Workflow

1. **Inventory and hash.** Verify `ffmpeg` and `ffprobe`, then probe every source:

   ```bash
   node .claude/skills/audit-motion/scripts/probe-video.mjs \
     path/to/recording.mp4 --output path/to/probe.json
   ```

2. **Build the visual timeline.** Create an evenly sampled contact sheet and its
   time-indexed JSON sidecar:

   ```bash
   node .claude/skills/audit-motion/scripts/contact-sheet.mjs \
     path/to/recording.mp4 --output path/to/contact-sheet.png \
     --metadata path/to/contact-sheet.timeline.json --count 12
   ```

   For a narrow ambiguous range, optionally use video-use `timeline_view` as a
   visual-timeline adapter:

   ```bash
   node .claude/skills/audit-motion/scripts/video-use-timeline.mjs \
     path/to/recording.mp4 4.2 7.8 --output path/to/range.png \
     --timeline-view /absolute/path/to/video-use/helpers/timeline_view.py
   ```

   video-use is not a webpage instrumentation engine. It cannot supply DOM,
   scroll, canvas, WebGL, media-element, or network evidence. Do not install it
   merely for this audit; the bundled contact sheet is the dependency-light
   fallback. Transcribe only when speech timing materially affects the motion
   finding. Skip transcription for silent UI, scroll, parallax, canvas, and
   WebGL audits.

3. **Align telemetry.** Normalize video time, capture monotonic time, wall-clock
   time, scroll pixels/progress, and media time. Pair visible checkpoints with
   telemetry samples; never infer synchronization from filename order.

4. **Classify events.** Separate discrete transitions from continuous mappings.
   Record trigger, state A/B, time or scroll bounds, duration, easing, stagger,
   responsive behavior, reduced-motion behavior, and unknowns. Read
   [motion-taxonomy.md](references/motion-taxonomy.md) for the classification
   rules.

5. **Apply evidence labels.** Use exactly `measured`, `observed`, `inferred`, or
   `invented`. A rendered frame proves appearance, not the animation library or
   source mechanism. Read
   [evidence-boundaries.md](references/evidence-boundaries.md) before making
   mechanism claims.

6. **Write the artifacts.** Produce `motion-manifest.json` against
   `docs/research/schemas/motion-manifest.schema.json` and a time-coded
   `MOTION_AUDIT.md`. Keep source behavior separate from the implementation
   reading.

7. **Validate.**

   ```bash
   node .claude/skills/audit-motion/scripts/validate-motion-manifest.mjs \
     docs/research/<target>/motion-manifest.json \
     --schema docs/research/schemas/motion-manifest.schema.json \
     --root . --check-artifacts
   ```

8. **Freeze QA checkpoints.** Include static states, critical discrete event
   timing, normalized scroll progress, viewport variants, and reduced-motion
   outcomes. Replay the same deterministic scenarios against the clone.

## Capture guidance

Read [capture-telemetry.md](references/capture-telemetry.md) before designing or
reviewing browser instrumentation. Read
[video-use-integration.md](references/video-use-integration.md) only when using
the optional adapter.

Preserve source files unchanged. Write probes, sheets, timelines, telemetry,
manifests, and audit notes to separate artifact paths.
