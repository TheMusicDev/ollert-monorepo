# Deploying with kamal — hard-won learnings

A project-agnostic record of the gotchas hit deploying the Ollert monorepo
(CakePHP API + TanStack Start SPA) to a home macOS server (`negrita`, Intel
x86_64) behind cloudflared. Read this before standing up the next kamal
project so the same detours aren't paid for twice. Ollert-specific details
live in `DEPLOYMENT.md`; this file is the reusable part.

---

## 1. One `deploy.yml` per image

kamal deploys **one image per config file**. A monorepo with N deployable
apps → N `deploy.*.yml` files, each `kamal deploy -c config/deploy.X.yml`.
There is no "deploy everything" command.

```yaml
service: my-api          # kamal's name for this app (container labels, proxy route)
image: my-api            # BARE name — kamal prepends registry.server itself
registry:
  server: localhost:5555 # local registry:2 on the host
  username: ""           # empty = no auth (fine on a trusted LAN)
```

**Gotcha:** if `image:` includes the registry prefix
(`image: localhost:5555/my-api`), kamal prepends it *again* →
`invalid tag "localhost:5555/localhost:5555/my-api"`. Keep `image:` bare.

---

## 2. `servers:` must be a BARE host (no `user@`)

```yaml
servers:
  - 192.168.1.20         # bare host, NOT amoreno@192.168.1.20
ssh:
  user: amoreno          # login user lives here
  config: true           # make Net::SSH read ~/.ssh/config
```

**Why:** kamal's `KAMAL.hosts` (server hosts **and accessory hosts**) get
passed raw to `Net::SSH.start` as the *hostname* for port forwarding
(registry tunneling). `getaddrinfo("amoreno@192.168.1.20")` fails — the `@`
is not a valid hostname. SSHKit (the app-command layer) *does* split
`user@host`, but Net::SSH does not, so the string must be bare. The user
and key come from the `ssh:` block.

**`config: true` is required** when your SSH key isn't default-named
(`~/.ssh/id_rsa` / `~/.ssh/id_ed25519`). Net::SSH does **not** read
`~/.ssh/config` unless you set `config: true`, so a `Host * IdentityFile
~/.ssh/my_key` entry is invisible to it without that flag. SSHKit reads
`~/.ssh/config` regardless.

**Avoid mDNS `.local` hostnames.** kamal's Ruby SSH resolver is flaky on
them (`Socket::ResolutionError: getaddrinfo`). Use the LAN IP, or add an
`/etc/hosts` entry. SSHKit handles `.local` fine; Net::SSH doesn't.

---

## 3. Builder: `arch` is mandatory, remote build over SSH

```yaml
builder:
  arch: amd64            # REQUIRED — Kamal::ConfigurationError without it
  remote: ssh://user@host
  local: false           # don't use the laptop's docker; build on the server
  context: api           # build context dir (relative to repo root)
  dockerfile: api/Dockerfile
```

- `arch` matches the server's `uname -m` (`amd64` for Intel x86_64, `arm64`
  for Apple Silicon). Without it: `Builder arch not set`.
- `remote: ssh://...` + `local: false` means the image builds on the
  server's own docker — native arch, no cross-build, no docker needed on
  the machine running `kamal`. Drop both if you run `kamal` from the server
  itself (local build is fine then).

---

## 4. Local registry:2 — no insecure-registries config needed

```sh
# on the server, once
docker run -d -p 5555:5000 --restart=always --name registry registry:2
```

`localhost:5555` is allowed by docker over HTTP **without** an
insecure-registries entry (localhost is special-cased). Use `localhost:5555`
for both push (remote builder on the server) and pull (server pulling its
own registry). Add registry auth only if the host is ever exposed beyond the
LAN.

---

## 5. kamal-proxy is ONE shared container, routes by Host header

This is the biggest design point and the easiest to get wrong.

