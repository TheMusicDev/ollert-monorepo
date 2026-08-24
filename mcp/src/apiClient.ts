// Thin fetch wrapper → api/. Forwards the caller's Bearer token UNCHANGED
// (api/'s AuthMiddleware verifies it exactly as it does for the frontend —
// mcp/ is a pure resource server, never mints/owns tokens). Translates api/'s
// {error:{...}} envelope into a thrown ApiCallError the tool layer turns into
// an isError MCP result. Mirrors planning/api-contract.md.

import { config } from "#/config";
import type { ApiErrorBody } from "#/types";

export class ApiCallError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Partial<Record<string, string[]>>,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  bearer: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    // ponytail: caller-supplied headers spread FIRST so the verified
    // Authorization + Accept + Content-Type below can never be clobbered by
    // a caller passing its own Authorization. Auth header is a trust boundary
    // — the resource server's own token must always win.
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${bearer}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiCallError(
      res.status,
      err?.code ?? "http_error",
      err?.message ?? `API ${res.status}`,
      err?.fields,
    );
  }

  return body as T;
}