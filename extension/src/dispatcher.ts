import type { BridgeCallMessage, BridgeErrorMessage, BridgeResultMessage } from "../../src/protocol/messages.js";
import { apiError, log, normalizeError } from "./helpers.js";
import type { RpcHandler } from "./types.js";

export function createDispatcher(
  handlers: Record<string, RpcHandler>,
  send: (message: Record<string, unknown>) => void
): (raw: string) => Promise<void> {
  return async function handleMessage(raw: string): Promise<void> {
    let message: BridgeCallMessage;
    try {
      message = JSON.parse(raw) as BridgeCallMessage;
    } catch (error) {
      log("warn", "Ignored malformed MCP bridge message", error);
      return;
    }

    if (message.kind !== "call" || !message.requestId || !message.method) {
      return;
    }

    try {
      const handler = handlers[message.method];
      if (!handler) {
        throw apiError("unknown_method", `Unsupported MCP bridge method: ${message.method}`);
      }
      const result = await handler((message.params ?? {}) as Record<string, unknown>);
      send({
        kind: "result",
        requestId: message.requestId,
        result
      } satisfies BridgeResultMessage);
    } catch (error) {
      send({
        kind: "error",
        requestId: message.requestId,
        error: normalizeError(error)
      } satisfies BridgeErrorMessage);
    }
  };
}
