import { BridgeProtocolCompatibilityError, BridgeRpcError, BridgeTimeoutError, BridgeUnavailableError } from "../bridge/errors.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type ToolResult = CallToolResult;

export function ok(summary: string, structuredContent: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: "text", text: renderText(summary, structuredContent) }],
    structuredContent
  };
}

export function fail(error: unknown): ToolResult {
  const payload = normalizeError(error);
  return {
    isError: true,
    content: [{ type: "text", text: renderText(payload.message, payload) }],
    structuredContent: payload
  };
}

function renderText(summary: string, payload: Record<string, unknown>): string {
  return `${summary}\n\n${safeJson(payload)}`;
}

function safeJson(payload: Record<string, unknown>): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return JSON.stringify({ error: "serialization_failed" }, null, 2);
  }
}

function normalizeError(error: unknown): { message: string; [key: string]: unknown } {
  if (error instanceof BridgeUnavailableError) {
    return {
      error: "bridge_unavailable",
      message: error.message,
      retryable: true,
      nextSteps: [
        "Open EasyEDA Pro.",
        "Install and enable the EasyEDA MCP extension.",
        "Allow external interaction/WebSocket permission in EasyEDA Pro.",
        "Keep this MCP server running while using the extension.",
        "Use easyeda_doctor for a deeper connection diagnosis."
      ]
    };
  }

  if (error instanceof BridgeTimeoutError) {
    return {
      error: "bridge_timeout",
      message: error.message,
      retryable: true,
      nextSteps: [
        "Check whether EasyEDA Pro is busy, then retry the tool call.",
        "Use easyeda_doctor if timeouts continue."
      ]
    };
  }

  if (error instanceof BridgeProtocolCompatibilityError) {
    return {
      error: "bridge_protocol_mismatch",
      message: error.message,
      retryable: false,
      expectedProtocolVersion: error.expectedProtocolVersion,
      actualProtocolVersion: error.actualProtocolVersion,
      nextSteps: [
        "Rebuild and reload the EasyEDA Pro extension.",
        "Restart the MCP client session so it reloads the tool catalog.",
        "Use easyeda_doctor to confirm protocol compatibility."
      ]
    };
  }

  if (error instanceof BridgeRpcError) {
    return {
      error: error.code ?? "easyeda_rpc_error",
      message: error.message,
      retryable: false,
      details: error.details
    };
  }

  return {
    error: "unexpected_error",
    message: error instanceof Error ? error.message : String(error),
    retryable: false
  };
}
