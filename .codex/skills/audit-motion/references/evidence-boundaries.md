# Evidence boundaries

Apply one evidence level to every material finding.

| Level | Use |
| --- | --- |
| `measured` | A numeric value captured from runtime, media metadata, telemetry, or deterministic comparison. |
| `observed` | Appearance or behavior directly visible in a recording, screenshot, DOM snapshot, network response, or interaction. |
| `inferred` | A supported but unproven explanation, usually an implementation reading. |
| `invented` | A new design or fallback allowed by the clone contract. |

Use `unknown` as status when evidence cannot support a conclusion.

## What each channel can prove

- Video or a contact sheet can prove visible ordering, appearance, and approximate
  frame timing. It cannot prove GSAP, CSS animation, IntersectionObserver,
  requestAnimationFrame, DOM ownership, or scroll-container identity.
- DOM and computed-style telemetry can prove sampled browser state. A changed
  transform does not by itself prove which library produced it.
- Scroll and media telemetry can prove sampled input/output pairs and support a
  scrub mapping within that scenario.
- Canvas/WebGL output captures prove rendered pixels. Wrapped calls, shader or
  resource observations, and runtime counters are needed for mechanism claims.
- Network telemetry proves requested resources and timing, not that every resource
  affected the visible frame.

## Observed source behavior versus implementation reading

Keep two records:

1. Source behavior: what changed, when, and under which capture conditions.
2. Implementation reading: the proposed mechanism or clone implementation.

Label the second independently. Do not upgrade an inferred mechanism because the
clone later uses that mechanism.

## Measurement uncertainty

Record sampling interval, frame rate, tolerance, clock offset, and dropped samples
that affect a value. Report a range or `unknown` when resolution is too coarse for
an exact duration or trigger.

## Common invalid upgrades

- "Looks eased" does not establish a named cubic-bezier.
- "Moves while scrolling" does not establish GSAP ScrollTrigger.
- "Video time changes" does not establish scroll scrubbing without paired scroll
  samples.
- "Canvas is present" does not establish WebGL.
- A desktop capture does not establish mobile or reduced-motion behavior.
