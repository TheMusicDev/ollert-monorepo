// Board tools — 1:1 with api-contract.md#Boards.

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { apiFetch } from "#/apiClient";
import type { Board, Paginated } from "#/types";
import { pagination } from "#/tools/pagination";
import { run } from "#/tools/result";

export function registerBoards(server: McpServer, bearer: string): void {
  server.registerTool(
    "list_org_boards",
    {
      description: "List boards in an org (paginated).",
      inputSchema: z.object({
        org_id: z.string().uuid(),
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async (a) => run(() => apiFetch<Paginated<Board>>(`/api/orgs/${a.org_id}/boards${pagination(a)}`, bearer)),
  );

  server.registerTool(
    "create_board",
    {
      description: "Create a board under an org (org owner only; 422 if over max_boards_per_org).",
      inputSchema: z.object({ org_id: z.string().uuid(), title: z.string().min(1) }),
    },
    async (a) => run(() => apiFetch<Board>(`/api/orgs/${a.org_id}/boards`, bearer, { method: "POST", body: JSON.stringify({ title: a.title }) })),
  );

  server.registerTool(
    "get_board",
    {
      description: "Get a board with its lists + cards nested (unpaginated — full kanban).",
      inputSchema: z.object({ id: z.string().uuid() }),
      annotations: { readOnlyHint: true },
    },
    async (a) => run(() => apiFetch<Board>(`/api/boards/${a.id}`, bearer)),
  );

  server.registerTool(
    "update_board",
    {
      description: "Rename a board (any org member).",
      inputSchema: z.object({ id: z.string().uuid(), title: z.string().min(1) }),
    },
    async (a) => run(() => apiFetch<Board>(`/api/boards/${a.id}`, bearer, { method: "PATCH", body: JSON.stringify({ title: a.title }) })),
  );

  server.registerTool(
    "delete_board",
    {
      description: "Delete a board (any org member; soft delete).",
      inputSchema: z.object({ id: z.string().uuid() }),
      annotations: { destructiveHint: true },
    },
    async (a) => run(() => apiFetch<{ id: string }>(`/api/boards/${a.id}`, bearer, { method: "DELETE" })),
  );
}