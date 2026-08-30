# Deployment — kamal on negrita.local

Two apps, both deployed to `negrita.local` via kamal, served behind
cloudflared (which owns edge TLS):

| app | config | image | hostname | proxy port |
|---|---|---|---|---|
| CakePHP API | `config/deploy.api.yml` | `ollert-api` | `ollert-api.2719.fyi` | 80 |
| web SPA | `config/deploy.web.yml` | `ollert-web` | `ollert.2719.fyi` | 80 |

Both apps share a single kamal-proxy container on host port 80 — it routes
by Host header, so both hostnames land on the same port. cloudflared's
`*.2719.fyi -> http://localhost:80` wildcard delivers both. (An earlier
draft used per-app ports 8080/8081; that doesn't work with a shared
kamal-proxy — one container, one publish set — so both are 80 now.)

One secrets file (`.kamal/secrets`) is shared by both configs — that's
kamal's design, not a choice. Each config only pulls the names it references.

> SSH: `ssh negrita.local` works (via `~/.ssh/config` → `User amoreno`).
> The configs use `amoreno@192.168.1.20` (the LAN IP) instead of the
> `negrita.local` mDNS name — kamal's Ruby SSH resolver is flaky on `.local`.
> `~/.ssh/config` still maps `negrita.local` for ad-hoc ssh.

---

## Prerequisites (have these ready)

- **kamal installed locally** (`gem install kamal`), run from this repo.
- **SSH to negrita passwordless**: `ssh negrita.local echo ok` must work
  without prompting. Fix your key first if it doesn't.
- **Supabase project ref** — the `xxxxxxxx` in `https://xxxxxxxx.supabase.co`.
- **Supabase publishable key** — `sb_publishable_…` (Supabase → Settings → API).

---

## First-time setup

### 1. Local registry on negrita (once)

A `registry:2` container is already running on negrita, published on host
port **5555** (`0.0.0.0:5555->5000`). Verify:
```sh
# on negrita
docker ps --filter name=registry --format '{{.Names}}  {{.Status}}  {{.Ports}}'
```
`Up` + `0.0.0.0:5555->5000/tcp` → done, skip this step. If it weren't
running, you'd start it with
`docker run -d -p 5555:5000 --restart=always --name registry registry:2`.

The configs use `localhost:5555` for both push (builder on negrita) and
pull (server on negrita). `localhost` needs no insecure-registries config
(docker allows localhost over HTTP by default).

### 2. Secrets

```sh
cp .kamal/secrets.example .kamal/secrets
$EDITOR .kamal/secrets
```

`.kamal/secrets` is gitignored (see `.gitignore`); `.kamal/secrets.example`
is the safe template and is committed. Fill every `CHANGE_ME` / `<placeholder>`:

**API runtime:**
- `SECURITY_SALT` — generate: `php -r 'echo bin2hex(random_bytes(40));'`
- `SUPABASE_JWKS_URL` / `SUPABASE_JWT_ISS` — put your project ref where
  `<project-ref>` is.

**API DB connection (post Supabase migration — 2026-08-29, see
`planning/supabase-migration.md`):** app data lives in the hosted Supabase
project's Postgres, not a self-hosted accessory on negrita. There's no
`MYSQL_ROOT_PASSWORD`/`MYSQL_PASSWORD` dance anymore — just one connection
string:

```sh
DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<database>?sslmode=require
```

Get the exact value from the Supabase dashboard: **Project Settings →
Database → Connection string**. Supabase offers a **direct connection**
(port 5432) and a **pooled connection** via pgbouncer (transaction mode,
port 6543, hostname prefixed `aws-0-...pooler...`). CakePHP's Postgres
connections here are non-persistent (`'persistent' => false` in
`api/config/app.php`, opened fresh per request) — that shape matches the
transaction-mode pooler's model, so start there; fall back to the direct
connection if the pooler's prepared-statement handling causes issues with
CakePHP's ORM. **Not verified against the real hosted project yet** — confirm
whichever you pick actually works before relying on it (see post-merge.md).

