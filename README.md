# Ollert

Stripped-down Trello clone. CakePHP backend, Supabase Auth for user management, TanStack Start (React) frontend. Frontend owns the auth session and sends Supabase JWTs to the backend on every request.

Full architecture, schema, API contract, and decision history live in the OKF planning bundle — start at [`planning/index.md`](planning/index.md).

## Permissions

Two roles, org-wide: **owner** (whoever created the org) and **member** (everyone else added to it). Board/list/card create/rename/move/delete is open to **any member** — only **creating a new board** requires being the org's owner (it's the one action that spends the owner's `max_boards_per_org` quota). Adding an existing user to an org by email is also open to any member, with no consent step from the person added. Full matrix, rationale, and deferred ideas for a richer role model: [`planning/permissions.md`](planning/permissions.md).

## Repo layout

```text
ollert/
  api/          # CakePHP backend
  web/          # TanStack Start frontend
  mcp/          # MCP server (Supabase-JWT-authed tool access)
  e2e/          # Playwright end-to-end tests
  supabase/     # Supabase CLI local stack config (supabase start)
  planning/     # OKF knowledge bundle
```

## Local development

See [`planning/architecture.md#local-development`](planning/architecture.md#local-development) for the full picture.

### Prerequisites

- **PHP 8.5** + **Composer** (`api/`).
- **Bun v1.3.14** (`web/`, `mcp/`) — install it yourself, pinned to match `package.json`'s `packageManager`: `curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14"`, then verify with `bun --version`. `packageManager` itself only declares the version for tooling that reads it (like `oven-sh/setup-bun` in CI); Bun doesn't auto-switch to it locally, which is why the install command needs the version pinned explicitly.
- **Docker** (Supabase CLI's local stack runs as ~9 containers) and the **Supabase CLI**: `brew install supabase/tap/supabase`.

### First-time setup

1. `bun install` (repo root) — a `postinstall` hook cascades this into `web/`, `mcp/`, `e2e/` (`bun install`) and `api/` (`composer install`) too, so this one command sets up every sub-project's dependencies, not just the root's own (`concurrently`, which `bun dev` uses to run everything below together).
2. `supabase init` — already done, `supabase/config.toml` is checked in. Skip.
3. Generate your own local RS256 signing key (gitignored, one per dev — see `CLAUDE.md` Learnings 2026-08-27/29 for why this is needed instead of the CLI's HS256 default, and a gotcha with the command below). `supabase gen signing-key` requires the target file to already exist (even with `--append`), so seed an empty array first:
   ```sh
   echo '[]' > supabase/signing_keys.json
   supabase gen signing-key --algorithm RS256 --append
   ```
   (Don't pipe this command through `head`/`tail` — it's an interactive TUI and closing the pipe early crashes it with an `EPIPE`. Run it plain.)
4. One root `.env` instead of five scattered ones:
   ```sh
   cp .env.example .env
   $EDITOR .env        # local-dev defaults are already filled in; mainly just set API__SECURITY_SALT
   bun run env         # writes api/.env, web/.env, web/.env.production, mcp/.env, e2e/.env, .kamal/secrets from .env
   ```
   `bun run env` skips any target file that already exists — pass `-f`/`--force` (as `bun run env -- --force`) to regenerate one you've hand-edited since. See `.env.example`'s own header comment for the `<TARGET>__<VAR>` prefix convention if you're adding a new variable.
5. `cd api && bin/cake migrations migrate` (creates the schema against local Postgres — needs the Supabase stack up first, see step 6). Dependencies are already installed from step 1.
6. `bun run dev` (repo root) — starts the Supabase local stack if it isn't already running, then the API, web, and MCP dev servers together (`bin/cake server` :8765, `bun run dev` in `web/` :3000, `bun run dev` in `mcp/` :8766).

### Day-to-day

Once set up, you don't repeat the above — just:

- `bun run dev` (repo root) — starts Supabase (if needed) + api + web + mcp together. `Ctrl-C` stops all three; Supabase itself keeps running.
- `bun run dev:stop` when you want Supabase's containers down too — data persists in the Postgres volume across a stop/start cycle, so you keep your local users/orgs/boards.
- Individual pieces if you don't want all three: `bun run dev:api`, `bun run dev:web`, `bun run dev:mcp`, `bun run dev:db` (just Supabase).
- `bun migrate:prod` — runs phinx against the hosted Supabase DB (the `prod` Datasources connection, fed from root `KAMAL__DATABASE_URL` via `bun run env`). Out-of-band prod migrations; the API deploy entrypoint still runs them on every deploy. See [`DEPLOYMENT.md`](DEPLOYMENT.md) §3.

`supabase/signing_keys.json` is a plain local file, not managed by Supabase's own lifecycle — `supabase stop`/`start` and even `supabase db reset` (which does recreate the Postgres container and wipe its data, so you'll need to re-run `bin/cake migrations migrate` after one) all leave it untouched, verified directly. Only redo step 3 if the file doesn't exist yet (fresh clone) or you've deleted/rotated it yourself. The printed URLs/keys in step 4 are stable too unless you fully delete and re-`supabase init` the project.

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
