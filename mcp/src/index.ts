// Entrypoint: load + validate config (fails fast if env missing), build the
// fetch handler (fetches Supabase AS metadata once at startup), start Bun.serve.
// Bun speaks Web Standards (Request/Response), so createMcpHandler's handler
// works natively — no Hono, no node-server adapter, no Node http module.

import { config } from "#/config";
import { buildHandler } from "#/server";

const fetch = await buildHandler();

const server = Bun.serve({ port: config.port, fetch });
console.log(`ollert-mcp listening on http://localhost:${server.port}`);
console.log(`  MCP endpoint:         ${config.mcpPublicBaseUrl}/mcp`);
console.log(`  resource metadata:    ${config.mcpPublicBaseUrl}/.well-known/oauth-protected-resource/mcp`);
console.log(`  api upstream:         ${config.apiBaseUrl}`);

// ponytail: no graceful-shutdown handler — kamal stops the container with
// SIGTERM and Bun exits; no in-flight state worth draining (stateless, every
// request stands alone). Add a process.on('SIGTERM') if long SSE streams
// start losing work on deploys.