- kamal-proxy is a **single container per host**, published on **one host
  port** (typically 80). It routes incoming requests to the right app
  container by the **`Host` header** — every app registers its hostname via
  `kamal-proxy deploy <app> --host=<hostname>`.
- Because it's one container with one publish set, **all apps on that host
  must use the same `proxy.run.http_port`**. Per-app ports (`8080` for the
  API, `8081` for the web) do **not** work: kamal does
  `docker container start kamal-proxy || docker run --publish <port>:80 …`,
  so an existing container is reused and the new `--publish` never applies.
  The second app's port silently never gets published.
- Correct: both apps `http_port: 80`, cloudflared routes both hostnames to
  `localhost:80`, kamal-proxy fans out by Host.

```yaml
proxy:
  host: app.example.com
  ssl: false              # cloudflared owns edge TLS, forwards plain HTTP
  app_port: 80            # the port YOUR container listens on
  run:
    http_port: 80         # the host port kamal-proxy publishes (same for all apps)
```

**Changing kamal-proxy's published port requires recreating it** — `docker
rm -f kamal-proxy` on the server, then redeploy (kamal's `start || run`
reuses the existing container as-is, so a stale port mapping persists across
deploys otherwise).

---

## 6. kamal-proxy healthcheck — the app must return 2xx, mind the Host header

kamal-proxy healthchecks the app container with an HTTP GET to a path
(default `/`), expecting 2xx/3xx within 30s. If it fails, the deploy aborts
with `target failed to become healthy within configured timeout` and rolls
back.

**The trap:** the healthcheck request's `Host` header does **not** match the
app's public hostname — kamal-proxy hits the container's internal address.
Any middleware that validates the `Host` header (host-header-injection
guards) or requires auth will **400/401 the healthcheck** on every path,
because the middleware runs before routing. The app never gets a chance to
return 200.

Two clean fixes (pick one):

1. **Static health file in the webroot** (preferred for PHP/Rails-style
   apps). Add `webroot/health` (or `public/up`) — the front web server
   (nginx) serves it directly, never invoking the app, so no middleware
   runs. Point kamal-proxy at it:
   ```yaml
   proxy:
     healthcheck:
       path: /health
   ```
2. **Unauthenticated health endpoint excluded from auth/host checks** — a
   controller action returning 200, with the path explicitly whitelisted in
   the auth middleware AND the host-check middleware (host check runs before
   routing, so it must be bypassed by path too).
3. **App-level host guard (no middleware layer)** — when the Host-header
   guard lives in the app's own fetch handler rather than in middleware
   (e.g. the MCP SDK's `hostHeaderValidationResponse` helper runs inside the
   Bun `fetch` function, before routing), there's no middleware to whitelist
   a path into. The fix is ordering: handle `/health` (return `ok`) **before**
   invoking the guard, so the probe never reaches the Host check. Same effect
   as a static webroot file, just in-process. Don't exempt anything that
   returns non-trivial data — `/health` is safe because it only returns `ok`.
   See `mcp/src/server.ts` (Ollert) for the pattern.

Don't point the healthcheck at `/` if `/` goes through protected middleware.
A 400 healthcheck is almost always middleware rejecting the internal
healthcheck request, not a real app failure.

---

## 7. cloudflared owns edge TLS → `ssl: false`

cloudflared terminates TLS at the Cloudflare edge and forwards plain HTTP
to a local port on the server. So kamal runs `ssl: false` (no Let's
Encrypt, no certs in kamal). cloudflared routes hostname → `http://localhost:80`.

**cloudflared does not hot-reload its ingress config.** After editing
`~/.cloudflared/config.yml`, restart the daemon. On macOS it runs as a
**launchd** daemon (`/Library/LaunchDaemons/com.cloudflare.cloudflared.plist`,
label `com.cloudflare.cloudflared`):

```sh
sudo launchctl kickstart -k system/com.cloudflare.cloudflared
```

`launchctl list | grep cloudflared` shows **nothing without sudo** — it
only lists user agents, not system daemons. Check the process instead:
`ps aux | grep [c]loudflared`.

