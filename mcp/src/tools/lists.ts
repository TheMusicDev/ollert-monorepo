// List tools — 1:1 with api-contract.md#Lists. (Lists have no list/collection
// endpoint; they come nested under GET /api/boards/:id.)

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { apiFetch } from "#/apiClient";
import type { List } from "#/types";
import { run } from "#/tools/result";

export function registerLists(server: McpServer, bearer: string): void {
  server.registerTool(
    "create_list",
    {
      description: "Create a list on a board (422 if over max_lists_per_board).",
      inputSchema: z.object({ board_id: z.string().uuid(), name: z.string().min(1) }),
    },
    async (a) => run(() => apiFetch<List>(`/api/boards/${a.board_id}/lists`, bearer, { method: "POST", body: JSON.stringify({ name: a.name }) })),
  );

  server.registerTool(
    "update_list",
    {
      description: "Rename a list and/or move it (position is a float for reordering).",
      inputSchema: z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        position: z.union([z.number(), z.string()]).optional(),
      }),
    },
    async (a) => run(() => apiFetch<List>(`/api/lists/${a.id}`, bearer, { method: "PATCH", body: JSON.stringify(patchOf(a, ["name", "position"])) })),
  );

  server.registerTool(
    "delete_list",
    {
      description: "Delete a list (soft delete).",
      inputSchema: z.object({ id: z.string().uuid() }),
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