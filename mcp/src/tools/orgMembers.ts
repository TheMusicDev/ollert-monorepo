// Org-member tools — 1:1 with api-contract.md#Org Members.

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { apiFetch } from "#/apiClient";
import type { OrgMember, Paginated } from "#/types";
import { pagination } from "#/tools/pagination";
import { run } from "#/tools/result";

export function registerOrgMembers(server: McpServer, bearer: string): void {
  server.registerTool(
    "list_org_members",
    {
      description: "List members of an org (paginated).",
      inputSchema: z.object({
        org_id: z.string().uuid(),
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async (a) => run(() => apiFetch<Paginated<OrgMember>>(`/api/orgs/${a.org_id}/members${pagination(a)}`, bearer)),
  );

  server.registerTool(
    "add_org_member",
    {
      description: "Add a member by email (must already have an Ollert account).",
      inputSchema: z.object({ org_id: z.string().uuid(), email: z.string().email() }),
    },
    async (a) => run(() => apiFetch<OrgMember>(`/api/orgs/${a.org_id}/members`, bearer, { method: "POST", body: JSON.stringify({ email: a.email }) })),
  );

  server.registerTool(
    "remove_org_member",
    {
      description: "Remove a member (owner only, or a member removing themself).",
      inputSchema: z.object({ org_id: z.string().uuid(), user_id: z.string().uuid() }),
      annotations: { destructiveHint: true },
    },
    async (a) => run(() => apiFetch<{ id: string }>(`/api/orgs/${a.org_id}/members/${a.user_id}`, bearer, { method: "DELETE" })),
  );
}