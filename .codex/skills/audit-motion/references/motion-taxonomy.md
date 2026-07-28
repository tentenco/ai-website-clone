# Motion taxonomy

Classify what drives the visible change before choosing an implementation.

| Family | Evidence to record | Typical event mode |
| --- | --- | --- |
| Entrance, exit, state change | trigger, state A/B, delay, duration, easing, stagger | discrete |
| Sticky or pinned scene | pin start/end, owner, containing block, z-order | continuous or discrete |
| Parallax | scroll range and each layer's transform trajectory | continuous |
| Scroll progress | scroll container, start/end anchors, normalized mapping | continuous |
| Scrubbed media | scroll progress and `currentTime` pairs, clamp behavior | continuous |
| Carousel or autoplay | timer/input trigger, active state, interruption rules | discrete |
| Canvas or WebGL | canvas bounds, frame checkpoints, runtime calls/counters | continuous |
| Hover, focus, pointer | input state, state A/B, duration, cancellation | discrete |

## Continuous versus discrete

- Mark an event `continuous` when output is a function of scroll, pointer, media,
  or another continuously sampled input. Record several input/output pairs; two
  endpoints cannot establish the mapping curve.
- Mark an event `discrete` when one trigger starts a bounded transition. Record
  trigger time, state A/B, duration, easing, delay, and stagger.
- Split a scene when it contains both. A sticky boundary is often discrete while
  the transform inside the sticky range is continuous.

## State snapshots

Describe visible states as property observations, not implementation code. Useful
properties include bounding box, transform matrix, opacity, clip or mask,
background, filter, active content, media time, and canvas frame hash. Attach the
selector or canvas region and units.

## Timing and easing

Use telemetry or deterministic frame measurement for numeric timing. If an easing
name comes only from curve shape, label it `inferred`; if computed CSS or runtime
configuration exposes it, cite that telemetry. Use `unknown`, not a familiar
default, when the curve cannot be distinguished.

## Scroll coordinates

Record both raw and normalized coordinates:

```text
progress = (scrollPx - startPx) / (endPx - startPx)
```

State the scroll container, clamp behavior, viewport, document height, and any
smooth-scroll proxy. Never compare normalized checkpoints from different
containers as if they shared one coordinate system.

## Responsive and reduced motion

Audit each approved viewport independently. A missing mobile capture is not
evidence that desktop behavior carries over. Test the actual
`prefers-reduced-motion: reduce` state and record whether essential information is
preserved, motion is shortened, replaced, or disabled.
