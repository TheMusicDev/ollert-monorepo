// Token-verification tests + a bidirectional drift guard against
// api/src/Middleware/AuthMiddleware.php. verifyToken.ts is a 1:1 port of
// AuthMiddleware::verifyToken() + assertClaims(); these tests lock that
// parity so a change on one side without the other is caught here, not in
// production. Mirrors api/tests/TestCase/Middleware/AuthMiddlewareTest.php's
// forged/bad-sig/expired/wrong-iss/wrong-aud/missing-sub/missing-email
// patterns, adapted to jose + bun:test.
//
// Drift guard: the canonical claim set both files enforce is
// {iss, aud, exp, sub, email} (planning/architecture.md#auth-flow). The guard
// asserts (a) every canonical claim is still enforced on each side, and
// (b) neither side enforces a claim outside that set. AuthMiddleware.php is
// the source of truth — if its enforcement shape changes, update the
// detectors here in the same commit.

import { describe, expect, it, beforeAll } from "bun:test";
import { generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const ISS = "https://test.supabase.co/auth/v1";
const AUD = "authenticated";
const SUB = "00000000-0000-0000-0000-000000000001";
const EMAIL = "user@test.supabase.co";

// config.ts calls process.exit on any missing env at module load, and
// verifyToken.ts imports config at the top — so env must be in place before
// the dynamic import. Set every `need()`-ed var to test values.
beforeAll(() => {
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_JWKS_URL = "https://test.supabase.co/auth/v1/.well-known/jwks.json";
  process.env.SUPABASE_JWT_ISS = ISS;
  process.env.SUPABASE_JWT_AUD = AUD;
  process.env.SUPABASE_AS_METADATA_URL =
    "https://test.supabase.co/.well-known/oauth-authorization-server";
  process.env.API_BASE_URL = "https://ollert-api.example.test";
  process.env.MCP_PUBLIC_BASE_URL = "https://ollert-mcp.example.test";
});

// Resolved lazily after env is set. `keys` (a local public key) is injected
// per-call so no test ever hits Supabase's JWKS over HTTP.
let verifyAccessToken: typeof import("#/auth/verifyToken").verifyAccessToken;
let goodKeys: { publicKey: CryptoKey; privateKey: CryptoKey };
let badKeys: { publicKey: CryptoKey; privateKey: CryptoKey };

beforeAll(async () => {
  ({ verifyAccessToken } = await import("#/auth/verifyToken"));
  goodKeys = await generateKeyPair("RS256");
  badKeys = await generateKeyPair("RS256");
});

async function makeToken(overrides: {
  payload?: JWTPayload;
  issuer?: string;
  audience?: string;
  expiresIn?: string;
  signWith?: CryptoKey;
} = {}): Promise<string> {
  return new SignJWT(overrides.payload ?? { sub: SUB, email: EMAIL })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setIssuer(overrides.issuer ?? ISS)
    .setAudience(overrides.audience ?? AUD)
    .setExpirationTime(overrides.expiresIn ?? "1h")
    .sign(overrides.signWith ?? goodKeys.privateKey);
}

// Every failure path must surface as OAuthError(InvalidToken) — matching
// AuthMiddleware's uniform bodyless 401 (nothing about *why* leaks). Manual
// try/catch because bun:test's `.rejects.toSatisfy` does not unwrap the
// rejection reason before invoking the predicate.
async function expectInvalidToken(p: Promise<unknown>): Promise<void> {
  try {
    await p;
    throw new Error("expected verifyAccessToken to reject, but it resolved");
  } catch (e) {
    expect(e).toBeInstanceOf(OAuthError);
    expect((e as OAuthError).code).toBe(OAuthErrorCode.InvalidToken);
  }
}

describe("verifyAccessToken", () => {
  it("accepts a valid token and returns AuthInfo with sub/email/expiresAt", async () => {
    const raw = await makeToken();
    const result = await verifyAccessToken(raw, AUD, goodKeys.publicKey);

    expect(result.token).toBe(raw);
    expect(result.extra?.sub).toBe(SUB);
    expect(result.extra?.email).toBe(EMAIL);
    expect(typeof result.expiresAt).toBe("number");
  });

  it("rejects a bad signature (signed with a different key)", async () => {
    const raw = await makeToken({ signWith: badKeys.privateKey });
    await expectInvalidToken(verifyAccessToken(raw, AUD, goodKeys.publicKey));
  });

  it("rejects an expired token", async () => {
    const raw = await makeToken({ expiresIn: "-1m" });
    await expectInvalidToken(verifyAccessToken(raw, AUD, goodKeys.publicKey));
  });

  it("rejects a wrong issuer", async () => {
    const raw = await makeToken({
      issuer: "https://not-our-project.supabase.co/auth/v1",
    });
    await expectInvalidToken(verifyAccessToken(raw, AUD, goodKeys.publicKey));
  });

  it("rejects a wrong audience", async () => {
    const raw = await makeToken({ audience: "some-other-audience" });
    await expectInvalidToken(verifyAccessToken(raw, AUD, goodKeys.publicKey));
  });

  it("rejects a token missing sub", async () => {
    const raw = await makeToken({ payload: { email: EMAIL } });
    await expectInvalidToken(verifyAccessToken(raw, AUD, goodKeys.publicKey));
  });

  it("rejects a token missing email", async () => {
    const raw = await makeToken({ payload: { sub: SUB } });
    await expectInvalidToken(verifyAccessToken(raw, AUD, goodKeys.publicKey));
  });

  it("rejects a malformed token", async () => {
    await expectInvalidToken(
      verifyAccessToken("not-a-jwt", AUD, goodKeys.publicKey),
    );
  });
});

// --- Bidirectional drift guard vs api/src/Middleware/AuthMiddleware.php ---
//
// The canonical claim set both files enforce. A claim added or dropped on
// either side without the other is drift this guard catches.
const CANONICAL = ["iss", "aud", "exp", "sub", "email"] as const;

// Per-claim enforcement detectors — match the *enforcement expression* in
// each file, not mere access. Tied to the current shape on both sides; if
// either file's enforcement is rewritten, update the matching detector in
// the same commit (that's the whole point — make the coupling visible).
const PHP_DETECTORS: Record<string, RegExp> = {
  iss: /\$iss\s*!==\s*\$expectedIss/,
  aud: /!\$audMatches/,
  exp: /JWT::decode/,
  sub: /!\$subValid/,
  email: /!\$emailValid/,
};

const TS_DETECTORS: Record<string, RegExp> = {
  iss: /issuer:\s*config\.jwtIss/,
  aud: /audience:\s*expectedAud/,
  exp: /jwtVerify/,
  sub: /if\s*\(\s*!sub\b/,
  email: /!email\b/,
};

const HERE = fileURLToPath(new URL(".", import.meta.url)); // .../mcp/src/auth/
const phpSrc = readFileSync(
  `${HERE}../../../api/src/Middleware/AuthMiddleware.php`,
  "utf8",
);
const tsSrc = readFileSync(`${HERE}verifyToken.ts`, "utf8");

describe("drift guard: verifyToken.ts vs AuthMiddleware.php", () => {
  it("PHP enforces every canonical claim", () => {
    for (const claim of CANONICAL) {
      expect(PHP_DETECTORS[claim].test(phpSrc), `PHP dropped ${claim}`).toBe(
        true,
      );
    }
  });

  it("TS enforces every canonical claim", () => {
    for (const claim of CANONICAL) {
      expect(TS_DETECTORS[claim].test(tsSrc), `TS dropped ${claim}`).toBe(true);
    }
  });

  it("PHP enforces no claim outside the canonical set", () => {
    const enforced = new Set<string>();
    // `!$fooValid` guards → foo
    for (const m of phpSrc.matchAll(/!\$(\w+)Valid/g)) enforced.add(m[1].toLowerCase());
    // `$foo !== $expectedFoo` guards → foo
    for (const m of phpSrc.matchAll(/\$(\w+)\s*!==\s*\$expected\w+/g))
      enforced.add(m[1].toLowerCase());
    if (/\bJWT::decode\b/.test(phpSrc)) enforced.add("exp");
    if (/!\$audMatches/.test(phpSrc)) enforced.add("aud");

    const extras = [...enforced].filter((c) => !CANONICAL.includes(c as never));
    expect(enforced, `PHP added unguarded claims: ${extras.join(", ")}`).toEqual(
      new Set(CANONICAL),
    );
  });

  it("TS enforces no claim outside the canonical set", () => {
    const enforced = new Set<string>();
    // The required-claim guard is `if (!sub || !email || …)` — capture every
    // `!identifier` inside any `if (...)` so a newly added claim surfaces.
    for (const m of tsSrc.matchAll(/if\s*\(\s*([^)]+?)\)/g)) {
      for (const g of m[1].matchAll(/!\s*(\w+)/g)) enforced.add(g[1].toLowerCase());
    }
    if (/issuer:\s*config\.jwtIss/.test(tsSrc)) enforced.add("iss");
    if (/audience:\s*expectedAud/.test(tsSrc)) enforced.add("aud");
    if (/\bjwtVerify\b/.test(tsSrc)) enforced.add("exp");

    const extras = [...enforced].filter((c) => !CANONICAL.includes(c as never));
    expect(enforced, `TS added unguarded claims: ${extras.join(", ")}`).toEqual(
      new Set(CANONICAL),
    );
  });
});