# Setting up PR-Agent (with OpenRouter's free tier)

Portable setup notes for wiring [PR-Agent](https://github.com/The-PR-Agent/pr-agent) into a repo's CI as an automated code reviewer, running on OpenRouter's free-tier models instead of a paid API key. Written up after getting this working (and un-breaking it twice) on `ollert-monorepo` — see that repo's `.github/workflows/pr_agent.yml` and `.pr_agent.toml` for a working example.

## Overview

- Action: **`the-pr-agent/pr-agent@main`** — a community-maintained, bring-your-own-key fork. Deliberately *not* `qodo-ai/pr-agent`: the official upstream action now steers toward Qodo's own hosted, rate-limited free tier instead of a self-hosted key.
- Provider: **OpenRouter**, using `openrouter/free` — OpenRouter's own auto-router across whatever free-tier models are currently live. This maximizes free token throughput without pinning to one model that might get rate-limited or deprecated; OpenRouter rotates the pool for you.
- Two config surfaces, kept in sync: a `.github/workflows/pr_agent.yml` env-var block and a `.pr_agent.toml` at the repo root. Both are explained below — they're not redundant, see [Why two config files](#why-two-config-files-toml--env-vars).
- Cost: $0. No payment method needed on OpenRouter for free-tier models.

## Prerequisites

1. An OpenRouter account and API key: [openrouter.ai/keys](https://openrouter.ai/keys) → **Create Key**. Free-tier models need no credits or payment method.
2. Add it as a repo secret: **Settings → Secrets and variables → Actions → New repository secret**, name `OPENROUTER_API_KEY`.

## Setup

### 1. `.github/workflows/pr_agent.yml`

```yaml
name: PR-Agent review

on:
  pull_request:
    types: [opened, reopened, ready_for_review, synchronize]
  issue_comment:

permissions:
  contents: write
  pull-requests: write
  issues: write
  checks: write

jobs:
  pr_agent_job:
    if: ${{ github.event.sender.type != 'Bot' }}
    runs-on: ubuntu-latest
    name: Run PR-Agent on every pull request, respond to user comments
    steps:
      - name: PR Agent action step
        # Pin to a commit SHA, not @main — this job runs with write
        # permissions and your repo's GITHUB_TOKEN, and issue_comment lets
        # any non-bot commenter trigger it. Check
        # https://github.com/The-PR-Agent/pr-agent/commits/main for the
        # latest commit and bump deliberately.
        uses: the-pr-agent/pr-agent@<commit-sha>
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENROUTER.KEY: ${{ secrets.OPENROUTER_API_KEY }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          config.model: 'openrouter/free'
          config.fallback_models: '["openrouter/free"]'
          config.custom_model_max_tokens: '32000'
          github_action_config.auto_review: 'true'
          github_action_config.auto_describe: 'true'
          github_action_config.auto_improve: 'true'
          github_action_config.handle_push_trigger: 'true'
          github_action_config.push_commands: '["/review", "/improve"]'
```

### 2. `.pr_agent.toml` at repo root

```toml
[config]
model = "openrouter/free"
fallback_models = ["openrouter/free"]
custom_model_max_tokens = 32000

[github_action_config]
auto_review = true
auto_describe = true
auto_improve = true
handle_push_trigger = true
push_commands = ["/review", "/improve"]
```

Both files need to exist and agree. If you want to pin a specific (non-`openrouter/free`) model instead, see [Picking a specific model](#picking-a-specific-model).

## The two gotchas that will burn you

Everything above is the easy part. These two are not documented anywhere obvious and cost real debugging time to find.

### `custom_model_max_tokens` is mandatory for non-catalog models

PR-Agent keeps a static table of known models and their context windows (`pr_agent/algo/__init__.py`'s `MAX_TOKENS`). `openrouter/free` and virtually every other OpenRouter-routed model string are **not** in that table. Without `custom_model_max_tokens` set, every single review/describe/improve call throws before it ever reaches the API:

```
Model openrouter/free is not defined in MAX_TOKENS in ./pr_agent/algo/__init__.py and no custom_model_max_tokens is set
Failed to generate prediction with any model of [...]
```

The job itself still shows **green** in GitHub Actions — the failure is caught internally and PR-Agent just posts a comment saying `Failed to generate code suggestions for PR` (or similar) instead of erroring the workflow step. **A passing CI check does not mean PR-Agent actually worked** — always check that it posted real content, not a failure message (see [Verifying it actually works](#verifying-it-actually-works)).

Fix: set `custom_model_max_tokens` to a conservative value (32000 is safe for essentially any current model) in **both** files — and note it's `config.custom_model_max_tokens` in the env-var form, not bare `custom_model_max_tokens` (see next gotcha for why the prefix matters).

### Env var names use literal dotted section prefixes, not `SECTION__KEY`

It's tempting to assume PR-Agent's settings loader (Dynaconf) uses the common `SECTION__KEY` double-underscore nesting convention. **It doesn't, here.** The real convention — confirmed against the [official reference workflow](https://docs.pr-agent.ai/installation/github/) and PR-Agent's own source — is a literal dot in the env var name itself: `config.model`, `OPENROUTER.KEY`, `github_action_config.auto_review`. GitHub Actions `env:` blocks and Docker `-e` flags both allow dots in variable names, so this works, it's just unusual.

Get this wrong (e.g. `CONFIG__MODEL`, or a bare `custom_model_max_tokens` with no section prefix) and the setting silently doesn't apply — no error, it just never reaches the section Dynaconf expects, and you're back to the max-tokens failure above or an unpinned model.

## A third gotcha: free-tier models can return unparseable YAML

The two gotchas above fail *silently* (job green, no real comment). This one
fails *loudly* — the action step exits non-zero — and it's not a dead slug, a
bad key, or a config error. It's a **model-quality** failure.

`auto_review` / `auto_describe` ask the model for structured YAML. Free-tier
models sometimes return that YAML **wrapped in markdown code fences** (```
```yaml … ``` ```) or **duplicated** in the same response. PR-Agent's
`load_yaml` / `try_fix_yaml` can't extract parseable YAML from a fenced
response → the parse returns `None` → the next line,
`if 'review' not in data:` (in `pr_reviewer.py`), throws
`TypeError: argument of type 'NoneType' is not iterable`.

The kicker: **`retry_with_fallback_models` only retries on API-level
failures** (429, timeout, 5xx) — **not** on a 200 whose body is unparseable.
So once the primary model returns *a* response (HTTP 200) with bad content,
the fallback list is **never consulted**. The parse failure is terminal, and
with `propagate_tool_errors = true` (this repo's setting, deliberate so
failures stay visible) any one tool's parse failure crashes the whole action
step before the other tools run.

Mitigation: pick the **strongest instruction-follower** as `model` (one that
reliably returns raw YAML without fences), and keep the weaker / more
rate-limited ones only in `fallback_models` for 429/timeout cover. Do **not**
rely on `openrouter/free` auto-routing for the review tool — its pool
includes models that fence-wrap, and you can't control which one a given run
lands on. This repo pins GLM-5.2 as primary (the strongest of the three free
options tried) with gemma + nemotron as API-level fallbacks — see
`.pr_agent.toml`. As with every config change, verify real content actually
posted (see [Verifying it actually works](#verifying-it-actually-works)),
not just a green check.

## Why two config files (toml + env vars)

`.pr_agent.toml` is the documented, readable mechanism — PR-Agent fetches it from the repo's **default branch** via the GitHub Contents API on every run. The env vars in the workflow file are a second, redundant copy of the same settings that apply on **any** branch immediately, including the branch that is introducing or editing this very configuration.

Without the env-var mirror, a PR that changes `.pr_agent.toml` can't see its own not-yet-merged changes — chicken-and-egg. Keep both in sync by hand; don't let them drift.

## The trap that looks like a PR-Agent bug but isn't

If PR-Agent (or *any* `pull_request`-triggered workflow — `ci_api.yml`, `ci_web.yml`, everything) suddenly stops triggering entirely — no run, no check-suite, nothing, not even a failure — despite the workflow file being valid and previously working: **check whether the PR has a merge conflict with its base branch.**

GitHub silently refuses to evaluate `pull_request` event triggers on a PR with an unresolved merge conflict, even when the conflict is in a file completely unrelated to the workflow. There's no error message, no banner, nothing — the PR's Actions tab just shows nothing new. This can happen if, e.g., a config file gets pushed directly to the default branch (bypassing PR review) while a long-running feature branch that also touches that file is still open — the two copies diverge and the PR silently goes mergeable: false.

```
gh pr view <number> --json mergeable,mergeStateStatus
```

If `mergeable` is `CONFLICTING`, that's it — that's the whole mystery. Resolve the conflict, push, and every workflow fires immediately on the same push.

## Verifying it actually works

Don't trust a green check alone. After setup (or after any config change), open a real or throwaway PR and read the actual comments PR-Agent posts:

```
gh api repos/<owner>/<repo>/issues/<pr-number>/comments --jq '.[] | {user: .user.login, body: .body[0:150]}'
```

A working setup posts a `## PR Reviewer Guide` / `## PR Description` / `## PR Code Suggestions` comment with real content. A broken one (auth failure, missing `custom_model_max_tokens`, wrong model string) posts something like `Failed to generate code suggestions for PR` — while the GitHub Actions job itself still reports success.

If you used a throwaway PR to verify, close it and delete the branch afterward.

## Picking a specific model

`openrouter/free` maximizes uptime/quota by auto-routing across whatever's free right now, but you can pin an exact model instead (e.g. for a specific model's quality characteristics). List current free options: [openrouter.ai/collections/free-models](https://openrouter.ai/collections/free-models). Set it as `config.model` in both files, and keep `openrouter/free` as (at least) the last entry in `fallback_models` so you fall back to *something* if the pinned model gets deprecated or rate-limited — a fallback list containing only the primary model itself provides no actual redundancy.

Unlisted/preview ("stealth") models are occasionally free during a preview window but can disappear or start charging without notice — riskier to pin than a regular `:free`-suffixed model.

## Optional tuning

```toml
[pr_reviewer]
extra_instructions = """\
Focus on: <repo-specific concerns — auth, a known race condition class, \
a query performance concern, a convention the team cares about>
"""

[pr_code_suggestions]
num_code_suggestions = 5
suggestions_score_threshold = 7   # filters low-confidence suggestions

[pr_description]
push_labels = true
publish_labels = true            # auto-labels PRs from the generated description
```

## Triggers and behavior reference

- `opened` / `reopened` / `ready_for_review`: auto-runs `/describe`, `/review`, `/improve` once, each posting its own comment.
- `handle_push_trigger = true` + `push_commands = ["/review", "/improve"]`: re-runs those two (not `/describe`, which only needs regenerating if the PR's overall intent changes) on every subsequent push. Off by default.
- `issue_comment` trigger + the workflow's `on:` block: lets anyone comment a command (e.g. `/improve`) directly on the PR to run it manually.
- `if: ${{ github.event.sender.type != 'Bot' }}`: skips bot-authored PRs/comments (e.g. Dependabot) — nothing useful to review there.

## Making it a required check (optional)

Once verified working, gate merges on it via **Settings → Branches → branch protection rule → Require status checks to pass before merging**, and select `pr_agent_job` (plus your other CI jobs). This is a separate, deliberate step — it changes what other contributors can merge, so don't do it silently.
