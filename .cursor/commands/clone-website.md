<!-- AUTO-GENERATED from .claude/skills/clone-website/SKILL.md. Do not edit directly. Run `node scripts/sync-skills.mjs` to regenerate. -->

Canonical bundled resources live under `.claude/skills/clone-website/`. Resolve relative scripts and references from that directory.


# Clone Website

Reconstruct **the target or reference provided by the user** from auditable evidence. Preserve a clean boundary
between source facts, implementation readings, and new design decisions.

Read `AGENTS.md`, `docs/CLONE_WORKFLOW_V2.md`, and
`docs/research/EVIDENCE_MODEL.md` before acting.

## Select the mode

- Use `clone` unless the user explicitly requests adaptation or blending.
- Use `adapt` to replace brand, content, or product requirements after a baseline
  system has passed QA.
- Use `blend` only when the user explicitly assigns systems from multiple
  references.
- Treat multiple URLs as isolated clones unless `blend` is explicit.

For `adapt` or `blend`, apply `$blend-references` after the baseline evidence gate.
Never customize while the clone baseline is still uncertain.

## Stage 0: Preflight

1. Confirm every URL is valid and accessible.
2. Read the relevant installed Next.js documentation before changing application
   code.
3. Verify the checkout is a Git worktree before launching an agent team.
4. Inspect the current worktree and preserve unrelated changes.
5. Prefer `agent-browser` for browser automation when available; otherwise use the
   strongest connected browser that can evaluate JavaScript, control viewports,
   capture screenshots, and perform interactions.
6. Verify `ffmpeg` and `ffprobe` when video or complex motion may be involved.
7. Run the smallest relevant scaffold checks and record baseline failures.
8. Create isolated target folders:

```text
docs/research/<target>/
docs/research/<target>/components/
docs/research/<target>/qa/
docs/design-references/<target>/
```

## Stage 1: Write the clone contract

Create `docs/research/<target>/CLONE_CONTRACT.md` from the template in
`docs/research/templates/`.

Record:

- audience, purpose, primary outcome, and primary CTA;
- mode, routes, languages, viewports, browsers, and stateful surfaces;
- source authority and approved client assets/content;
- permission, privacy, and redistribution limits;
- backend and integration scope;
- fidelity priorities and required states;
- static, interaction, motion, accessibility, performance, build, and runtime
  gates.

Create `REFERENCE_LEDGER.md` for multiple sources. Stop on unresolved authority,
rights, or scope conflicts.

## Stage 2: Inspect in resumable scenarios

Apply `$inspect-site`.

Do not run one monolithic reconnaissance task. Persist short deterministic
scenarios for:

- initial/full-page capture;
- slow scroll;
- menus and navigation;
- each stateful component family;
- hover, focus, keyboard, and touch;
- loading, empty, and error states;
- desktop, tablet, mobile, and discovered breakpoints;
- reduced motion;
- media, canvas, WebGL, parallax, and scroll-scrub telemetry.

Required outputs include:

- `site-inspection.json`;
- `capture-scenarios.json`;
- `PAGE_TOPOLOGY.md`;
- `BEHAVIORS.md`;
- route/viewport screenshots;
- asset and technical-stack findings.

Each material claim must be `measured`, `observed`, `inferred`, or `invented`.
Preserve `unknown` when evidence is insufficient.

## Stage 3: Audit complex motion

Apply `$audit-motion` when the source or reference contains:

- supplied or embedded video;
- scroll-linked or scrubbed media;
- sticky or pinned scrollytelling;
- continuous parallax;
- Lottie, Rive, canvas, WebGL, Three.js, or shader effects;
- time-driven carousels or staged transitions;
- behavior whose trigger or mechanism is ambiguous.

Use deterministic recordings plus DOM, scroll, media, canvas, and network telemetry.
A recording proves visible behavior, not the source implementation mechanism.

Required outputs:

- `motion-manifest.json`;
- `MOTION_AUDIT.md`;
- source metadata and hash for supplied video;
- timeline/contact-sheet artifacts;
- responsive and reduced-motion fallbacks;
- explicit unknowns and implementation readings.

## Stage 4: Freeze the specifications

Before any builder starts:

1. Complete page topology, tokens, assets, behavior, and motion artifacts.
2. Resolve or explicitly approve implementation-critical unknowns.
3. Freeze shared fonts, tokens, types, asset paths, and motion primitives.
4. Write one contract per component using
   `references/component-spec-template.md`.
5. Keep each executor packet bounded. Split a component when its contract cannot be
   understood and verified independently.

No builder may infer a missing color, asset, breakpoint, state, trigger, duration,
or content string.

## Stage 5: Build with Agent Harness

Keep shared foundation and integration with the root orchestrator.

When parallel work is useful:

1. commit the shared foundation;
2. create one branch and worktree per executor;
3. assign non-overlapping file ownership;
4. send the complete bounded packet in
   `references/executor-handoff-template.md`;
5. prohibit descendants and unrelated edits;
6. require the smallest useful checks and a committed handoff;
7. merge one branch at a time and verify after every merge.

Prefer server-rendered sections. Add the narrowest browser controller that can
reproduce the measured interaction. Select implementation from evidence:

- CSS for simple transitions and deterministic keyframes;
- IntersectionObserver or native scroll timelines for suitable reveal/progress
  behavior;
- GSAP/ScrollTrigger for complex orchestrated timelines or pins;
- media `currentTime` mapping for scrubbed video;
- Canvas/Three/WebGL only when the evidence requires it.

Always preserve keyboard and reduced-motion behavior.

## Stage 6: Assemble and verify

Assemble the page from the frozen topology and shared contracts. Then apply
`$clone-qa`.

Replay the same source and clone scenarios. Verify:

- static checkpoints and key geometry;
- typography, color, assets, and layering;
- responsive layouts and discovered breakpoints;
- every required interactive state;
- motion timing, scroll progress, trajectories, and fallback behavior;
- keyboard, touch, and reduced motion;
- lint, typecheck, build, runtime routes, and asset decoding.

Use masks for truly dynamic regions. Do not use full-frame pixel diff as the only
gate for video, particles, canvas, or WebGL.

Classify discrepancies as:

- extraction/specification defect;
- implementation defect;
- environment instability;
- approved deliberate difference;
- blocked by missing evidence.

Fix the source of the defect. Never weaken a specification to make an accidental
implementation pass.

## Stage 7: Adapt or blend

Only after the baseline passes:

1. apply `$blend-references`;
2. approve the reference ledger system by system;
3. preserve the baseline route or commit for comparison;
4. implement the adaptation in bounded worktrees;
5. run `$clone-qa` against the approved adaptation specification.

## Completion gate

Do not call the work complete until:

- every contract artifact exists and validates;
- every required state and critical asset is accounted for;
- all unapproved unknowns and invented decisions are resolved;
- static and motion gates pass or have explicit user-approved exceptions;
- implementation checks and runtime verification pass;
- the current Git diff contains only intended work;
- any deployment requested by the user is verified at its public route.

## Anti-patterns

- One long browser task covering every route and breakpoint.
- Static screenshots used as proof of interaction or motion.
- Video analysis used as proof of DOM or WebGL mechanism.
- Click-based reconstruction of a scroll-driven section.
- Approximate or generated assets substituted without approval.
- Client components added to entire sections for one small behavior.
- Multiple builders editing tokens, global CSS, motion primitives, or assembly.
- Blending references before a baseline or provenance ledger exists.
- Treating a builder report, local build, preview, or open browser tab as final
  delivery proof.
