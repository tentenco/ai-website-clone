# Website Inspection Guide

Use this guide as the human checklist around `$inspect-site` and `$audit-motion`.
The skills and their bundled schemas/scripts are the executable source of truth.

Read `docs/CLONE_WORKFLOW_V2.md` and create the target clone contract first.

## Scenario rule

Capture one viewport and one interaction family at a time. Persist every scenario
before starting the next one.

Minimum scenarios:

- initial viewport and full page;
- slow top-to-bottom scroll;
- header, navigation, and menus;
- tabs, accordions, carousels, modals, and other state families;
- hover, focus, keyboard, and touch;
- loading, empty, and error states;
- reduced motion;
- video, scroll-scrub, parallax, canvas, and WebGL when present.

Use desktop `1440px`, tablet `768px`, and mobile `390px` as minimum checkpoints,
then add breakpoints discovered from source behavior.

## Purpose and content

- Audience, primary outcome, and primary CTA
- Information hierarchy and route relationships
- Exact visible content and localization
- Claims, logos, testimonials, and assets that require client approval
- Content or behavior that depends on a backend or authenticated state

## Visual system

- Colors, gradients, transparency, filters, and blend modes
- Font files, families, weights, optical sizes, line heights, and tracking
- Spacing, container widths, grids, alignment, and section rhythm
- Borders, radii, shadows, clipping, masks, and pseudo-elements
- Fixed, sticky, absolute, portal, and stacking-context ownership
- Responsive changes and the actual switch points

## Components and states

For every component:

1. name and semantic structure;
2. variants and content states;
3. default, hover, focus, active, disabled, loading, empty, and error appearance;
4. click, keyboard, touch, scroll, time, and visibility triggers;
5. responsive behavior;
6. enter, exit, transition, replay, reset, and reduced-motion behavior;
7. exact assets and layered composition.

Identify the interaction model before implementation. A scroll-driven section is
not a click-based tab set merely because the visual states look similar.

## Assets

Inspect more than direct `src` attributes:

- `srcset`, `<picture>`, lazy data attributes, and current source selection;
- background images, CSS masks, pseudo-element images, and preload links;
- video `<source>` sets, posters, tracks, HLS/DASH/media-source requests;
- inline/external SVG, icon sprites, Lottie, Rive, and animation data;
- canvas and WebGL contexts;
- font files, manifests, favicons, and metadata images.

Record source URL, local path, type, dimensions/duration, hash when relevant, usage,
and redistribution restrictions.

## Motion

Escalate to `$audit-motion` for pinned, scrubbed, continuous, video, canvas, or
WebGL motion.

Capture both visible behavior and synchronized telemetry:

- time and normalized scroll progress;
- `scrollY`, element rectangles, computed transforms, opacity, and classes;
- sticky/pin start and end;
- media `currentTime`, paused/muted/loop state;
- animation name, play state, duration, delay, and easing;
- canvas/WebGL count and dimensions;
- relevant network resources and detected libraries.

Keep observed behavior separate from implementation reading. Use `unknown` when a
mechanism cannot be proven.

## Required outputs

Under `docs/research/<target>/`:

1. `CLONE_CONTRACT.md`
2. `REFERENCE_LEDGER.md` when more than one source is involved
3. `site-inspection.json`
4. `capture-scenarios.json`
5. `PAGE_TOPOLOGY.md`
6. `BEHAVIORS.md`
7. `motion-manifest.json` and `MOTION_AUDIT.md` when motion is in scope
8. `components/*.spec.md`
9. `qa/fidelity-report.json` and `qa/FIDELITY_REPORT.md`

Every material claim follows `docs/research/EVIDENCE_MODEL.md`.

## Pre-build gate

Do not dispatch a builder until:

- the relevant scenario artifacts exist;
- component content, assets, states, and responsive behavior are accounted for;
- motion triggers and fallbacks are specified;
- shared tokens, assets, types, and motion primitives are frozen;
- implementation-critical unknowns are resolved or explicitly approved.
