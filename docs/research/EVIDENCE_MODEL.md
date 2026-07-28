# Evidence Model

## Evidence levels

Use exactly one level for every material finding:

| Level | Meaning | Allowed implementation use |
| --- | --- | --- |
| `measured` | Captured numerically from runtime, media metadata, or deterministic comparison. | Authoritative within the recorded scenario. |
| `observed` | Directly visible in a screenshot, recording, DOM, network response, or interaction. | Authoritative for appearance or behavior, not necessarily mechanism. |
| `inferred` | Best explanation supported by evidence but not directly proven. | May guide implementation only when labeled and reviewed. |
| `invented` | New design or fallback not present in the source evidence. | Allowed only by the selected mode and clone contract. |

Use `unknown` as a status when available evidence cannot support a conclusion. Do
not convert an unknown into an inference merely to unblock a builder.

## Required evidence fields

Machine-readable findings must include:

```json
{
  "level": "measured",
  "claim": "The hero stage becomes sticky after 1350px.",
  "source": {
    "url": "https://example.com/",
    "capturedAt": "2026-07-29T00:00:00.000Z",
    "viewport": {
      "width": 1440,
      "height": 900,
      "deviceScaleFactor": 2,
      "reducedMotion": "no-preference",
      "colorScheme": "light",
      "hasTouch": false
    },
    "scenario": "desktop-slow-scroll",
    "selector": "[data-hero-stage]",
    "artifact": "docs/design-references/example/motion/desktop-slow-scroll.mp4"
  },
  "measurement": {
    "name": "stickyStartPx",
    "value": 1350,
    "unit": "px"
  }
}
```

Omit `selector` or `measurement` only when they do not apply. Human-readable
artifacts must preserve the same source boundary in prose or tables.

## Legacy research migration

Old prose, screenshots without capture metadata, and prior implementation notes are
not a fifth evidence level. Treat them as a recapture checklist:

- keep directly traceable material as a source pointer, not a measured finding;
- move unverified claims into open unknowns with implementation impact;
- separate prior client adaptations into `invented` decisions authorized by an
  `adapt` or `blend` contract;
- recapture before promoting a claim to `measured` or `observed`.

Do not fabricate timestamps, selectors, viewport environment, scenarios, or
artifact paths merely to make legacy notes validate.

## Rules

- Preserve source URLs and capture time; never rely on an unlabeled screenshot.
- Record viewport and scenario for responsive or stateful claims.
- A rendered video can prove visible motion but not the source implementation.
- DOM telemetry can support mechanism claims but does not replace visual review.
- Keep source behavior and implementation reading in separate fields or columns.
- Hash downloaded or supplied binary sources used for motion or asset analysis.
- Record privacy or redistribution restrictions in the clone contract and asset
  manifest.
