import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EditorClient } from "../../editor/EditorClient.js";
import type { EditorStatus } from "../../protocol/messages.js";
import { ok, fail } from "../toolResult.js";

export const DefaultTimeoutSchema = z.number().int().positive().max(120_000).default(10_000);

export const DocumentTargetSchema = z.object({
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  documentId: z.string().optional(),
  documentName: z.string().optional(),
  documentType: z.enum(["schematic", "pcb", "symbol", "footprint", "unknown"]).optional(),
  tabId: z.string().optional(),
  pageId: z.string().optional(),
  pageIndex: z.number().int().optional(),
  fingerprint: z.string().optional(),
  capturedAt: z.string().optional()
});

export const mutatingConfirmationRegex =
  /(?:^|[^a-z0-9_])(?:confirm|confirmed|confirma|confirmo|confirmar|confirmado)(?:$|[^a-z0-9_])/i;

export function hasExplicitMutationConfirmation(confirmation: string): boolean {
  return mutatingConfirmationRegex.test(confirmation);
}

export type ReadToolConfig = {
  name: string;
  title: string;
  description: string;
  method: string;
  inputSchema: Record<string, z.ZodType>;
  summary: string;
};

export function registerReadTool(server: McpServer, bridge: EditorClient, config: ReadToolConfig): void {
  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      inputSchema: config.inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async (args: Record<string, unknown>) => {
      try {
        const { timeoutMs, ...params } = args as Record<string, unknown> & { timeoutMs?: number };
        const result = await bridge.call(config.method, params, timeoutMs);
        return ok(config.summary, {
          result
        });
      } catch (error) {
        return fail(error);
      }
    }
  );
}

export function doctorNextSteps(status: EditorStatus): string[] {
  if (!status.connected) {
    return [
      "Open EasyEDA Pro.",
      "Install or reload the EasyEDA MCP extension.",
      "Enable external interaction/WebSocket permission in EasyEDA Pro.",
      "Keep the MCP server running and wait for the extension to auto-connect."
    ];
  }

  if (status.compatibility?.compatible === false) {
    return [
      "Rebuild and reload the EasyEDA Pro extension.",
      "Restart the MCP client session so it reloads the latest tool catalog.",
      "Verify that the extension and MCP server are built from the same repository state."
    ];
  }

  if (!status.documentName && !status.projectName && !status.activeDocumentType && !status.documentInfo) {
    return [
      "Open a schematic or PCB document in EasyEDA Pro.",
      "Run easyeda_get_context or easyeda_live_status again after the document finishes loading."
    ];
  }

  return [
    "The bridge looks healthy.",
    "Use easyeda_live_status for quick checks and easyeda_get_context for deeper editor state."
  ];
}
