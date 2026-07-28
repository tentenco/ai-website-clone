<!-- AUTO-GENERATED from AGENTS.md — do not edit directly.
     Run `bash scripts/sync-agent-rules.sh` to regenerate. -->

---
description: Project conventions for AI Website Clone Template
alwaysApply: true
---
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tenten Website Clone Engine

## What This Is
An evidence-driven system for reconstructing, validating, adapting, and blending
production website references with AI coding agents. It combines a Next.js
scaffold with resumable inspection, motion forensics, explicit provenance,
contract-frozen implementation, and deterministic fidelity QA. Start with
`/clone-website <url1> [<url2> ...]`.

## Tech Stack
- **Framework:** Next.js 16 (App Router, React 19, TypeScript strict)
- **UI:** shadcn/ui (Radix primitives, Tailwind CSS v4, `cn()` utility)
- **Icons:** Lucide React (default — will be replaced/supplemented by extracted SVGs)
- **Styling:** Tailwind CSS v4 with oklch design tokens
- **Deployment:** Vercel

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `npm run typecheck` — TypeScript check
- `npm run check` — Run lint + typecheck + build

## Code Style
- TypeScript strict mode, no `any`
- Named exports, PascalCase components, camelCase utils
- Tailwind utility classes, no inline styles
- 2-space indentation
- Responsive: mobile-first

## Design Principles
- **Pixel-perfect emulation** — match the target's spacing, colors, typography exactly
- **No personal aesthetic changes during emulation phase** — match 1:1 first, customize later
- **Real content** — use actual text and assets from the target site, not placeholders
- **Beauty-first** — every pixel matters

## Clone Workflow V2
- Read `docs/CLONE_WORKFLOW_V2.md` before running or changing the clone pipeline.
- Every target starts with `docs/research/<target>/CLONE_CONTRACT.md`.
- Treat `clone`, `adapt`, and `blend` as different modes. A baseline clone must pass
  its approved QA gates before adaptation or multi-reference blending.
- Label material findings as `measured`, `observed`, `inferred`, or `invented`
  according to `docs/research/EVIDENCE_MODEL.md`.
- Split browser reconnaissance into short, resumable capture scenarios. Persist
  artifacts after every scenario instead of relying on one long browser task.
- Use deterministic motion capture plus DOM/scroll/media/canvas/network telemetry
  for video, parallax, scroll-scrub, canvas, or WebGL references.
- Do not dispatch a builder until its component and motion contracts are frozen.
- Keep shared foundation and final integration with the root orchestrator.
- When using agent teams, give every teammate a separate worktree branch and
  non-overlapping file ownership. Teammates must not spawn descendants.

## Project Structure
```
src/
  app/              # Next.js routes
  components/       # React components
    ui/             # shadcn/ui primitives
    icons.tsx       # Extracted SVG icons as React components
  lib/
    utils.ts        # cn() utility (shadcn)
  types/            # TypeScript interfaces
  hooks/            # Custom React hooks
public/
  images/           # Downloaded images from target site
  videos/           # Downloaded videos from target site
  seo/              # Favicons, OG images, webmanifest
docs/
  research/         # Inspection output (design tokens, components, layout)
  design-references/ # Screenshots and visual references
scripts/            # Asset download scripts
```

## MOST IMPORTANT NOTES
- When launching Claude Code agent teams, ALWAYS have each teammate work in their own worktree branch and merge everyone's work at the end, resolving any merge conflicts smartly since you are basically serving the orchestrator role and have full context to our goals, work given, work achieved, and desired outcomes.
- After editing `AGENTS.md`, run `bash scripts/sync-agent-rules.sh` to regenerate platform-specific instruction files.
- After editing `.claude/skills/clone-website/SKILL.md`, run `node scripts/sync-skills.mjs` to regenerate the skill for all platforms.

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