**cloudflared matches the most-specific hostname first.** A wildcard
`*.example.com → http://localhost:80` catches every subdomain not
explicitly listed. Specific entries override the wildcard — so a stale
specific entry pointing at the wrong port silently breaks that one
hostname while the wildcard would have handled it correctly. Prefer either
fully-specific entries or a wildcard, not a mix that can drift.

DNS: `cloudflared tunnel route dns <tunnel-name> <hostname>` (once per
hostname).

---

## 8. Accessories — `host:` defaults to root, DB reachable by container DNS name

```yaml
accessories:
  db:
    image: mariadb:11.8
    host: 192.168.1.20        # BARE host (same rule as servers: — in KAMAL.hosts)
    port: "127.0.0.1:3306:3306"  # host-side only; not for the app container
    env:
      clear:
        MYSQL_DATABASE: myapp
        MYSQL_USER: myapp
      secret:
        - MYSQL_ROOT_PASSWORD
        - MYSQL_PASSWORD
    directories:
      - myapp-db:/var/lib/mysql
```

- **`host:` defaults to `root`.** If your SSH user isn't root, set a bare
  host (user comes from the `ssh:` block). Otherwise the accessory boot
  prompts for root's password.
- **The app container reaches the DB by the accessory's container DNS
  name**, `<service>-<accessory>` (e.g. `myapp-api-db`), on the shared
  `kamal` docker network — NOT `localhost` or `127.0.0.1`. The accessory's
  `127.0.0.1:3306:3306` publish is for host-side `mysql` CLI only. So
  `DATABASE_URL=mysql://user:pass@myapp-api-db:3306/db`.
- Accessories are booted once (`kamal accessory boot db`) and **not touched
  by app deploys**. Persistent data lives in the named volume.

---

## 9. Secrets — one shared `.kamal/secrets`, gitignored

kamal reads a single shared secrets store regardless of how many configs
you have. Each config pulls only the names it references.

- `.kamal/secrets` — real values, **gitignored**, never committed.
- `.kamal/secrets.example` — safe template with `CHANGE_ME` placeholders,
  committed.
- **kamal has NO `secret()` ERB helper.** Verified: `grep -rn "def secret"
  lib/kamal` across the kamal 2.12.0 gem returns nothing. Do **not** write
  `<%= secret("NAME") %>` in a deploy.yml — it fails at ERB eval with
  `NoMethodError: undefined method 'secret' for main` (ERB is evaluated in
  the top-level binding, where no such method exists). Blog posts / AI
  examples that show `secret()` in kamal configs are wrong for this version.
- **ERB evaluates tags even inside YAML comments.** kamal runs deploy.yml
  through ERB *before* YAML parses, so a literal `<%= … %>` in a `#`
  comment still executes — and a `secret()` call there fails with the same
  `NoMethodError`. If you mention `secret()` in a comment, write it as
  `secret("X")` (no `<%=` `%>` wrappers), or the comment itself breaks
  config parse. This is the actual root cause when a "commented-out" ERB
  tag blows up.
- **Reference secrets as plain YAML name lists, not ERB.** kamal reads the
  values from `.kamal/secrets` (dotenv) for each name you list:
  ```yaml
  env:                    # runtime container env (stored in an env file on the host, not on the CLI)
    clear:
      DB_HOST: myapp-db
    secret:
      - DATABASE_URL
      - SECURITY_SALT
  registry:
    password:
      - KAMAL_REGISTRY_PASSWORD
  builder:
    secrets:              # Docker build secrets (--mount=type=secret) — see §10
      - VITE_SUPABASE_URL
  accessories:
    db:
      env:
        secret:
          - MYSQL_PASSWORD
  ```
- A shared secret like `MYSQL_PASSWORD` is used in two places: passed to
  MariaDB when the accessory boots, and in the app's `DATABASE_URL`. Pick
  one value, use it in both.

---

## 10. Build-time vs runtime env (VITE_ vars)

