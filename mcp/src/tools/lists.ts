// List tools — 1:1 with api-contract.md#Lists.

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { apiFetch } from "#/apiClient";
import type { List, Paginated } from "#/types";
import { pagination } from "#/tools/pagination";
import { run } from "#/tools/result";

export function registerLists(server: McpServer, bearer: string): void {
  server.registerTool(
    "list_lists",
    {
      description: "List lists on a board (paginated, ordered by position ASC).",
      inputSchema: z.object({
        board_id: z.string().uuid(),
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async (a) => run(() => apiFetch<Paginated<List>>(`/api/boards/${a.board_id}/lists${pagination(a)}`, bearer)),
  );

  server.registerTool(
    "create_list",
    {
      description: "Create a list on a board (422 if over max_lists_per_board).",
      inputSchema: z.object({ board_id: z.string().uuid(), title: z.string().min(1) }),
    },
    async (a) => run(() => apiFetch<List>(`/api/boards/${a.board_id}/lists`, bearer, { method: "POST", body: JSON.stringify({ title: a.title }) })),
  );

  server.registerTool(
    "get_list",
    {
      description: "Get a list with its cards nested (unpaginated — full column).",
      inputSchema: z.object({ id: z.string().uuid() }),
      annotations: { readOnlyHint: true },
    },
    async (a) => run(() => apiFetch<List>(`/api/lists/${a.id}`, bearer)),
  );

  server.registerTool(
    "update_list",
    {
      description: "Rename a list and/or move it (position is a float for reordering).",
      inputSchema: z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        position: z.union([z.number(), z.string()]).optional(),
      }),
    },
    async (a) => run(() => apiFetch<List>(`/api/lists/${a.id}`, bearer, { method: "PATCH", body: JSON.stringify(patchOf(a, ["title", "position"])) })),
  );

  server.registerTool(
    "delete_list",
    {
      description: "Delete a list (soft delete).",
      inputSchema: z.object({ id: z.string().uuid() }),
      annotations: { destructiveHint: true },
    },
    async (a) => run(() => apiFetch<{ id: string }>(`/api/lists/${a.id}`, bearer, { method: "DELETE" })),
  );
}

// Pick only the provided keys → PATCH body (avoids sending undefined fields).
function patchOf<T extends Record<string, unknown>>(obj: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}