import { BridgeRpcError, BridgeTimeoutError, BridgeUnavailableError } from "../bridge/errors.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type ToolResult = CallToolResult;

export function ok(summary: string, structuredContent: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: "text", text: summary }],
    structuredContent
  };
}

export function fail(error: unknown): ToolResult {
  const payload = normalizeError(error);
  return {
    isError: true,
    content: [{ type: "text", text: payload.message }],
    structuredContent: payload
  };
}

function normalizeError(error: unknown): { message: string; [key: string]: unknown } {
  if (error instanceof BridgeUnavailableError) {
    return {
      error: "bridge_unavailable",
      message: error.message,
      nextSteps: [
        "Open EasyEDA Pro.",
        "Install and enable the EasyEDA MCP extension.",
        "Allow external interaction/WebSocket permission in EasyEDA Pro.",
        "Keep this MCP server running while using the extension."
      ]
    };
  }

  if (error instanceof BridgeTimeoutError) {
    return {
      error: "bridge_timeout",
      message: error.message,
      nextSteps: ["Check whether EasyEDA Pro is busy, then retry the tool call."]
    };
  }

  if (error instanceof BridgeRpcError) {
    return {
      error: error.code ?? "easyeda_rpc_error",
      message: error.message,
      details: error.details
    };
  }

  return {
    error: "unexpected_error",
    message: error instanceof Error ? error.message : String(error)
  };
}
