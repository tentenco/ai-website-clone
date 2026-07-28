# Capture telemetry

Use one short, deterministic scenario per viewport and interaction family. Start
video and telemetry from the same harness, include a shared run identifier, and
emit synchronization markers at scenario start and end.

## Capture envelope

Record:

- source URL, capture time, scenario, viewport, device pixel ratio, user agent,
  reduced-motion setting, and run identifier;
- wall-clock and monotonic timestamps;
- viewport scroll plus discovered element scroll containers;
- sampled DOM state for explicitly allowlisted selectors;
- media state, canvas/WebGL signals, network resources, and scenario actions.

Keep captures resumable. Persist each scenario before starting another.

## Channel guidance

### DOM

Sample bounding boxes, computed transform, opacity, position, overflow, sticky
ownership, relevant CSS custom properties, and class/attribute changes. Observe
only contract selectors; broad mutation dumps are noisy and can capture private
content.

### Scroll

Record `scrollX`, `scrollY`, scroll container dimensions, element anchors, and
normalized progress. Include input actions and settle points. When smooth scrolling
is active, record requested position separately from observed position.

### Media

For every relevant media element record source URL, ready state, paused/ended,
playback rate, duration, `currentTime`, seek events, and decoded-frame counters
when available. Pair `currentTime` with scroll progress to establish a scrub
mapping.

### Canvas and WebGL

Record canvas dimensions, CSS bounds, frame timestamps, and deterministic
checkpoint screenshots or region hashes. Wrap only the narrow APIs needed for the
scenario, such as `requestAnimationFrame`, `drawImage`, WebGL draw-call counts, or
uniform values. A frame capture can prove output; a wrapped call can support a
mechanism claim.

### Network

Record request time, URL, resource type, status, transfer size, cache source, and
initiator where available. Inventory video segments, manifests, shaders, models,
textures, Lottie/Rive files, and lazy-loaded media. Redact credentials, cookies,
query secrets, and response bodies that are not needed.

## Synchronization

Use a shared monotonic origin where the harness allows it. Otherwise record an
explicit visible marker and telemetry marker in the same action, then document the
measured offset and uncertainty. Do not silently align channels by nearest-looking
frame.

## Sampling

Use stable scenario steps and a declared sampling interval. Add exact samples at
trigger boundaries and QA checkpoints. Browser paint, video frame, and telemetry
clocks may differ; retain raw timestamps and document conversion instead of
discarding them.

## Failure handling

If a channel drops samples, navigation resets the clock, cross-origin media hides
state, or browser automation changes input timing, preserve the partial artifact
and add an `unknown`. Re-run only that scenario.
