# Bun runtime image for the MCP server. No build step — Bun runs TS directly,
# so this is a single-stage copy + install. Secrets come in as env at runtime
# (kamal injects them), never baked into the image.

FROM oven/bun:1.3.14

WORKDIR /srv/mcp

# Install deps first for layer caching. --production skips devDeps (typescript
# is only needed for local typecheck, not runtime). --frozen-lockfile locks
# resolution to the committed bun.lock for reproducible image builds.
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

COPY . .

EXPOSE 8766

# Run as a non-root user — the base image has no USER set, so without this the
# process runs as root.
RUN useradd -m -s /bin/sh mcp && chown -R mcp:mcp /srv/mcp
USER mcp

# Bun serves Web-Standard Request/Response directly.
CMD ["bun", "run", "src/index.ts"]