# Clone Workflow V2

## Objective

Turn website reconstruction into an evidence-driven pipeline that can:

1. reproduce a source at high visual and behavioral fidelity;
2. explain what is measured, observed, inferred, or newly designed;
3. resume safely after browser or agent failures;
4. separate baseline cloning from client adaptation and reference blending;
5. verify static layout, responsive states, interactions, and motion.

## Modes

| Mode | Purpose | Entry gate |
| --- | --- | --- |
| `clone` | Reproduce one source without aesthetic changes. | Approved clone contract. |
| `adapt` | Preserve an approved baseline system while replacing brand, content, or product requirements. | Baseline clone QA passed. |
| `blend` | Combine explicitly assigned systems from multiple references. | Baseline evidence exists for every borrowed system and the reference ledger is approved. |

Multiple URLs do not imply blending. In `clone` mode they remain isolated targets.

## Authority order

Resolve conflicts in this order:

1. user scope and explicit approvals;
2. `docs/research/<target>/CLONE_CONTRACT.md`;
3. approved client content and brand assets;
4. measured source evidence and capture artifacts;
5. component and motion specifications;
6. implementation;
7. agent assumptions.

An assumption never overrides stronger evidence. Record unresolved conflicts instead
of silently choosing.

## Required artifacts

Each target uses a stable slug under `docs/research/<target>/` and
`docs/design-references/<target>/`.

| Artifact | Purpose |
| --- | --- |
| `CLONE_CONTRACT.md` | Purpose, mode, routes, viewports, source priority, rights, and gates. |
| `REFERENCE_LEDGER.md` | Per-system provenance and blend boundaries. |
| `PAGE_TOPOLOGY.md` | Section order, stacking, sticky/fixed ownership, and dependencies. |
| `site-inspection.json` | Machine-readable route, component, state, asset, and stack evidence. |
| `BEHAVIORS.md` | Human-readable interaction findings. |
| `motion-manifest.json` | Machine-readable motion events and telemetry. |
| `MOTION_AUDIT.md` | Time-coded motion grammar, unknowns, and implementation reading. |
| `components/*.spec.md` | Frozen builder contracts. |
| `capture-scenarios.json` | Small, deterministic, resumable browser scenarios. |
| `qa/fidelity-report.json` | Gate results and discrepancy ledger. |
| `qa/FIDELITY_REPORT.md` | Human review summary and remaining risks. |

Every factual artifact entry must use the evidence model in
`docs/research/EVIDENCE_MODEL.md`.

## Pipeline

### Stage 0: Preflight

- Verify the checkout is a Git worktree before launching an agent team.
- Read project instructions and the installed Next.js documentation before code
  changes.
- Verify the scaffold with the smallest relevant build checks.
- Confirm browser automation, `ffmpeg`, and `ffprobe` capabilities.
- Create the clone contract before collecting broad evidence.

### Stage 1: Purpose and scope

- Identify the target audience, primary outcome, primary CTA, and content hierarchy.
- Record exact routes and authenticated or stateful surfaces in scope.
- Record source permissions and any assets that must not be redistributed.
- Select `clone`, `adapt`, or `blend`.
- In `blend`, assign each borrowed system to one source in the reference ledger.

### Stage 2: Scenario capture

Split reconnaissance into short scenarios. A scenario should normally cover one
viewport and one interaction family:

- initial and full-page state;
- slow scroll;
- navigation and menus;
- one tab, accordion, carousel, or modal family;
- hover and focus states;
- loading, empty, and error states;
- reduced-motion behavior;
- video, canvas, WebGL, or parallax telemetry.

Persist each scenario immediately. Do not combine every route, breakpoint, and
interaction into one long browser task.

### Stage 3: Evidence extraction

- Inspect all relevant viewports, including discovered breakpoints.
- Capture pseudo-elements, CSS variables, font faces, media queries, and state
  changes.
- Inventory responsive images, video sources, posters, manifests, CSS masks,
  Lottie/Rive data, canvas, WebGL, and lazy-loaded resources.
- For complex motion, combine deterministic video capture with DOM, scroll, media,
  canvas, and network telemetry.
- Separate visible behavior from the inferred implementation mechanism.

### Stage 4: Specification freeze

- Complete page topology, behavior, asset, motion, and component specs.
- Mark every claim `measured`, `observed`, `inferred`, or `invented`.
- Resolve or explicitly accept every `unknown` that affects implementation.
- Freeze shared tokens, types, assets, and motion primitives before builders start.

### Stage 5: Build

- Keep shared foundation work with the root orchestrator.
- Keep server-rendered content by default.
- Add narrow client controllers for behavior that requires the browser.
- Select the motion engine from evidence; do not default to one library.
- Give each builder one bounded component contract and non-overlapping file
  ownership.

### Stage 6: QA

- Replay the same capture scenarios against source and clone.
- Compare static checkpoints with masks for truly dynamic regions.
- Compare motion using event timing, scroll progress, transform trajectories, and
  human review rather than full-frame pixel diff alone.
- Verify desktop, tablet, mobile, keyboard, touch, and reduced motion.
- Run lint, typecheck, build, runtime route checks, and asset decode checks.
- Do not enter `adapt` or `blend` until the baseline clone passes its approved gates.

## Agent Harness contract

The root model is the only orchestrator and merger.

1. Commit the shared contracts before creating executor worktrees.
2. Create one branch and worktree per executor.
3. Give each executor exclusive file ownership, explicit stop conditions, and
   verification requirements.
4. Executors do not spawn descendants or modify shared foundation files.
5. Merge one completed branch at a time and verify after every merge.
6. Executor completion is a handoff, not acceptance; the root reviews source,
   artifacts, tests, and integration.

## Initial fidelity gates

Projects may tighten these values in the clone contract.

- Key layout geometry: target `<= 2px` desktop and `<= 3px` mobile.
- Critical discrete motion timing: target `<= 100ms` deviation.
- Scroll-linked checkpoints: target `<= 0.02` normalized progress deviation.
- Required states and critical assets: `100%` accounted for.
- No inaccessible essential content when JavaScript, animation, or motion is
  unavailable.
- No unreviewed `invented` behavior in `clone` mode.

