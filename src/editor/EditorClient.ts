import type { EditorStatus } from "../protocol/messages.js";

/** Editor access used by MCP tools, independent of transport lifecycle. */
export interface EditorClient {
  readonly endpoint: string;
  getStatus(): EditorStatus;
  call(method: string, params?: unknown, timeoutMs?: number): Promise<unknown>;
}
