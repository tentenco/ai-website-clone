# Motion QA

Compare visible behavior and telemetry without inferring an implementation library
from the rendered result.

## Capture

Replay the same scenario with a fixed viewport, input fixture, initial scroll
position, and input schedule. Capture:

- event names and timestamps relative to the scenario start;
- normalized scroll progress for scroll-linked state changes;
- element rectangles and transforms at named checkpoints;
- opacity, visibility, active state, and other discrete state;
- media time, playback state, canvas hashes, or WebGL telemetry when relevant;
- a deterministic recording for trajectory and visual review;
- a separate reduced-motion run.

Sample scroll-linked motion at explicit normalized progress values. Sample
time-driven motion at explicit elapsed times. Full-frame video diff alone is not an
acceptance gate because phase drift can overwhelm meaningful behavior.

## Normalized checkpoint format

Use identical checkpoint IDs in the source and clone files:

```json
{
  "schemaVersion": "1.0.0",
  "scenarioId": "desktop-slow-scroll",
  "checkpoints": [
    {
      "id": "hero-midpoint",
      "kind": "motion",
      "geometry": {
        "hero": { "x": 0, "y": 80, "width": 1440, "height": 900 },
        "art": { "translateY": -42, "scale": 0.92 }
      },
      "timingMs": { "elapsed": 850 },
      "scrollProgress": { "page": 0.5, "hero": 0.47 },
      "state": { "phase": "compressed", "visible": true }
    }
  ]
}
```

Every leaf under `geometry`, `timingMs`, and `scrollProgress` must be numeric.
Values under `state` compare exactly. Geometry and transforms use CSS pixels;
angles or other units must be normalized by the capture adapter before comparison.

Run:

```bash
node .claude/skills/clone-qa/scripts/compare-checkpoints.mjs \
  source-checkpoints.json clone-checkpoints.json \
  --geometry-px 2 --timing-ms 100 --scroll-progress 0.02 \
  --out checkpoint-comparison.json
```

Use tolerances from the approved contract. Missing checkpoints or values fail.
At-tolerance values pass; values above tolerance fail. Review the recording after
the deterministic gate to catch easing, sequencing, and compositing differences
not represented by the selected checkpoints.
