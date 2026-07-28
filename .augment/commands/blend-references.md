---
description: "Combine approved information architecture, layout, brand, content, interaction, or motion systems from multiple website references with explicit provenance. Use when the user asks to mix, blend, adapt, take inspiration from, or combine ideas from multiple sites after a measurable baseline clone or reference audit exists."
argument-hint: "<target>"
---
<!-- AUTO-GENERATED from .claude/skills/blend-references/SKILL.md. Do not edit directly. Run `node scripts/sync-skills.mjs` to regenerate. -->

Canonical bundled resources live under `.claude/skills/blend-references/`. Resolve relative scripts and references from that directory.


# Blend References

Blend systems deliberately. Do not treat multiple URLs as permission to merge their
styles, and do not obscure which decisions came from which source.

## Required inputs

- `docs/research/<target>/CLONE_CONTRACT.md`
- `docs/research/<target>/REFERENCE_LEDGER.md`
- the baseline `qa/FIDELITY_REPORT.md` or approved reference audits
- client brand, content, product, accessibility, and performance requirements

If these files are missing, create them from `docs/research/templates/` before
implementation.

## Gates

1. Require `mode: adapt` or `mode: blend` in the clone contract.
2. Require the baseline clone to pass its approved QA gates. If the work is
   reference-only, require an approved evidence set for every borrowed system.
3. Require one authoritative source or an explicitly approved invention for each
   system in the reference ledger.
4. Stop on unresolved brand, rights, or source-priority conflicts.

## Workflow

### 1. Assign systems

Complete one ledger row for each material system:

- information architecture and narrative;
- layout, spacing, and responsive behavior;
- typography and brand;
- images, video, and art direction;
- interaction model;
- motion grammar;
- content pattern.

Never use a vague row such as "overall look." Split it into reviewable systems.

### 2. Write the adaptation specification

For every affected component, state:

- what remains invariant from the baseline;
- what changes;
- the reference and evidence for the change;
- whether the decision is `measured`, `observed`, `inferred`, or `invented`;
- responsive, interaction, motion, and reduced-motion consequences;
- the exact owned files.

Prefer a separate preview route or branch until the user approves replacement of an
existing surface.

### 3. Build with bounded ownership

- Freeze shared brand and motion primitives before dispatching component work.
- Preserve the baseline route or commit as comparison evidence.
- Give agent builders non-overlapping worktrees and component contracts.
- Do not copy proprietary source code, shaders, fonts, or unlicensed assets.

### 4. Verify

- Run `$clone-qa` against the approved adaptation specification.
- Recheck narrative comprehension, brand consistency, keyboard behavior, responsive
  behavior, reduced motion, and performance.
- Verify every ledger row against the implementation.
- Record deliberate differences separately from defects.

## Prohibited shortcuts

- Do not customize during the baseline clone.
- Do not average incompatible visual systems into a generic style.
- Do not replace approved client content with reference-site claims.
- Do not present inferred responsive or interactive behavior as observed.
- Do not close QA by updating the specification to match an accidental
  implementation.