`VITE_`-prefixed vars are **build-time** — Vite inlines them into the
client bundle at build time, not runtime. Two cases:

**Non-secret build value** → plain build arg + Dockerfile `ARG`/`ENV`:
```yaml
builder:
  args:
    VITE_API_BASE_URL: https://api.example.com/api
```
```dockerfile
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
```

**Secret build value** → `builder.secrets` + Dockerfile build-secret mount.
Do NOT put secret values in `builder.args` (ARG/ENV bakes them into image
layers, and there's no `secret()` ERB to reference them anyway). kamal
reads each name from `.kamal/secrets` and passes it as
`--secret id=NAME,env=NAME`; the Dockerfile mounts it at `/run/secrets/NAME`
for the single build `RUN` only, so it never enters an image layer:
```yaml
builder:
  secrets:
    - VITE_SUPABASE_URL
    - VITE_SUPABASE_PUBLISHABLE_KEY
```
```dockerfile
RUN --mount=type=secret,id=VITE_SUPABASE_URL \
    --mount=type=secret,id=VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_URL=$(cat /run/secrets/VITE_SUPABASE_URL) \
    VITE_SUPABASE_PUBLISHABLE_KEY=$(cat /run/secrets/VITE_SUPABASE_PUBLISHABLE_KEY) \
    bun run build
```
Prefixing the exports onto the build command makes Vite (a child process)
inherit them as env for that RUN only. Requires BuildKit (kamal uses it by
default).

Never commit a `.env` with real VITE_ values — the publishable key is
public by design (ships in client JS) but project-specific values belong in
`.kamal/secrets`. Runtime-only app config (API) goes in `env.clear` /
`env.secret` at the top level, not `builder.args`.

**Caveat — SPA prerender may not work in-docker.** TanStack Start's SPA mode
forces `prerender.enabled: true` (the schema hard-codes it after your opts)
to emit the shell HTML. Prerender spins up a `vite preview` server (port 0)
and crawls `/`. Locally (Nitro `node-server` preset, `.env` loaded) this
works. Under the **bun** Nitro preset inside a `oven/bun:1` docker build,
the preview server fails to bind and the crawl dies with
`ConnectionRefused localhost:3000` after ~140s, prerendering 0 pages — so
no `_shell.html`, and any `cp _shell.html index.html` step fails. If you
hit this, the robust fix is to **build the SPA locally** (where the
prerender works) and ship the pre-built static output: the Dockerfile
becomes `FROM nginx:alpine` + `COPY .output/public /usr/share/nginx/html`,
`.dockerignore` must NOT exclude `.output/`, and the deploy becomes
`( cd web && bun run build ) && kamal deploy -c config/deploy.web.yml`.
Public VITE_ vars (Supabase URL + publishable key) then just live in a
gitignored `web/.env` for the local build — no `builder.secrets` needed at
all. Reserve `builder.secrets` for values that are actually secret AND
must be available at docker-build time.

---

## 11. PHP/Alpine image gotchas (CakePHP stack)

Specific to a `php:8.x-fpm-alpine` + nginx + php-fpm-in-one-container image:

- **Static extensions already baked in** to `php:8.x-fpm-alpine`:
  mbstring, ctype, simplexml, xml, dom, opcache, PDO, curl. Running
  `docker-php-ext-install` on any of these →
  `cp: can't stat 'modules/*'` (nothing to build). Only add what's missing.
- **CakePHP 5 requires:** mbstring, intl, pdo, simplexml (+ pdo_mysql for
  MySQL). Of those, only `intl` (needs `icu-dev`) and `pdo_mysql` (uses
  built-in mysqlnd, needs nothing) must be added.
- **Don't `apk del icu-dev` after building intl.** `intl.so` links the ICU
  shared libraries at runtime; removing `icu-dev` removes those libs and
  intl fails to load. Keep `icu-dev icu-data-en` in the final image (small).
- **Composer:** `COPY --from=composer:2 /usr/bin/composer /usr/bin/composer`.
  Do **not** `apk add composer` — that pulls Alpine's system `php8x` (a
  second PHP install at `/etc/php8x`) which lacks `intl` and makes
  `composer install` fail against the image's PHP.
