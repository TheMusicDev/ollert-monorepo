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

**MariaDB accessory + API DB connection (the part that confuses everyone):**
You pick **one** password and use it in **two** places, because kamal passes
your `MYSQL_PASSWORD` to MariaDB when it boots the DB, and CakePHP must log
in with the same password:
```sh
MYSQL_ROOT_PASSWORD=<anything>
MYSQL_PASSWORD=hunter2
DATABASE_URL=mysql://ollert:hunter2@ollert-api-db:3306/ollert
#                         ^^^^^^ same value as MYSQL_PASSWORD
```
The host `ollert-api-db` is fixed — it's the accessory's container DNS name
on the kamal network (verified), not `localhost`. The user `ollert` and db
`ollert` are already set in `deploy.api.yml`'s accessory `env.clear`; you
only choose the passwords.

**Web build-time (local build, NOT `.kamal/secrets`):**
The web SPA is built **locally** before `kamal deploy` (`bun run build` in
`web/`, reading `web/.env`). The VITE_ vars live in `web/.env` (gitignored;
copy `web/.env.example`), not in `.kamal/secrets` — they're public (the
publishable key + Supabase URL ship in the client bundle) and the local
build bakes them in. The in-docker bun build was dropped because
TanStack Start's SPA prerender spins up a vite preview server that fails
to bind under the bun Nitro preset inside docker (ConnectionRefused
localhost:3000, 0 pages prerendered); building locally works.
- `VITE_API_BASE_URL` — `https://ollert-api.2719.fyi/api`
- `VITE_SUPABASE_URL` — `https://<project-ref>.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` — your `sb_publishable_…`

### 3. Boot the database (once)

```sh
kamal accessory boot db -c config/deploy.api.yml
```

Persistent data lives in the `ollert-db` named volume on negrita and survives
app deploys. `DATABASE_URL` must point at `ollert-api-db:3306` with the
`MYSQL_PASSWORD` you set.

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
`${window.location.origin}/auth/callback` — so it's already per-environment
(prod origin on prod, localhost on dev). Just allow-list both:

- **Site URL** → `https://ollert.2719.fyi` (only the fallback; used when a
  `redirectTo` isn't allowed. Sane default = prod. Set and forget.)
- **Redirect URLs** (allow-list) → add BOTH:
  - `https://ollert.2719.fyi/auth/callback` (prod)
  - `http://localhost:3000/auth/callback` (dev — keep)
- **Email Templates → Recovery** → leave the default
  `{{ .SiteURL }}` / `{{ .ConfirmationURL }}` (don't hardcode a host).

Path: Dashboard → project → **Authentication → URL Configuration** (direct:
`https://supabase.com/dashboard/project/_/auth/url-configuration`). Site URL
is a text field; Redirect URLs is an input + **Add URL** button → each
entry becomes a chip/row → **Save** at the bottom.

**One project is enough for dev + prod of this app.** Because `redirectTo`
is per-environment and both values are allow-listed, each environment's
reset emails land on the right host. The earlier "two projects for
per-env links" idea was wrong — Site URL is a fallback, not the link base.
(One project per *app* is still right; dev + prod of the *same* app share
one project.)

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
drains the old). The DB accessory is **not** touched by app deploys.

---

## How migrations run

`api/docker-entrypoint.sh` runs `bin/cake migrations migrate` before
php-fpm starts. Single replica on negrita → no race. Phinx migrations are
idempotent. If a migration fails, the container exits, kamal's healthcheck
fails, and the deploy rolls back. If a migration ever becomes
breaking/long, switch to a kamal `before_deploy` hook instead.

---

## App ↔ DB networking

The app container reaches MariaDB at `ollert-api-db:3306` — kamal names the
accessory `<service>-<accessory>` and puts app + accessory on the same
`kamal` docker network, so the name resolves via Docker DNS. That's why
`DATABASE_URL` uses `ollert-api-db`, not `127.0.0.1`. The accessory's
`127.0.0.1:3306:3306` publish is only for host-side access (ad-hoc `mysql`
cli on negrita), not for the app container.

---

## Useful commands

```sh
# app containers on negrita
kamal app exec -c config/deploy.api.yml --reuse "bin/cake migrations status"
kamal app logs -c config/deploy.api.yml
kamal app roles -c config/deploy.api.yml

# accessory lifecycle (not part of app deploys)
kamal accessory boot db -c config/deploy.api.yml      # first time
kamal accessory reboot db -c config/deploy.api.yml   # restart
kamal accessory upgrade db -c config/deploy.api.yml  # new MariaDB image

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