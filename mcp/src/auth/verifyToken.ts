// Token verification — ports api/src/Middleware/AuthMiddleware.php's
// verifyToken() + assertClaims(). jose's jwtVerify checks RS256 signature,
// exp, iss, and aud; we additionally require a non-empty `sub` + `email`
// (the local users-table provisioning in api/ needs both). Every failure
// throws OAuthError(InvalidToken) so the SDK's bearerAuthChallengeResponse
// answers with a uniform 401 — nothing about *why* leaks, matching
// AuthMiddleware's bodyless 401.
//
// aud note (planning/mcp-server.md open risk): jose's `audience` option
// accepts string | string[] and matches if the token's aud contains it, so a
// string-or-array aud claim is handled without a separate branch. If
// OAuth-flow tokens turn out to carry a different aud than SUPABASE_JWT_AUD,
// widen `expectedAud` here — this is the single place to do it.

import { jwtVerify, type JWTPayload } from "jose";
import {
  OAuthError,
  OAuthErrorCode,
  type AuthInfo,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import { jwks } from "#/auth/jwks";
import { config } from "#/config";

function invalidToken(detail: string): never {
  throw new OAuthError(OAuthErrorCode.InvalidToken, detail);
}

// Verify a raw bearer JWT and return SDK AuthInfo. `token` is the raw bearer
// forwarded unchanged to api/; `expiresAt` (seconds) MUST be set or the SDK's
// bearer-auth gate rejects the token — populated from the JWT `exp` claim.
export async function verifyAccessToken(
  raw: string,
  expectedAud: string = config.jwtAud,
  // Injected for tests (a local public key); production leaves it at the
  // default remote JWKS so no test ever hits Supabase over HTTP.
  keys: Parameters<typeof jwtVerify>[1] = jwks,
): Promise<AuthInfo> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(raw, keys, {
      issuer: config.jwtIss,
      audience: expectedAud,
    }));
  } catch {
    invalidToken("signature/exp/iss/aud");
  }

  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email : "";
  if (!sub || !email) invalidToken("sub/email");

  // `exp` is seconds-since-epoch in JWTs; AuthInfo.expiresAt is the same unit.
  // jwtVerify already rejected an expired/missing exp above, so it is set here.
  const expiresAt = payload.exp;
  const scopes =
    typeof payload.scope === "string"
      ? payload.scope.split(" ").filter(Boolean)
      : [];
  const clientId =
    typeof payload.client_id === "string" ? payload.client_id : "";

  return {
    token: raw,
    clientId,
    scopes,
    ...(expiresAt !== undefined ? { expiresAt } : {}),
    extra: { sub, email },
  };
}

// OAuthTokenVerifier object the SDK's requireBearerAuth/verifyBearerToken
// expects (BearerAuthOptions.verifier). mcp/ enforces no scopes itself —
// api/'s AuthMiddleware + controllers own per-user authorization + quotas.
export const verifier: OAuthTokenVerifier = {
  verifyAccessToken: (token) => verifyAccessToken(token),
};