**Web build-time (local build, NOT `.kamal/secrets`):**
The web SPA is built **locally** before `kamal deploy` (`bun run build` in
`web/`). Vite loads env files by mode: `bun run dev` (mode=development) reads
`web/.env`; `bun run build` (mode=production) reads `web/.env` **then**
`web/.env.production` (later overrides). So the two env files split by what
differs between dev and prod:
- `web/.env` (gitignored; copy `web/.env.example`) — holds the **dev**
  values: `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` for the
  Supabase CLI local stack, and `VITE_API_BASE_URL=http://localhost:8765/api`.
- `web/.env.production` (gitignored) — holds the **prod** overrides:
  `VITE_API_BASE_URL=https://ollert-api.2719.fyi/api` **and**
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` for the real hosted
  Supabase project. **Changed 2026-08-29** (post Supabase migration): dev
  and prod no longer share one Supabase project — dev is the local CLI
  stack, prod is hosted — so unlike before, Supabase vars must be overridden
  here too, not just the API URL.

The VITE_ vars are public (publishable key + Supabase URL ship in the client
bundle), so no build-secret machinery. **Without `.env.production`, the prod
build falls back to `web/.env` and bakes in `localhost:8765` → prod SPA calls
the dev API and CORS-blocks.** The in-docker bun build was dropped because
TanStack Start's SPA prerender spins up a vite preview server that fails to
bind under the bun Nitro preset inside docker (ConnectionRefused
localhost:3000, 0 pages prerendered); building locally works.

### 3. Create the schema on hosted Postgres (once)

No accessory to boot — the database already exists, hosted by Supabase.
One-time schema creation, run from any machine with the prod `DATABASE_URL`
(e.g. locally, pointed at prod temporarily):

```sh
cd api && DATABASE_URL=<prod connection string> bin/cake migrations migrate
```

This is the entire "cutover" — there's no data to migrate (see
`planning/supabase-migration.md#cutover-concern`), just schema creation
against an empty database. After this, `api/docker-entrypoint.sh` re-runs
`bin/cake migrations migrate` on every deploy (idempotent, see "How
migrations run" below) — this one-time step just gets the first deploy's
entrypoint past an otherwise-empty database faster and lets you verify the
schema lands correctly before trusting a live deploy to do it.

### 4. cloudflared + DNS (once)

On negrita, `~/.cloudflared/config.yml` routes both apps via the wildcard
to the shared kamal-proxy on port 80:

```yaml
tunnel: <tunnel-id>
credentials-file: /Users/amoreno/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: rustfs.2719.fyi          # (any other apps you host)
    service: http://localhost:9000
  - hostname: "*.2719.fyi"
    service: http://localhost:80        # kamal-proxy — routes ollert-api + ollert by Host
  - service: http_status:404
```

Route both hostnames to your tunnel (one-time, DNS):

```sh
cloudflared tunnel route dns <tunnel-name> ollert-api.2719.fyi
cloudflared tunnel route dns <tunnel-name> ollert.2719.fyi
```

cloudflared runs on negrita as a **launchd** daemon
(`/Library/LaunchDaemons/com.cloudflare.cloudflared.plist`,
label `com.cloudflare.cloudflared`). After editing `config.yml`, restart it:

```sh
sudo launchctl kickstart -k system/com.cloudflare.cloudflared
```

Edge TLS is Cloudflare's job, so kamal runs with `ssl: false` in both configs.

### 4b. Supabase URL config (once)

Password-reset / email-confirmation links resolve as follows (confirmed by
a Supabase maintainer, Aug 2025): Supabase uses the `redirectTo` value the
app passes IF it's in the **Redirect URLs** allow-list; otherwise it falls
back to **Site URL**. So the allow-list is what matters — `redirectTo` wins
when it's listed.

Our `web/src/lib/auth-context.tsx` `authCallbackUrl()` sets `redirectTo` =
`${window.location.origin}/auth/callback` — per-environment by construction,
but **since the 2026-08-29 Supabase migration, dev no longer talks to this
hosted project at all** — local dev uses the Supabase CLI local stack's own
separate Auth instance (`supabase/config.toml`'s own
`site_url`/`additional_redirect_urls`, currently `http://localhost:3000/...`
— see that file, not this dashboard). So this hosted project's allow-list
only needs the **prod** entry:

- **Site URL** → `https://ollert.2719.fyi` (only the fallback; used when a
  `redirectTo` isn't allowed. Sane default = prod. Set and forget.)
- **Redirect URLs** (allow-list) → add `https://ollert.2719.fyi/auth/callback`
  only. Drop `http://localhost:3000/auth/callback` from it if it's still
  there from before the migration — dev no longer needs it here.
- **Email Templates → Recovery** → leave the default
  `{{ .SiteURL }}` / `{{ .ConfirmationURL }}` (don't hardcode a host).

Path: Dashboard → project → **Authentication → URL Configuration** (direct:
`https://supabase.com/dashboard/project/_/auth/url-configuration`). Site URL
is a text field; Redirect URLs is an input + **Add URL** button → each
entry becomes a chip/row → **Save** at the bottom.

### 5. Deploy

```sh
kamal deploy -c config/deploy.api.yml        # API + migrations (entrypoint)
( cd web && bun run build ) && kamal deploy -c config/deploy.web.yml   # SPA
```

The API builds in docker on negrita (remote builder). The web SPA is built
**locally** first (`bun run build` reads `web/.env`) — the Dockerfile just
copies the pre-built `.output/public` into nginx. The in-docker bun build
was dropped: TanStack Start's SPA prerender spins up a vite preview server
that fails to bind under the bun Nitro preset inside docker. `web/.env`
(gitignored) holds the VITE_ vars; `web/.env.example` is the template.

---

## Day-to-day redeploy

```sh
kamal deploy -c config/deploy.api.yml
( cd web && bun run build ) && kamal deploy -c config/deploy.web.yml
```

That's it. Both are zero-downtime (kamal-proxy swaps to the new container,
drains the old). There's no DB accessory on negrita anymore to worry about —
the database is Supabase-hosted and outlives any app deploy or container
restart by construction.

---

## How migrations run

`api/docker-entrypoint.sh` runs `bin/cake migrations migrate` before
php-fpm starts, against whatever `DATABASE_URL` points at (Supabase-hosted
Postgres in prod). Single replica on negrita → no race. Phinx migrations are
idempotent. If a migration fails, the container exits, kamal's healthcheck
fails, and the deploy rolls back. If a migration ever becomes
breaking/long, switch to a kamal `before_deploy` hook instead.

---

## App ↔ DB networking

The app container reaches Postgres over the internet at whatever host
`DATABASE_URL` names (Supabase's hosted endpoint or pooler) — not a
same-host Docker-network accessory like the old MariaDB setup. No special
kamal networking involved; it's an outbound connection like any external
API call, gated by `sslmode=require`.

---

## Useful commands

```sh
# app containers on negrita
kamal app exec -c config/deploy.api.yml --reuse "bin/cake migrations status"
kamal app logs -c config/deploy.api.yml
kamal app roles -c config/deploy.api.yml

# stop / remove an app
kamal app stop -c config/deploy.api.yml
```

---

## Notes

- **No registry auth**: local `registry:2` with no auth is fine on a trusted
  home network. Add auth if negrita is ever exposed beyond the LAN.
- **Config files** live in `config/`; **secrets** live in `.kamal/secrets`
  (root, gitignored). Nothing with a real value is committed — the
  `deploy.*.yml` only contain non-secret defaults and secret *name lists*
  (`env.secret:`, `builder.secrets:`). kamal 2.12.0 has **no `secret()` ERB
  helper**; don't write `<%= secret("X") %>` (fails with
  `NoMethodError: undefined method 'secret'`). See KAMAL_DEPLOYMENT.md §9.
- **Two deploys, one secrets file**: kamal reads a single shared secrets
  store. Both configs reference it; each picks its own names.