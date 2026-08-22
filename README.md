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

`.github/workflows/ci.yml` runs three independent jobs in parallel on every PR against `main`: `api-tests`, `web-tests`, `pr-agent`. `api-tests`/`web-tests` need no setup — they run out of the box. `pr-agent` needs one manual step below before it can run.

### Setting up PR-Agent

PR-Agent reviews are self-hosted with your own key against OpenRouter, using [`the-pr-agent/pr-agent`](https://github.com/the-pr-agent/pr-agent) — not Qodo's hosted service, so no separate account and no Qodo-side rate limit.

1. **Get an OpenRouter API key**
   - Sign up / log in at [openrouter.ai](https://openrouter.ai).
   - Go to [openrouter.ai/keys](https://openrouter.ai/keys) → **Create Key**.
   - Copy the key (starts with `sk-or-...`). You don't need to add a payment method or credits — the model this workflow uses (`openrouter/free`, see below) only ever routes to $0 models.

2. **Add it as a repo secret**
   - GitHub → this repo → **Settings** → **Secrets and variables** → **Actions**.
   - **New repository secret**.
   - Name: `OPENROUTER_API_KEY` (must match exactly — `ci.yml` reads this name).
   - Value: the key from step 1.
   - **Add secret**.

3. **Done** — no further action. The next PR (or a re-run of an existing PR's checks) will pick it up automatically.

#### Changing the model

Model selection lives in `.pr_agent.toml` at the repo root, not in `ci.yml`. It's set to `openrouter/free` — OpenRouter's own auto-router across whatever free-tier models are live at request time, chosen specifically because individual `:free`-suffixed models rotate and deprecate often enough that pinning one directly would eventually break this workflow silently. To pin a specific model instead (e.g. for more consistent review quality), check [openrouter.ai/collections/free-models](https://openrouter.ai/collections/free-models) for what's currently free and edit `.pr_agent.toml`'s `model`/`fallback_models`.

#### Making these checks required (optional)

None of the three jobs block merging by default — they just run and report. If you want `api-tests`/`web-tests` (or `pr-agent`) to actually gate merges, that's a separate step: GitHub → **Settings** → **Branches** → branch protection rule for `main` → **Require status checks to pass before merging** → select the job(s) by name. Not done here since it changes what other contributors can merge, not just what runs.
