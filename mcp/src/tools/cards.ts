// Card tools — 1:1 with api-contract.md#Cards. (Cards have no collection
// endpoint; they come nested under GET /api/boards/:id.)

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { apiFetch } from "#/apiClient";
import type { Card } from "#/types";
import { run } from "#/tools/result";

const cardPatchKeys = ["title", "description", "due_date", "position", "list_id"] as const;

export function registerCards(server: McpServer, bearer: string): void {
  server.registerTool(
    "create_card",
    {
      description: "Create a card on a list (422 if over max_cards_per_board).",
      inputSchema: z.object({
        list_id: z.string().uuid(),
        title: z.string().min(1),
        description: z.string().optional(),
        due_date: z.string().optional(),
      }),
    },
    async (a) => run(() => apiFetch<Card>(`/api/lists/${a.list_id}/cards`, bearer, { method: "POST", body: JSON.stringify(patchOf(a, ["title", "description", "due_date"])) })),
  );

  server.registerTool(
    "update_card",
    {
      description:
        "Update a card: title/description/due_date, or move it (position float, and list_id to move across lists) — one request per drag-drop.",
      inputSchema: z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        due_date: z.string().optional(),
        position: z.union([z.number(), z.string()]).optional(),
        list_id: z.string().uuid().optional(),
      }),
    },
    async (a) => run(() => apiFetch<Card>(`/api/cards/${a.id}`, bearer, { method: "PATCH", body: JSON.stringify(patchOf(a, cardPatchKeys)) })),
  );

  server.registerTool(
    "delete_card",
    {
      description: "Delete a card (soft delete).",
      inputSchema: z.object({ id: z.string().uuid() }),
    },
    async (a) => run(() => apiFetch<{ id: string }>(`/api/cards/${a.id}`, bearer, { method: "DELETE" })),
  );
}

function patchOf<T extends Record<string, unknown>>(obj: T, keys: readonly (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}