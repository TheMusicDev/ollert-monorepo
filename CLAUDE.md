# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Ollert is

Stripped-down Trello clone: CakePHP backend, Supabase Auth, Vite+React frontend. Full shape: `planning/architecture.md`.

## Project status

Planning-only repository — `/api` and `/web` are not scaffolded yet. No build/lint/test commands exist. Update this file once code exists.

## Open Knowledge Format (OKF)

`planning/` is an OKF v0.2 bundle — project knowledge stored as linked markdown "concepts" with YAML frontmatter, structured so both humans and agents can navigate it predictably. Spec: https://raw.githubusercontent.com/GoogleCloudPlatform/knowledge-catalog/refs/heads/main/okf/SPEC.md. Bundle entry point / table of contents: `planning/index.md`.

Validate after any edit to `planning/`:
```
python3 ~/.claude/skills/okf/okf/scripts/validate_okf.py planning --strict
```

## Where to find things

Don't duplicate bundle content here — read it directly:

- Stack, repo layout, auth flow, CORS, deployment → `planning/architecture.md`
- MySQL schema, quotas → `planning/data-model.md`
- REST endpoints, authorization rules, error envelope → `planning/api-contract.md`
- MVP scope, phases, testing strategy → `planning/roadmap.md`
- Full running decisions log (the *why* behind everything) → `planning/log.md`

Useful anchors:
- `planning/architecture.md#auth-flow`
- `planning/architecture.md#cors`
- `planning/architecture.md#deployment`
- `planning/data-model.md#quotas`
- `planning/api-contract.md#error-response-shape`
- `planning/roadmap.md#testing-strategy`
- `planning/roadmap.md#key-decisions-log`

Check `planning/log.md` before treating any decision as arbitrary or open for silent revision.

## Git: never commit or push without being asked

Do not run `git add`, `git commit`, `git push`, or anything that stages/commits/pushes, unless explicitly told to in that turn. "Fix X" / "update the docs" is not authorization to commit — make the edits, leave them in the working tree, stop.

## Living document

This file grows as we work. When you hit a non-obvious gotcha, get corrected on an approach, or notice a recurring preference, append a dated one-liner under **Learnings & Corrections** below — enough to say what and why, not a story. Don't duplicate anything already in the OKF bundle; link to it instead if relevant.

### Learnings & Corrections

_(none yet)_
