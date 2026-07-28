# Browser probe and adapter guidance

## Contents

- [Adapter selection](#adapter-selection)
- [Deterministic setup](#deterministic-setup)
- [Run the scripts](#run-the-scripts)
- [What the probe can and cannot prove](#what-the-probe-can-and-cannot-prove)
- [Asset and motion follow-up](#asset-and-motion-follow-up)

## Adapter selection

Use Agent Browser first when installed. Keep the scenario steps and artifact
contract independent of its command syntax. Fall back to another available browser
adapter when Agent Browser cannot provide a required operation:

- pre-navigation/evaluate-on-new-document scripts;
- exact viewport, touch, color scheme, or reduced-motion emulation;
- JavaScript evaluation that returns JSON;
- screenshot, video, trace, network, or frame capture;
- deterministic input, scroll, animation, canvas, or WebGL telemetry.

Do not switch adapters midway without appending a new attempt and recording the
adapter in the attempt or artifact metadata. Different adapters may alter viewport
chrome, font rasterization, input modality, or timing.

## Deterministic setup

Before each attempt:

1. Apply the declared viewport, device scale, touch, reduced-motion, and color
   scheme.
2. Apply the declared cookie/storage state or clear it.
3. Install `scripts/browser-telemetry-init.js` as an init script before navigation
   for canvas, WebGL, scroll, and media scenarios.
4. Navigate directly to the declared route.
5. Wait for explicit DOM, font, image decode, media-ready, and network conditions.
   Record any unavoidable time delay as a scenario step.
6. Use declared mouse coordinates, selectors, keys, scroll increments, and
   checkpoint positions. Reset to the same route and state before a retry.

The telemetry init hook is idempotent. It records every observed context creation
and event without a fixed event cap. Install it before application code; evaluating
it after load cannot recover canvas/WebGL contexts already created.

## Run the scripts

Read each bundled file as text. Configure the probe in the page:

```js
globalThis.__INSPECT_SITE_OPTIONS__ = {
  scenario: "desktop-slow-scroll",
  adapter: "agent-browser@0.33.0"
};
```

Optionally set `rootSelector` only for a contract-approved subtree. Set
`includeFormValues: true` only when the contract explicitly permits capturing
default form values; passwords and entered private data must never be collected.

Evaluate the complete contents of `scripts/browser-probe.js` as one JavaScript
expression. Adapters that accept string evaluation can evaluate the file directly.
Adapters that require a callback can return the evaluated trusted local source.
Await the result if the adapter wraps evaluation in a promise, then serialize the
returned object directly to:

```text
docs/research/<target>/captures/<scenario-id>.json
```

Do not stringify inside the page unless the adapter cannot return structured JSON.
Do not prune nodes, children, style values, resource entries, or telemetry. Use
separate scenarios or a declared `rootSelector` when artifact size is operationally
unmanageable.

### Tested Agent Browser recipe

Obtain the installed version with `agent-browser --version` and put that exact value
in the `adapter` option and scenario attempt. Launch a clean session so the telemetry
hook runs before the first target navigation:

```bash
agent-browser --session <session-id> \
  --init-script .claude/skills/inspect-site/scripts/browser-telemetry-init.js open
agent-browser --session <session-id> set viewport 1440 900 2
agent-browser --session <session-id> set media light
agent-browser --session <session-id> open https://example.com
agent-browser --session <session-id> wait --load domcontentloaded
agent-browser --session <session-id> eval \
  "globalThis.__INSPECT_SITE_OPTIONS__ = { scenario: 'desktop-initial', adapter: 'agent-browser@<version>' }; true"
agent-browser --session <session-id> eval --stdin \
  < .claude/skills/inspect-site/scripts/browser-probe.js
agent-browser --session <session-id> close
```

For a reduced-motion scenario, use
`agent-browser set media light reduced-motion` before navigation. Persist the eval
result through the orchestration adapter or redirect the raw CLI JSON to the
scenario's declared capture path, then validate it before proceeding. Never rely on
terminal output that was truncated.

The probe returns a style dictionary in `styleProperties`; every node and generated
pseudo-element stores an aligned value vector. DOM records are flat preorder and
include open shadow roots. Closed shadow roots and iframe documents require
separate frame-scoped evidence or an unknown.

## What the probe can and cannot prove

The probe directly measures:

- current DOM structure, attributes, direct text, rectangles, and visibility;
- computed style values and visible `::before`/`::after` generated content;
- current focus, focus-within, hover, target, checked, selected, open, disabled,
  readonly, required, and ARIA state;
- readable media queries, root CSS variables, and `@font-face` URLs;
- current image selection, media state, Resource Timing, Web Animations timing,
  and document scroll geometry;
- canvas/WebGL context creation observed by the init hook.

It does not prove:

- that a framework or motion library owns visible behavior;
- the source code behind cross-origin stylesheets, closed shadow roots, iframes, or
  inaccessible network responses;
- shader source, every draw call, or pixels previously rendered before the init
  hook;
- hover/focus styles not activated in the current checkpoint;
- all lazy assets before their trigger region or state is visited.

Capture baseline and activated checkpoints separately. Compare the style vectors
for the same stable selector, then express the material delta as a labeled finding.

## Asset and motion follow-up

The probe inventories `currentSrc`, `srcset`, `<picture>` sources, video/audio
sources and posters, tracks, CSS `url()` values including masks, font faces,
manifests, likely Lottie/Rive elements and data, canvas, WebGL, iframes, and loaded
resources. Complete the inventory by:

- scrolling every lazy region and activating deferred states;
- preserving network request/response metadata allowed by the contract;
- downloading permitted binary evidence and recording SHA-256;
- using `ffprobe` for codec, dimensions, duration, frame rate, and streams;
- recording poster versus first-frame behavior and autoplay/mute/loop rules;
- capturing Lottie JSON or Rive binary metadata without claiming the player engine
  solely from an extension;
- pairing motion video with timestamps, normalized scroll positions, animation
  timing, media time, and context telemetry.

A recording supports what moved. DOM and runtime telemetry can support how it was
driven. Keep those claims separate until both evidence streams agree.
