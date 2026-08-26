// Shared `?page=&limit=` query-string builder for the paginated list tools
// (api-contract.md#pagination). Returns "" when neither param is set, so it
// splices straight into a path with no trailing "?".

export function pagination(p: { page?: number; limit?: number }): string {
  const sp = new URLSearchParams();
  if (p.page !== undefined) sp.set("page", String(p.page));
  if (p.limit !== undefined) sp.set("limit", String(p.limit));
  const s = sp.toString();
  return s ? `?${s}` : "";
}