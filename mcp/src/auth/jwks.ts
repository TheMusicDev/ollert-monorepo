// JWKS fetcher — jose's createRemoteJWKSet against SUPABASE_JWKS_URL, with the
// same cache TTL api/'s SupabaseJwksProvider uses (900s default). jose handles
// fetching + caching internally; the TTL option caps how long a cached key set
// is reused before re-fetching. Ports api/src/Auth/SupabaseJwksProvider.php.

import { createRemoteJWKSet } from "jose";
import { config } from "#/config";

export const jwks = createRemoteJWKSet(new URL(config.jwksUrl), {
  cooldownDuration: config.jwksCacheTtlMs,
  cacheMaxAge: config.jwksCacheTtlMs,
});