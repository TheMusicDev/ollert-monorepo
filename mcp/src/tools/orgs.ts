// Orgs tools — 1:1 with api-contract.md#Organizations.

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { apiFetch } from "#/apiClient";
import type { Org, Paginated } from "#/types";
import { run } from "#/tools/result";

export function registerOrgs(server: McpServer, bearer: string): void {
  server.registerTool(
    "list_orgs",
    {
      description: "List orgs the current user owns or belongs to (paginated).",
      inputSchema: z.object({
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
      }),
    },
    async (a) => run(() => apiFetch<Paginated<Org>>(qs("/api/orgs", a), bearer)),
  );

  server.registerTool(
    "create_org",
    { description: "Create an org; creator becomes owner.", inputSchema: z.object({ name: z.string().min(1) }) },
    async (a) => run(() => apiFetch<Org>("/api/orgs", bearer, { method: "POST", body: JSON.stringify(a) })),
  );

  server.registerTool(
    "get_org",
    { description: "Get one org with its boards.", inputSchema: z.object({ id: z.string().uuid() }) },
    async (a) => run(() => apiFetch<Org>(`/api/orgs/${a.id}`, bearer)),
  );

  server.registerTool(
    "update_org",
    { description: "Rename an org (owner or member).", inputSchema: z.object({ id: z.string().uuid(), name: z.string().min(1) }) },
    async (a) => run(() => apiFetch<Org>(`/api/orgs/${a.id}`, bearer, { method: "PATCH", body: JSON.stringify({ name: a.name }) })),
  );

  server.registerTool(
    "delete_org",
    { description: "Delete an org (owner only; soft delete).", inputSchema: z.object({ id: z.string().uuid() }) },
    async (a) => run(() => apiFetch<{ id: string }>(`/api/orgs/${a.id}`, bearer, { method: "DELETE" })),
  );
}

// Build a query string from a {page,limit}-shaped object (omits undefined).
function qs(base: string, p: Record<string, number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}