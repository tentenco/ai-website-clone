# Improvement Scorecard

This scorecard compares the preserved upstream
[`ai-website-cloner-template` snapshot](https://github.com/JCodesMore/ai-website-cloner-template/commit/58e00d5369181dc0b84b45a2a55e6f64a017f59b)
with AI Website Clone Engine
[`v0.1.0`](https://github.com/tentenco/ai-website-clone/releases/tag/v0.1.0).
The comparison was audited on 2026-07-29.

## Executive result

| Measure | Upstream snapshot | Enhanced workflow | Change |
| --- | ---: | ---: | ---: |
| Weighted workflow maturity | 41.5/100 | 85.0/100 | +43.5 points |
| Rounded public score | 42/100 | 85/100 | +43 points |
| Relative improvement | — | — | approximately +105% |

The enhanced workflow is approximately twice as mature for repeatable,
evidence-backed reconstruction. This is a repository and operating-system score,
not proof that every clone will be twice as accurate or take half as long.

## Method

Each category is scored from 0 to 10 and multiplied by its weight:

- `0–2`: absent or only mentioned;
- `3–4`: documented, mostly manual, and weakly repeatable;
- `5–6`: actionable with partial structure or validation;
- `7–8`: automated and tested in fixtures or bounded pilots;
- `9`: integrated with explicit gates and recovery boundaries;
- `10`: continuously benchmarked across a representative production corpus.

The scoring uses committed skills, scripts, schemas, tests, workflow files, and
pilot evidence. File volume does not earn points by itself.

## Weighted scorecard

| Capability | Weight | Upstream | Current | Weighted gain | Evidence for the change |
| --- | ---: | ---: | ---: | ---: | --- |
| Product intent, modes, and authority | 10 | 4/10 | 9/10 | +5.0 | One default clone flow became gated `clone`, `adapt`, and `blend` modes with contracts and authority order. |
| Static and responsive inspection | 15 | 7/10 | 9/10 | +3.0 | Strong computed-style guidance gained resumable scenarios, environment fields, machine-readable artifacts, and a browser probe. |
| Motion, video, and complex dynamics | 15 | 3/10 | 8/10 | +7.5 | Manual observation gained video probing, hashes, deterministic contact sheets, motion manifests, synchronized telemetry contracts, and a tested optional `video-use` adapter. |
| Evidence and reproducibility | 15 | 3/10 | 9/10 | +9.0 | Unlabeled prose became `measured`, `observed`, `inferred`, `invented`, or `unknown`, enforced through schemas and validators. |
| Deterministic QA and acceptance | 15 | 4/10 | 8/10 | +6.0 | Manual side-by-side review gained image masks, checkpoint tolerances, gate summaries, fidelity reports, and fail/blocked semantics. |
| Adaptation and reference blending | 10 | 2/10 | 8/10 | +6.0 | Optional customization became a post-baseline workflow with per-system provenance and an explicit reference ledger. |
| Agent orchestration and recovery | 10 | 7/10 | 9/10 | +2.0 | Existing parallel worktrees gained specification freeze, non-overlapping ownership, resumable capture, bounded handoffs, and root-only integration. |
| Automation and community maintenance | 10 | 3/10 | 8/10 | +5.0 | Basic build CI gained preflight/init tooling, skill synchronization checks, deterministic tests, CodeQL, dependency review, governance, and security workflows. |
| **Total** | **100** | **41.5** | **85.0** | **+43.5** | |

## Observable repository delta

| Evidence | Upstream | Current |
| --- | ---: | ---: |
| Canonical agent skills | 1 | 5 |
| Machine-readable workflow schemas | 0 | 4 |
| Deterministic skill tests | 0 | 24 passing |
| Explicit operating modes | 1 default flow | 3 gated modes |
| Motion toolchain | Manual browser observation | Probe, hash, contact sheet, manifest validation, telemetry, optional `video-use` adapter |
| QA contract | Manual visual comparison | Image, geometry, timing, scroll, report, and blocked-gate validation |
| Public governance | Basic issue forms and CI | Contribution, conduct, support, security, ownership, release, dependency, and code-scanning controls |

The current tree is larger because every canonical skill is synchronized to
multiple agent platforms. Generated copies demonstrate distribution coverage, not
independent capability, so they are not counted as separate features.

## Where the improvement is strongest

1. **Unknowns are now explicit.** Missing evidence cannot silently become a guessed
   implementation or a passing result.
2. **Motion is an analyzable artifact.** Video, parallax, sticky sections,
   scroll-scrub, canvas, and WebGL have a dedicated contract and deterministic
   preprocessing path.
3. **QA has executable boundaries.** Geometry, timing, normalized scroll, dynamic
   masks, and report consistency can fail automatically.
4. **Clone and redesign no longer blur together.** Adaptation or multi-reference
   blending starts only after the baseline clone passes.
5. **Agent execution is recoverable.** Scenario persistence and bounded worktrees
   reduce the cost of browser, agent, or merge failures.

## What is not proven yet

- There is no representative, versioned corpus showing end-to-end fidelity,
  duration, token usage, and human rework against the upstream workflow.
- Browser capture still needs per-run adapter orchestration; the repository
  includes probes and artifact contracts, not a fully autonomous scenario runner.
- The real `video-use` Python helper is optional and was not installed during the
  recorded pilot. Path resolution and dry-run compatibility are tested.
- Canvas, WebGL, cross-origin assets, authenticated states, and unstable live
  content still require project-specific handling.
- Passing validators proves contract consistency, not design approval or legal
  permission to reproduce a source.

These boundaries are why the current score is 85 rather than 95 or higher.

## Prioritized optimization roadmap

### P0 — Establish empirical clone benchmarks

Create a versioned benchmark corpus with at least six authorized references:
static editorial, ecommerce, application UI, video-led storytelling,
parallax/pinned motion, and canvas/WebGL. Store golden scenarios for desktop,
tablet, mobile, keyboard, touch, and reduced motion.

Track:

- pixel and masked-region error;
- typography and geometry deviation;
- state and asset coverage;
- motion timing and trajectory deviation;
- elapsed time, retries, token/tool usage, and human correction time.

Run both the upstream snapshot and current workflow against the same corpus. This
would turn the scorecard from a maturity estimate into an outcome benchmark.

### P0 — Build an end-to-end scenario runner

Create one adapter-neutral command that consumes `capture-scenarios.json`, drives
the selected browser, and persists screenshots, DOM/style vectors, network/media
evidence, telemetry, retries, and resume state. The current probe should become one
adapter behind this runner.

### P0 — Productize the `video-use` path

Add pinned version detection, an isolated optional environment, checksum and
capability reporting, deterministic timeline export, and a fallback contract.
Keep transcription opt-in because silent interface motion does not require it.

### P1 — Improve perceptual and motion comparison

Add perceptual image scoring alongside raw pixel error, font-rendering
normalization, trajectory sampling for transforms and media time, and
human-review frames around threshold failures. Never let a perceptual score hide
a missing component or required state.

### P1 — Add asset provenance and rights automation

Generate an asset manifest with source URL, content hash, media metadata, local
path, usage, license/redistribution status, and approval state. Block public
delivery when a required asset has unknown rights.

### P1 — Publish a benchmark gallery

Provide small, authorized examples with the source contract, evidence artifacts,
implementation, QA report, known differences, and runtime. This is the most useful
proof for contributors and makes regressions easier to discuss.

### P2 — Lower the contribution barrier

Add a one-command project initializer, adapter interface documentation, RFC
templates, maintainer rotation guidance, and good-first-issue fixtures. Consider a
separate installable CLI only after the contracts stabilize.

## Recommended next milestone

For `v0.2.0`, focus on four deliverables:

1. a six-site authorized benchmark corpus;
2. an adapter-neutral scenario runner;
3. a reproducible `video-use` integration path;
4. a CI-generated benchmark report with regression thresholds.

Completing those items would reasonably move workflow maturity from **85** toward
**92–94**, while also producing the evidence needed to report actual fidelity and
productivity gains.
