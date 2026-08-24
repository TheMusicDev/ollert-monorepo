// Registers every tool on a per-request McpServer, closing over the caller's
// Bearer token. One server instance per HTTP request (stateless streamable-
// HTTP) — see server.ts. The token never lives in module scope.

import type { McpServer } from "@modelcontextprotocol/server";
import { registerOrgs } from "#/tools/orgs";
import { registerOrgMembers } from "#/tools/orgMembers";
import { registerBoards } from "#/tools/boards";
import { registerLists } from "#/tools/lists";
import { registerCards } from "#/tools/cards";

export function registerAllTools(server: McpServer, bearer: string): void {
  registerOrgs(server, bearer);
  registerOrgMembers(server, bearer);
  registerBoards(server, bearer);
  registerLists(server, bearer);
  registerCards(server, bearer);
}