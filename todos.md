# Ollert — pre-code review items

All resolved. Kept as a record of what was decided; full detail folded into `planning/`.

## Blocking (affects both FE and BE, expensive to retrofit)

- [x] **Error response shape** — standard envelope: `{ error: { message, code, fields? } }`. See `planning/api-contract.md#conventions`.
- [x] **CORS policy** — origin allow-list (dev `http://localhost:5173`, prod TBD), `Authorization`+`Content-Type` headers, no credentials mode (Bearer token, no cookies). See `planning/architecture.md#cors`.
- [x] **Org creation rules** — `users.max_orgs` (default 1) and `users.max_boards_per_org` (default 3), app-enforced quotas. Board creation is org-owner-only. See `planning/data-model.md#quotas`.

## Worth deciding, lower blast radius

- [x] **JIT user provisioning mechanics** — find-or-create by `supabase_uid` on every authenticated request, no dedicated bootstrap endpoint.
- [x] **Testing strategy** — PHPUnit (`/api`), Vitest (`/web`), Playwright for e2e (drives the real built FE against a running API; phased in from Phase 3, not day one).
- [x] **Deployment target** — shared PHP host, SSH access, local (non-CI) deploy scripts, one for `/api` one for `/web` (pipelines differ). Writing the scripts themselves deferred to Phase 3 — not worth building before there's an app to deploy.

## Resolved during scaffolding-prep discussion

- [x] **CakePHP migrations tooling** — `cakephp/migrations` plugin, confirmed.
- [x] **Frontend router** — TanStack Router as a plain client-side SPA. TanStack Start considered and rejected: no Node server to run its SSR/server-functions model, and forcing a "no SSR" mode fights the framework rather than using it as intended. Plain `vite build` output (static files) is the simplest thing that deploys cleanly to the shared PHP host.
