# Ollert

Stripped-down Trello clone. CakePHP backend, Supabase Auth for user management, TanStack Start (React) frontend. Frontend owns the auth session and sends Supabase JWTs to the backend on every request.

Full architecture, schema, API contract, and decision history live in the OKF planning bundle — start at [`planning/index.md`](planning/index.md).

## Repo layout

```
ollert/
  api/          # CakePHP backend
  web/          # TanStack Start frontend
  e2e/          # Playwright end-to-end tests
  docker/       # local dev services (MariaDB, Mailpit)
  planning/     # OKF knowledge bundle
```

## Local development

See [`planning/architecture.md#local-development`](planning/architecture.md#local-development) for the full setup. Short version: `docker compose up -d` (from `docker/`), `bin/cake server` (from `api/`), `bun run dev` (from `web/`).

## CI

Three independent workflow files run in parallel on every PR against `main`: `.github/workflows/ci_api.yml` (`api-tests`), `ci_web.yml` (`web-tests`), `pr_agent.yml` (`pr_agent_job`) — split into separate files, not one workflow with three jobs, so each triggers and fails independently. `ci_api.yml`/`ci_web.yml` need no setup — they run out of the box. `pr_agent.yml` needs one manual step below before it can run.

### Setting up PR-Agent

PR-Agent reviews are self-hosted with your own key against OpenRouter, using [`the-pr-agent/pr-agent`](https://github.com/the-pr-agent/pr-agent) — not Qodo's hosted service, so no separate account and no Qodo-side rate limit.

1. **Get an OpenRouter API key**
   - Sign up / log in at [openrouter.ai](https://openrouter.ai).
   - Go to [openrouter.ai/keys](https://openrouter.ai/keys) → **Create Key**.
   - Copy the key (starts with `sk-or-...`). You don't need to add a payment method or credits — the model this workflow uses (`stealth/ox-alpha`, see below) is free during its preview window, and falls back to OpenRouter's `openrouter/free` auto-router if it stops being available.

2. **Add it as a repo secret**
   - GitHub → this repo → **Settings** → **Secrets and variables** → **Actions**.
   - **New repository secret**.
   - Name: `OPENROUTER_API_KEY` (must match exactly — `pr_agent.yml` reads this name).
   - Value: the key from step 1.
   - **Add secret**.

3. **Done** — no further action. The next PR (or a re-run of an existing PR's checks) will pick it up automatically.

#### What runs, and when

On a PR's `opened`/`reopened`/`ready_for_review` event, PR-Agent auto-runs three commands, each posting its own comment: `/describe` (PR description), `/review` (an overall review), `/improve` (a code-suggestions table). None of that re-runs on later pushes by default — `handle_push_trigger = true` plus `push_commands = ["/review", "/improve"]` (set both in `.pr_agent.toml` and as env vars in `pr_agent.yml`, see below) re-run those two — not `/describe`, which only needs regenerating if the PR's overall intent changes, not every commit — on every subsequent push too.

You can also trigger any command manually by commenting it (e.g. `/improve`) directly on the PR — `pr_agent.yml` listens for `issue_comment` events for exactly this, per the [official reference workflow](https://docs.pr-agent.ai/installation/github/).

#### Changing the model

Model selection is set in two places kept in sync: `.pr_agent.toml` at the repo root (the documented mechanism, reads from the default branch) and matching env vars in `.github/workflows/pr_agent.yml` (`config.model`, `config.fallback_models` — takes effect on every branch immediately, useful for a PR that touches this config before it's merged). Pinned to `openrouter/google/gemma-4-26b-a4b-it:free`, falling back to `openrouter/nvidia/nemotron-3-nano-30b-a3b:free`. Two earlier choices didn't hold up: `openrouter/stealth/ox-alpha` (an unlisted/preview model) was slow enough to dominate a PR-Agent run's runtime on its own, and `openrouter/free` (OpenRouter's own auto-router) repeatedly routed to a broken backend. See [PR_AGENT_SETUP.md](PR_AGENT_SETUP.md) for the full story, including two more settings that are easy to miss: `config.custom_model_max_tokens` (required for any model not in PR-Agent's built-in table — every call fails without it) and `config.ai_timeout` (bounds a hung call so it fails over to the next fallback instead of stalling the whole job). Check [openrouter.ai/collections/free-models](https://openrouter.ai/collections/free-models) for the current roster if you want to pin something else instead — update both files.

#### Required checks

`API tests (CakePHP / PHPUnit)`, `Web tests (Vitest / ESLint / tsc)`, and `Run PR-Agent on every pull request, respond to user comments` are required status checks on `main` (**Settings** → **Branches** → branch protection rule) — a PR can't merge until all three pass. `pr_agent.yml` also has a guard step that fails the check if PR-Agent's own logs show a real generation failure (it otherwise always exits 0, even when a tool silently gives up after exhausting every fallback model) — see [PR_AGENT_SETUP.md](PR_AGENT_SETUP.md).