- **One container, two processes** (nginx + php-fpm): nginx in background,
  php-fpm as the foreground PID, orchestrated by a tiny entrypoint script.
  No supervisor needed. Migrations run in the entrypoint before php-fpm
  starts — single replica = no race, phinx is idempotent. A failed
  migration exits the container → healthcheck fails → rollback.

---

## 12. CakePHP prod config via env

- **DEBUG off:** `config/app.php` reads
  `'debug' => filter_var(env('DEBUG', false), FILTER_VALIDATE_BOOLEAN)`.
  Set `DEBUG: "false"` (quoted string) in `env.clear` — `filter_var`
  parses `"false"` → `false`. An unquoted `false` in YAML is also fine;
  the point is the string `"false"` is handled correctly, it is NOT
  truthy.
- **`APP_FULL_BASE_URL` is required in prod.** A host-header-injection
  guard middleware throws `BadRequestException` (400) on any request whose
  `Host` header doesn't match the configured host. This is what 400's the
  kamal-proxy healthcheck (§6) — the healthcheck's Host ≠ the public
  hostname. Set `APP_FULL_BASE_URL: https://api.example.com` in `env.clear`.

---

## 13. macOS as the deploy target

- Daemons run under **launchd**, not systemd. Restart a system daemon:
  `sudo launchctl kickstart -k system/<label>`. PID 1 is launchd.
- `launchctl list` (no sudo) lists **user agents only** — system daemons
  don't appear. Use `ps aux | grep [name]` to check a daemon is alive.
- The home dir is `/Users/<user>/` (not `/home/<user>/`).
- cloudflared config lives at `~/.cloudflared/config.yml` regardless of
  running as root (the plist points at the user's config path).

---

## 14. Pre-flight checklist (next project)

- [ ] `image:` bare in every config (no registry prefix).
- [ ] `servers:` + every accessory `host:` bare (no `user@`).
- [ ] `ssh: { user: …, config: true }` (config:true if key isn't default-named).
- [ ] No `.local` mDNS hosts — use LAN IP or `/etc/hosts`.
- [ ] `builder.arch` set to the server's `uname -m`.
- [ ] `registry:2` running on the server; `localhost:5555` as the server.
- [ ] All apps on the host share one `proxy.run.http_port` (80); kamal-proxy
      routes by Host. Don't assign per-app ports.
- [ ] A healthcheck path that returns 2xx **without** going through host/auth
      middleware (static webroot file is the safe default); set
      `proxy.healthcheck.path`.
- [ ] `ssl: false` if cloudflared owns TLS; cloudflared ingress routes each
      hostname → `localhost:80`; restart cloudflared after editing config.
- [ ] `.kamal/secrets` filled (from `.kamal/secrets.example`), gitignored.
- [ ] Accessory `host:` bare; app connects to DB by `<service>-<accessory>`
      DNS name, not localhost; `MYSQL_PASSWORD` matches the `DATABASE_URL`.
- [ ] Build-time vars (VITE_): non-secret → `builder.args` + Dockerfile
      ARG/ENV; **secret** values → `builder.secrets` + Dockerfile
      `--mount=type=secret` (never ARG/ENV — bakes into layers). Public VITE_
      vars (Supabase URL + publishable key) don't need build secrets at all —
      a gitignored `web/.env` for a local build is simpler. No
      `<%= secret() %>` ERB (kamal has none). If a SPA prerender fails
      in-docker (ConnectionRefused on its preview server), build locally and
      ship the pre-built static output instead (see §10 caveat).
- [ ] Prod app env: `DEBUG: "false"`, `APP_FULL_BASE_URL` set, `ssl: false`.
- [ ] Migrations run in the container entrypoint (idempotent, single replica).