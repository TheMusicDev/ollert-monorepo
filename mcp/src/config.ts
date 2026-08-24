// Env loading + validation. Fail fast at boot — a missing Supabase URL or
// JWKS URL means every request 401s, so crash instead of serving broken.
// Mirrors api/'s SUPABASE_* names exactly (see api/.env.example).

const need = (name: string): string => {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`mcp: missing required env ${name}. See mcp/.env.example.`);
    process.exit(1);
  }
  return v.trim();
};

export const config = {
  supabaseUrl: need("SUPABASE_URL"),
  jwksUrl: need("SUPABASE_JWKS_URL"),
  jwtIss: need("SUPABASE_JWT_ISS"),
  jwtAud: need("SUPABASE_JWT_AUD"),
  asMetadataUrl: need("SUPABASE_AS_METADATA_URL"),
  // JWKS cache TTL in seconds; jose's createRemoteJWKSet takes ms.
  jwksCacheTtlMs: (Number(process.env.JWKS_CACHE_TTL ?? "900") || 900) * 1000,
  apiBaseUrl: need("API_BASE_URL").replace(/\/$/, ""),
  mcpPublicBaseUrl: need("MCP_PUBLIC_BASE_URL").replace(/\/$/, ""),
  port: Number(process.env.PORT ?? "8766") || 8766,
} as const;

export type Config = typeof config;