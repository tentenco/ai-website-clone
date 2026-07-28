# video-use timeline adapter

The optional adapter invokes video-use's `helpers/timeline_view.py` for one bounded
time range. The helper produces a filmstrip and waveform composite; it does not
instrument a webpage.

Official project: <https://github.com/browser-use/video-use>

## Resolution

Prefer an explicit helper path:

```bash
node .claude/skills/audit-motion/scripts/video-use-timeline.mjs \
  capture.mp4 12.5 16.0 --output verify/range.png \
  --timeline-view /absolute/path/video-use/helpers/timeline_view.py
```

Without `--timeline-view`, the adapter checks only these known locations:

- `$VIDEO_USE_TIMELINE_VIEW`;
- `.claude/skills/video-use/helpers/timeline_view.py`;
- `.codex/skills/video-use/helpers/timeline_view.py`;
- the matching skill paths under the current user's home directory;
- `Developer/video-use/helpers/timeline_view.py` under the current user's home.

It does not search the whole filesystem, clone a repository, install packages, or
run an arbitrary executable named `timeline_view`.

Use `--locate` to print the resolved helper without executing it. Use `--dry-run`
to inspect the exact Python invocation.

## Transcription boundary

`timeline_view.py` can render a video range without a transcript. Pass
`--transcript` only when word timing or speech pauses are material to the audit and
an existing transcript artifact is approved. The adapter never calls
transcription helpers and never checks for an ElevenLabs key.

For UI animation, scroll, parallax, canvas, and WebGL recordings, skip
transcription. A contact sheet plus synchronized runtime telemetry is the primary
surface.

## Evidence boundary

Treat the generated PNG as visual evidence. Pair it with DOM, scroll, media,
canvas, WebGL, or network telemetry from the deterministic browser harness before
making implementation or trigger claims.
