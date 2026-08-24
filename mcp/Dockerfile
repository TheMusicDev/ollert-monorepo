# Bun runtime image for the MCP server. No build step — Bun runs TS directly,
# so this is a single-stage copy + install. Secrets come in as env at runtime
# (kamal injects them), never baked into the image.

FROM oven/bun:1.3.14

WORKDIR /srv/mcp

# Install deps first for layer caching. --production skips devDeps (typescript
# is only needed for local typecheck, not runtime).
COPY package.json ./
# ponytail: no --frozen-lockfile yet — bun.lock isn't committed (generated on
# first `bun install`). Add it + --frozen-lockfile once a lock exists for
# reproducible image builds.
RUN bun install --production

COPY . .

EXPOSE 8766

# Bun serves Web-Standard Request/Response directly.
CMD ["bun", "run", "src/index.ts"]