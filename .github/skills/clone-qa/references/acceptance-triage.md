# Acceptance triage

Classify the evidence before assigning repair ownership.

## Classification

| Classification | Meaning | Normal action |
| --- | --- | --- |
| `implementation-defect` | The frozen specification is supported, but the clone diverges. | Fix implementation and replay the same gate. |
| `specification-defect` | Stronger source evidence contradicts or exposes an omission in the frozen specification. | Correct the specification through its authority process, then rebuild and replay. |
| `capture-defect` | Source and clone scenarios are not comparable or capture evidence is corrupted. | Repair capture and replay both sides. |
| `approved-difference` | An authorized, deliberate departure from the source. | Link the approval and exclude only its defined scope. |
| `unknown` | Available evidence cannot identify the defect class. | Mark blocked and collect evidence. |

An implementation failure is not resolved by loosening geometry, image, timing, or
scroll tolerances. A specification correction needs stronger evidence and an
authority artifact; it is not an acceptance shortcut.

## Severity

- `critical`: essential content, route, or interaction is unavailable, unsafe, or
  fundamentally wrong.
- `major`: a required state or high-priority visual or motion system fails.
- `minor`: a bounded visible discrepancy fails an approved gate without blocking
  the core task.
- `info`: a reviewed observation with no acceptance effect.

## Status

- `open`: confirmed work remains.
- `blocked`: evidence or authority is missing.
- `resolved`: the fix or correction has passed a replayed gate.
- `accepted`: a deliberate difference has approval provenance.

Never mark a discrepancy resolved from a code diff alone. Link replay evidence and
the affected gate. In `clone` mode, every invented behavior needs an approved
deliberate difference; otherwise final status is fail.

Final status is deterministic:

1. `fail` when a gate fails, a material discrepancy remains open, or a deliberate
   difference is unapproved;
2. otherwise `blocked` when a gate or discrepancy is blocked;
3. otherwise `pass`.
