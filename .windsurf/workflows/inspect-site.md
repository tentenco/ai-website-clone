<!-- AUTO-GENERATED from .claude/skills/inspect-site/SKILL.md. Do not edit directly. Run `node scripts/sync-skills.mjs` to regenerate. -->

Canonical bundled resources live under `.claude/skills/inspect-site/`. Resolve relative scripts and references from that directory.


# Inspect Site

Build replayable evidence, not a one-session impression. Prefer Agent Browser when
it is installed and capable; use another browser adapter when Agent Browser is
unavailable or lacks a required capability such as pre-navigation script injection,
video, network, frame, or canvas telemetry.

Read [artifact-contracts.md](references/artifact-contracts.md) before creating or
merging JSON. Read [browser-probe.md](references/browser-probe.md) before executing
the bundled probe or capturing canvas, WebGL, video, Lottie, or Rive.

## 1. Establish the evidence boundary

1. Read `AGENTS.md`, `docs/CLONE_WORKFLOW_V2.md`,
   `docs/research/EVIDENCE_MODEL.md`, and
   `docs/research/<target>/CLONE_CONTRACT.md`.
2. Do not start broad reconnaissance until the contract names the target slug,
   mode (`clone`, `adapt`, or `blend`), allowed routes, source priority, viewports,
   authenticated states, asset rights, privacy limits, and acceptance gates. Create
   or complete the contract from the repository template when authorized; otherwise
   stop and report the missing preflight decision.
3. In `clone` mode, inspect each URL as an isolated target. Multiple URLs do not
   authorize blending. In `blend` mode, verify that `REFERENCE_LEDGER.md` assigns
   every borrowed system to one source.
4. Confirm browser automation, screenshot, script evaluation, network capture,
   video, `ffmpeg`, and `ffprobe` capabilities. Record unavailable capabilities as
   unknowns; never silently substitute inference for missing evidence.
5. Avoid capturing entered passwords, private tokens, or personal data. The probe
   omits form `value` attributes by default. Preserve redistribution restrictions
   and hash downloaded binary evidence.

## 2. Plan small, resumable scenarios

Create `docs/research/<target>/capture-scenarios.json` and validate it before
browsing. Give each scenario one route, one viewport, and one interaction family:

- initial viewport and full page;
- slow deterministic scroll;
- navigation or one menu family;
- one tab, accordion, carousel, dialog, or form family;
- hover, focus, active, keyboard, and touch states;
- loading, empty, error, authenticated, or personalized states;
- reduced motion and color scheme;
- video, parallax, Lottie, Rive, canvas, or WebGL telemetry.

Use stable scenario and step IDs. Declare preconditions, deterministic waits,
checkpoints, exact output paths, expected states, and a resume record. Mark the
scenario `in_progress` before acting. After each checkpoint, write the completed
step IDs and artifact paths. Append an attempt record with the exact browser
adapter and version on success or failure.

Do not combine all routes, breakpoints, and interactions in one browser task.
Resume from the last persisted checkpoint, not from memory.

## 3. Discover and freeze viewports

1. Start with contract viewports.
2. Extract CSS media queries and container/layout changes with the probe, stylesheet
   inspection, and screenshots. Treat a media query as implementation evidence,
   not proof that visible layout changes there.
3. Sweep widths around every observed layout transition. Binary-search the first
   width at which geometry, visibility, navigation, typography, or asset selection
   changes; capture immediately below, at, and above that boundary when meaningful.
4. Add discovered viewports to the scenario artifact before capturing their states.
   Record source query, measured threshold, and conflicting evidence separately.

## 4. Capture one scenario

For each scenario:

1. Set the declared viewport, device scale, touch capability, color scheme, reduced
   motion, storage state, and route. Record the exact browser adapter and version.
   Install the bundled telemetry init script before navigation when canvas, WebGL,
   scroll, or media timing matters.
