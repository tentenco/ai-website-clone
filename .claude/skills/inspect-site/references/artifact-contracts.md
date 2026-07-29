# Inspect-site artifact contracts

## Contents

- [Paths and lifecycle](#paths-and-lifecycle)
- [Capture scenarios](#capture-scenarios)
- [Raw capture and site inspection](#raw-capture-and-site-inspection)
- [Evidence and unknowns](#evidence-and-unknowns)
- [Validation and merging](#validation-and-merging)

## Paths and lifecycle

Use the target slug from `CLONE_CONTRACT.md`:

```text
docs/research/<target>/
├── capture-scenarios.json
├── captures/
│   └── <scenario-id>.json
├── site-inspection.json
├── PAGE_TOPOLOGY.md
└── BEHAVIORS.md

docs/design-references/<target>/
└── <scenario-id>/
    ├── <checkpoint>.png
    ├── motion.mp4
    ├── network.json
    └── trace.json
```

Write a raw capture immediately after a scenario probe. Validate it before merging.
The merge helper replaces a capture with the same scenario, source route, URL, and
viewport key, so a resumed attempt does not create ambiguous duplicates.

The canonical JSON Schemas are:

- `docs/research/schemas/capture-scenarios.schema.json`
- `docs/research/schemas/site-inspection.schema.json`

Both use JSON Schema draft 2020-12 and `schemaVersion: "1.0.0"`. The bundled Node
validator adds semantic checks that JSON Schema alone does not express concisely,
including step references, date ordering, capture replacement keys, node parent
order, and computed-style vector length.

## Capture scenarios

`capture-scenarios.json` is an execution ledger, not prose. The top level records
the target, source, creation/update times, scenarios, optional responsive state
coverage, and cross-scenario unknowns.
Every scenario records:

- stable `id`, `route`, `family`, and complete viewport/environment including
  DPR, reduced-motion preference, color scheme, and touch capability;
- state names and preconditions;
- ordered, uniquely named steps;
- declared capture kind, path, and producing step;
- `planned`, `in_progress`, `captured`, `blocked`, `failed`, or `verified` status;
- nullable `capturedAt`;
- completed and next step in `resume`;
- append-only attempts with timestamps, exact browser adapter/version, and
  artifact paths;
- expected evidence and scenario-local unknowns.

Persist this sequence:

1. Set `status` to `in_progress` and append an attempt with `startedAt`.
2. After each checkpoint, update `resume.completedStepIds`,
   `resume.nextStepId`, and `resume.checkpointArtifact`.
3. Persist each artifact before marking its step complete.
4. On completion, set `capturedAt`, close the attempt, and mark `captured`.
5. On interruption, preserve completed steps and mark `blocked` or `failed` with
   the exact error. Resume with a new attempt.

See `tests/fixtures/capture-scenarios.valid.json` for a complete minimal example.

### Responsive state coverage

Use top-level `responsiveStateCoverage` when a measured boundary changes a
stateful surface. Each boundary records:

- a stable `id`, route, and measured threshold `width`;
- `captureWidths` containing the exact `width - 1`, `width`, and `width + 1`;
- affected scenario families and the settled states each family must capture;
- a short evidence pointer when available.

The semantic validator requires one matching scenario per route, family, and
capture width whose `states` include the full declared set. This prevents a static
tablet screenshot from standing in for a tablet navigation state, and prevents
desktop/mobile menu captures from silently leaving an intermediate mode untested.
State names should distinguish the panel shell from nested disclosure outcomes,
for example `menu-open-settled`, `nested-disclosures-collapsed`, and
`products-disclosure-expanded`.

## Raw capture and site inspection

`browser-probe.js` returns one raw capture. Its required provenance is:

```json
{
  "schemaVersion": "1.0.0",
  "source": { "url": "https://example.com/", "route": "/" },
  "capturedAt": "2026-07-29T00:00:00.000Z",
  "viewport": {
    "width": 1440,
    "height": 900,
    "deviceScaleFactor": 2,
    "orientation": "landscape"
  },
  "scenario": "desktop-initial",
  "evidenceLevel": "measured"
}
```

The capture-level evidence label applies to raw browser readings. Derived claims
belong in top-level `site-inspection.json.findings` and carry their own label and
full source object.

Every raw capture also records `adapter` (for example,
`agent-browser@0.33.0`). The scenario attempt and its raw capture must name the
same adapter/version unless an adapter handoff is explicitly recorded as a new
attempt.

The probe stores DOM as flat `nodes` in preorder. `id` is stable within one
capture; `parent` references an earlier node. `style` is a vector aligned
one-to-one with `styleProperties`. This avoids repeated property names while
retaining every traversed element. `pseudo.before.style` and
`pseudo.after.style` use the same vector.

The capture also includes:

- `document`: page metadata, root CSS variables, and traversal method;
- `breakpoints`: readable media queries and whether each currently matches;
- `states`: actual focus, hover, checked, open, selected, disabled, and ARIA state;
- `assets`: typed image, picture source, media, track, CSS URL/mask, Lottie, Rive,
  animation data, canvas, WebGL, font, manifest, and iframe records;
- `telemetry`: scroll geometry, Resource Timing, Web Animations, media state, and
  pre-navigation canvas/WebGL events;
- `unknowns`: inaccessible CSSOM, iframe boundaries, missing scenario IDs, or
  missing init telemetry.

The probe deliberately does not cap DOM depth, child count, text length, resources,
or telemetry events. Scope a capture with a declared `rootSelector` only when the
scenario contract explicitly covers that subtree.

`site-inspection.json` aggregates raw captures plus cross-scenario `findings` and
`unknowns`. Do not hand-edit probe node arrays when deriving findings; preserve raw
evidence and add a labeled finding instead.

## Evidence and unknowns

Every finding requires `level`, `claim`, and:

- source URL;
- capture time;
- viewport;
- scenario;
- selector and artifact path when applicable;
- a named `measurement` with value and unit for numeric claims.

Use only `measured`, `observed`, `inferred`, and `invented`. The `evidenceLevel` on
a raw capture is normally `measured`; screenshots and video normally support
`observed` findings. Do not use `invented` as a synonym for missing evidence.

Every unknown has a slug ID, question, implementation impact, and `open`,
`accepted`, or `resolved` status. A resolved unknown includes its resolution.
Acceptance is a reviewer decision, not an agent convenience.

## Validation and merging

Validate any mix of supported artifacts:

```bash
node .claude/skills/inspect-site/scripts/validate-artifact.mjs \
  --kind auto <path> [...]
```

Kinds are `capture`, `capture-scenarios`, and `site-inspection`. The command exits
zero only when every input is valid and reports JSON-pointer-like error paths.

Merge one or more raw captures atomically:

```bash
node .claude/skills/inspect-site/scripts/merge-site-inspection.mjs \
  --target <target> \
  --output docs/research/<target>/site-inspection.json \
  docs/research/<target>/captures/<one>.json \
  docs/research/<target>/captures/<two>.json
```

The helper validates the existing aggregate and every incoming capture before
writing. It preserves reviewed findings and unknowns, replaces resumptions by
stable key, sorts captures deterministically, writes a temporary sibling, and then
renames it over the output.
