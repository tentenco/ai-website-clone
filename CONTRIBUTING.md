# Contributing

Thanks for helping improve AI Website Clone Engine. Contributions are welcome
across inspection adapters, evidence contracts, motion analysis, fidelity QA,
documentation, and the Next.js scaffold.

## Before opening an issue

- Use [GitHub Discussions](https://github.com/tentenco/ai-website-clone/discussions)
  for questions, implementation ideas, and workflow design.
- Search existing issues before opening a new report.
- Do not include client credentials, private URLs, authentication state, personal
  data, or unlicensed assets.
- Use private vulnerability reporting for security-sensitive findings.

## Development setup

Requirements:

- Node.js 24 or newer
- npm
- Git with worktree support
- `ffmpeg` and `ffprobe` for motion-related work

```bash
git clone https://github.com/tentenco/ai-website-clone.git
cd ai-website-clone
npm ci
npm run preflight
npm run check
```

Read `AGENTS.md`, `docs/CLONE_WORKFLOW_V2.md`, and
`docs/research/EVIDENCE_MODEL.md` before changing the workflow.

## Sources of truth

| Content | Canonical source | Regenerate with |
| --- | --- | --- |
| Agent instructions | `AGENTS.md` | `bash scripts/sync-agent-rules.sh` |
| Agent skills | `.claude/skills/*` | `npm run sync:skills` |

Do not edit generated platform copies directly.

## Pull request workflow

1. Create a focused branch from `main`.
2. Keep unrelated changes out of the branch.
3. Add or update tests for contract, schema, validator, or behavior changes.
4. Update documentation when a public command, artifact, or workflow changes.
5. Regenerate instruction and skill outputs when their canonical sources change.
6. Run `npm run check`.
7. Open a pull request using the repository template.

For Agent Harness work, each executor must use its own branch and worktree with
non-overlapping file ownership. The root orchestrator owns shared contracts,
integration, and final verification.

## Evidence standards

Changes to reconstruction logic must preserve the evidence boundary:

- `measured` for deterministic numeric or runtime facts;
- `observed` for directly captured behavior;
- `inferred` for supported but unproven implementation readings;
- `invented` only when the active contract allows a new decision.

Do not weaken a schema or acceptance threshold just to make an accidental output
pass. Add a fixture that demonstrates the intended boundary.

## Commit and review expectations

- Use clear, imperative commit messages.
- Keep pull requests small enough to review meaningfully.
- Explain the user impact and validation evidence.
- Resolve review threads and keep the branch current.
- Accept that maintainers may request a design discussion before large workflow
  changes.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