2. Reach the initial checkpoint using declared readiness conditions. Avoid arbitrary
   sleeps when a DOM, font, media, or network condition is available.
3. Capture viewport and full-page screenshots as declared. For motion, use a fixed
   clock/scroll sequence where the adapter permits it and record an unmodified video
   plus scroll, animation, media, canvas, WebGL, and resource telemetry.
4. Execute one interaction step at a time. Capture before and after hover, focus,
   pressed, open, selected, disabled, loading, empty, and error states. Include
   keyboard and touch variants where the contract requires them.
5. Evaluate `scripts/browser-probe.js` with the scenario ID set. It traverses all
   document and open-shadow-root elements in flat preorder, preserving parent IDs
   without depth or child caps. It records computed-style vectors, generated
   pseudo-elements, geometry, state flags, CSS variables, media queries, and assets.
6. Pair the probe with network evidence and scroll lazy regions into view. Account
   for `src`, `currentSrc`, `srcset`, `<picture>`, video/audio sources and posters,
   tracks, CSS URLs and masks, manifests, font faces, Lottie JSON, Rive files,
   canvas contexts, WebGL contexts, and lazy-loaded resources.
7. Persist the raw capture immediately at
   `docs/research/<target>/captures/<scenario-id>.json`, validate it, then update the
   scenario status and resume fields. Preserve partial artifacts when a later step
   fails.

## 5. Classify findings

Use exactly one label on every material finding:

- `measured`: numeric runtime, media metadata, or deterministic comparison;
- `observed`: directly visible in a capture, DOM, network response, or interaction;
- `inferred`: a supported but unproven implementation reading;
- `invented`: a new design or fallback allowed by the clone contract.

A video proves visible movement, not the engine. A class name suggests but does not
prove a framework. Keep source behavior separate from implementation reading.
Record unsupported conclusions in `unknowns`; do not upgrade them to `inferred` to
unblock a builder. Do not leave unreviewed `invented` behavior in `clone` mode.

## 6. Consolidate and close

Merge validated captures into `docs/research/<target>/site-inspection.json` with:

```bash
node .claude/skills/inspect-site/scripts/merge-site-inspection.mjs \
  --target <target> \
  --output docs/research/<target>/site-inspection.json \
  docs/research/<target>/captures/<scenario-id>.json
```

Then:

1. Reconcile cross-scenario findings, responsive deltas, asset selection, fixed and
   sticky ownership, stacking, and unresolved conflicts.
2. Write or update `PAGE_TOPOLOGY.md` and `BEHAVIORS.md` from labeled evidence.
   Keep raw screenshots, recordings, traces, and network artifacts under
   `docs/design-references/<target>/<scenario-id>/`.
3. Validate both machine-readable artifacts:

```bash
node .claude/skills/inspect-site/scripts/validate-artifact.mjs \
  docs/research/<target>/capture-scenarios.json \
  docs/research/<target>/site-inspection.json
```

4. Verify that every required route, viewport, state, and critical asset is
   accounted for, and that every open unknown names its implementation impact.
5. Do not dispatch builders until page topology, component boundaries, responsive
   states, assets, and motion contracts are frozen or explicitly accepted as
   unknown by the responsible reviewer.

## Required outputs

Always produce:

- `docs/research/<target>/capture-scenarios.json`
- `docs/research/<target>/captures/<scenario-id>.json` for every completed scenario
- `docs/research/<target>/site-inspection.json`
- `docs/research/<target>/PAGE_TOPOLOGY.md`
- `docs/research/<target>/BEHAVIORS.md`
- declared screenshots and telemetry under
  `docs/design-references/<target>/<scenario-id>/`

Keep `CLONE_CONTRACT.md` and, for blend mode, `REFERENCE_LEDGER.md` as upstream
authority. Add `motion-manifest.json` and `MOTION_AUDIT.md` when complex motion is in
scope; the raw capture telemetry remains its source boundary.
