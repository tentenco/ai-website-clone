# Workflow V2 Pilot Validation

Date: 2026-07-29  
Branch: `tenten/workflow-v2`

These pilots forward-test the skills as a user would use them. They are workflow
validation, not approval of the referenced client sites or implementations.

## Static and legacy research

Seven legacy SevenLab research files were reviewed as a migration case. Their page
topology, component inventory, design tokens, and behavior notes remain useful as a
recapture checklist, but they cannot become V2 measured or observed evidence without
fabricating provenance.

Missing authority and evidence included:

- clone contract, approved mode, rights, routes, and acceptance gates;
- viewport height, DPR, color scheme, reduced-motion, and touch conditions;
- scenario IDs, exact capture timestamps, selectors, and raw capture artifacts;
- screenshots, network traces, and source-versus-adaptation separation.

The correct result is a blocked recapture plan. The legacy `sevenlab.ai` directory
name must also be mapped to a valid target slug such as `sevenlab-ai`.

The bundled fixtures validated, the malformed fixture failed, and merging the same
resumed capture twice deterministically retained one capture.

## Live browser probe

A public `https://example.com/` smoke run used Agent Browser with the telemetry init
script installed before navigation at a `1280×800@1` viewport.

The probe returned:

- 12 flat-preorder DOM nodes with stable parent references;
- aligned computed-style vectors;
- route, capture time, viewport, state, and scroll metadata;
- no truncated traversal or runtime exception.

This confirms that the probe executes through the preferred browser adapter, not
only inside offline fixtures. It does not replace a contracted real-site capture.

## Real video and motion

The AMED reference video pilot measured:

- SHA-256:
  `c29d380c21da47c6db8411dce889b29a72d5c2a4aa3238361957a3e905dbcae3`;
- 3,717,747 bytes and 13.951667 seconds;
- H.264 at 1670×1080, 30 fps, 417 frames;
- AAC LC stereo audio at 48 kHz.

The workflow produced a 12-sample, 4×3 contact sheet and timeline metadata. Source
hashes matched before and after processing. A representative manifest passed with
artifact existence, byte-size, and SHA-256 checks.

The optional `video-use` adapter correctly stopped when an approved
`timeline_view.py` installation was unavailable. It did not install dependencies or
request transcription. The bundled contact-sheet path remained usable.

Without synchronized browser telemetry, the pilot intentionally left triggers,
scroll mapping, easing, responsive behavior, reduced motion, and mechanism claims as
unknown.

## QA and WebGL

Past AMED visual artifacts exercised deterministic QA:

| Check | Result |
| --- | --- |
| Identical image, MAE 0 with 0.01 threshold | Pass |
| Material color change, MAE 0.143858 | Fail |
| Geometry/timing/scroll values on the configured boundary | Pass |
| Values over the configured boundary | Fail |
| Fidelity report validation | Pass |
| Gate summary with failing and blocked gates | Valid summary, failing acceptance |

The WebGL motion audit maps into hero geometry, pinning, normalized scroll, and
time-frozen pixel-band checkpoints. It remains blocked for final acceptance because
it lacks source/clone replay pairs, numeric trajectories, canvas hashes, an exact
capture timestamp, and a reduced-motion run.

## Defects found and corrected

Fresh-agent use exposed defects that author-side tests had missed:

1. Inspect and motion validators accepted unknown properties despite canonical
   schemas declaring `additionalProperties: false`. Both now run structural JSON
   Schema validation before semantic and artifact checks.
2. Inspect attempts required an adapter in prose but had no schema field. Scenario
   attempts and raw captures now record the exact browser adapter/version.
3. Viewport environment fields were described as complete but optional. DPR,
   reduced-motion preference, color scheme, and touch capability are now required.
4. Clone-mode invented-evidence errors used filtered indexes instead of original
   array indexes. Error paths now point to the real artifact entry.
5. Legacy research now has an explicit recapture boundary instead of being silently
   promoted into stronger evidence.

## Remaining boundaries

- The real `video-use` Python helper was not installed, so only explicit-path
  resolution and dry-run compatibility are automated in this repository.
- Browser rasterization and third-party cross-origin boundaries still require
  per-project evidence and unknown tracking.
- A passing tool run does not approve a clone. Final acceptance still requires the
  contracted source/clone scenarios and human review.
