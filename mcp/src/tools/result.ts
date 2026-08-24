// MCP tool-result helpers. Tool handlers return either the JSON-encoded API
// payload on success, or an isError result carrying api/'s error envelope
// (code + fields) so the agent sees the same machine-readable failure the
// frontend would.

import { ApiCallError } from "#/apiClient";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function ok(payload: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

export function fail(e: unknown): ToolResult {
  if (e instanceof ApiCallError) {
    const fields = e.fields ? `\nfields: ${JSON.stringify(e.fields)}` : "";
    return {
      content: [{ type: "text", text: `[${e.code}] ${e.message}${fields}` }],
      isError: true,
    };
  }
  return {
    content: [{ type: "text", text: `mcp: ${String((e as Error)?.message ?? e)}` }],
    isError: true,
  };
}

// Wrap a fetch promise → ToolResult, catching ApiCallError.
export async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return ok(await fn());
  } catch (e) {
    return fail(e);
  }
}