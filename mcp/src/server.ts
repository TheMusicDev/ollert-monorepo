// Web-standard fetch handler: MCP streamable-HTTP at /mcp + RFC 9728 metadata
// + a liveness route. No Hono — createMcpHandler returns a web-standard
// `{ fetch }` handler Bun serves directly, and the SDK ships web-standard
// auth helpers (requireBearerAuth, oauthMetadataResponse) that take/return
// Request/Response. Fewer deps, fewer files (ponytail: dropped
// @modelcontextprotocol/hono — the design doc's Hono choice predates the
// SDK's per-request fetch-handler pattern).
//
// Auth is enforced on /mcp only — the metadata routes MUST be unauthenticated
// (claude.ai fetches protected-resource metadata *before* it has a token, to
// bootstrap discovery → find Supabase's AS → run the OAuth dance).
//
// Stateless, per-request server: every /mcp POST carries its own Bearer token
// (MCP auth spec: "authorization MUST be included in every HTTP request"), so
// requireBearerAuth validates it, the factory builds a throwaway McpServer with
// tools closing over that bearer, and createMcpHandler hands the request to a
// fresh stateless transport. No session map, no shared state.

import {
  McpServer,
  createMcpHandler,
  requireBearerAuth,
  oauthMetadataResponse,
  getOAuthProtectedResourceMetadataUrl,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  type AuthMetadataOptions,
  type BearerAuthOptions,
  type OAuthMetadata,
} from "@modelcontextprotocol/server";
import { verifier } from "#/auth/verifyToken";
import { registerAllTools } from "#/tools";
import { config } from "#/config";

const SERVER_INFO = { name: "ollert-mcp", version: "0.1.0" };

// The canonical MCP resource URL = the streamable-HTTP endpoint. RFC 9728
// derives the metadata route path-aware from this: /mcp →
// /.well-known/oauth-protected-resource/mcp (what claude.ai requests).
const resourceServerUrl = new URL("/mcp", config.mcpPublicBaseUrl);
const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(resourceServerUrl);

const authOptions: BearerAuthOptions = {
  verifier,
  // mcp/ enforces no scopes itself — api/'s AuthMiddleware + controllers own
  // per-user authorization + quotas. Leave empty so any valid Supabase token passes.
  requiredScopes: [],
  resourceMetadataUrl,
};

const gate = requireBearerAuth(authOptions);

// Hostnames the Host header may carry (DNS-rebinding protection). The public
// tunnel domain plus the localhost variants for local dev.
const allowedHostnames = [resourceServerUrl.hostname, ...localhostAllowedHostnames()];

export async function buildHandler(): Promise<(request: Request) => Promise<Response>> {
  // Fetch Supabase's AS metadata once at startup. buildOAuthProtectedResourceMetadata
  // (called inside oauthMetadataResponse) validates the issuer URL is HTTPS and embeds
  // it as `authorization_servers` so clients discover Supabase's own AS endpoints.
  // Bound the startup metadata fetch — without a deadline a stalled request
  // hangs the server (no /health) until Bun's ~300s socket-idle timeout.
  let res: Response;
  try {
    res = await fetch(config.asMetadataUrl, { signal: AbortSignal.timeout(5_000) });
  } catch (e) {
    console.error(`mcp: failed to fetch AS metadata from ${config.asMetadataUrl} (${e instanceof Error ? e.message : String(e)}).`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`mcp: failed to fetch AS metadata from ${config.asMetadataUrl} (${res.status}).`);
    process.exit(1);
  }
  const oauthMetadata = (await res.json()) as OAuthMetadata;

  const metadataOptions: AuthMetadataOptions = {
    oauthMetadata,
    resourceServerUrl,
    resourceName: "Ollert",
  };

  const handler = createMcpHandler(
    (ctx) => {
      const server = new McpServer(SERVER_INFO);
      // ctx.authInfo is pass-through from handler.fetch({ authInfo }) below;
      // requireBearerAuth already verified the token. Forward it unchanged.
      registerAllTools(server, ctx.authInfo?.token ?? "");
      return server;
    },
    { legacy: "stateless" },
  );

  async function fetchHandler(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Liveness probe — exempt from the Host-header guard below. kamal-proxy's
    // healthcheck hits the container by docker-internal hostname/IP, whose Host
    // header isn't in `allowedHostnames` and would 403 — same shape as api's
    // nginx-serves-/health-statically bypass. Returns only "ok", no sensitive
    // data, so DNS-rebinding protection adds nothing here.
    if (url.pathname === "/health") return new Response("ok", { headers: { "Content-Type": "text/plain" } });

    // DNS-rebinding guard on every other request (metadata routes included).
    const hostViolation = hostHeaderValidationResponse(request, allowedHostnames);
    if (hostViolation) return hostViolation;

    // Serves /.well-known/oauth-protected-resource/mcp (+ the AS route, unused)
    // unauthenticated with permissive CORS + preflight handling.
    const meta = oauthMetadataResponse(request, metadataOptions);
    if (meta) return meta;

    if (url.pathname !== "/mcp") return new Response("Not Found", { status: 404 });

    const auth = await gate(request);
    if (auth instanceof Response) return auth; // 401/403 WWW-Authenticate challenge

    return handler.fetch(request, { authInfo: auth });
  }

  return fetchHandler;
}