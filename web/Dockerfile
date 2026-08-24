# Web SPA — ships static files in nginx.
#
# The SPA is built LOCALLY (bun run build in web/, reading web/.env) BEFORE
# `kamal deploy`, not in docker. TanStack Start's SPA prerender spins up a
# vite preview server to crawl `/` and emit _shell.html; under the bun Nitro
# preset inside docker that preview server fails to bind (ConnectionRefused
# localhost:3000, 0 pages prerendered). Building locally (node-server preset,
# web/.env loaded) works reliably — same as scripts/deploy-web.sh always has.
# VITE_ vars are public anyway (publishable key + URL ship in the client
# bundle), so no build-secret machinery needed. kamal ships the pre-built
# .output/public (must NOT be dockerignored — see web/.dockerignore).
FROM nginx:alpine

# Pre-built SPA from the local `bun run build` (in the kamal build context).
COPY .output/public /usr/share/nginx/html

# SPA mode prerenders the shell to _shell.html, not index.html. nginx
# try_files falls back to index.html, so copy the shell to that name.
RUN cp /usr/share/nginx/html/_shell.html /usr/share/nginx/html/index.html

COPY web.nginx.conf /etc/nginx/conf.d/default.conf