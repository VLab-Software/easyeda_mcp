import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EditorClient } from "../../editor/EditorClient.js";
import { DefaultTimeoutSchema, DocumentTargetSchema } from "./common.js";
import { fail, ok } from "../toolResult.js";

export function registerDocumentTools(server: McpServer, bridge: EditorClient): void {
  server.registerTool(
    "easyeda_list_documents",
    {
      title: "List EasyEDA Pro Documents",
      description:
        "Lists all documents belonging to the current EasyEDA Pro project and open editor tabs, detailing document identity, type, open/active status, and tab layout.",
      inputSchema: {
        timeoutMs: DefaultTimeoutSchema.default(30_000)
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ timeoutMs }) => {
      try {
        const result = (await bridge.call("listDocuments", {}, timeoutMs)) as Record<string, unknown>;
        const total = (result.total as number) ?? 0;
        const openCount = (result.openCount as number) ?? 0;
        const activeDoc = (result.activeDocument as { documentName?: string; documentType?: string }) ?? {};
        const summary = `Found ${total} project document(s) (${openCount} open). Active: ${activeDoc.documentName ?? "none"} (${activeDoc.documentType ?? "unknown"}).`;
        return ok(summary, result);
      } catch (error) {
        return fail(error);
      }
    }
  );

  server.registerTool(
    "easyeda_open_document",
    {
      title: "Open EasyEDA Pro Document",
      description:
        "Opens a document or activates an open tab in EasyEDA Pro, shifting input focus and canvas viewport. Provides readback confirmation and reports focus transition.",
      inputSchema: {
        documentId: z.string().optional().describe("Document UUID to open"),
        tabId: z.string().optional().describe("Tab ID to activate if already open"),
        target: DocumentTargetSchema.optional().describe("Expected target document identity"),
        splitScreenId: z.string().optional().describe("Optional split screen ID to open document into"),
        activate: z.boolean().default(true).describe("Whether to bring focus and activate the tab"),
        timeoutMs: DefaultTimeoutSchema.default(30_000)
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ documentId, tabId, target, splitScreenId, activate, timeoutMs }) => {
      try {
        const result = (await bridge.call(
          "openDocument",
          { documentId, tabId, target, splitScreenId, activate },
          timeoutMs
        )) as Record<string, unknown>;
        const currentTarget = (result.currentTarget as { documentName?: string; documentId?: string }) ?? {};
        const focusChanged = Boolean(result.focusChanged);
        const readbackConfirmed = Boolean(result.readbackConfirmed);
        const summary = `Document opened/activated: ${currentTarget.documentName ?? currentTarget.documentId ?? "unknown"} (focusChanged: ${focusChanged}, readbackConfirmed: ${readbackConfirmed}).`;
        return ok(summary, result);
      } catch (error) {
        return fail(error);
      }
    }
  );

  server.registerTool(
    "easyeda_render_document_view",
    {
      title: "Render EasyEDA Pro Document View",
      description:
        "Captures the visible canvas rendering viewport image in EasyEDA Pro (via DMT_EditorControl). Explicitly documents viewport limits and asserts target match.",
      inputSchema: {
        target: DocumentTargetSchema.optional().describe(
          "Expected document target to guard against capturing wrong canvas"
        ),
        tabId: z.string().optional().describe("Target tab ID if capturing a specific open tab"),
        format: z.enum(["data_url", "base64"]).default("data_url").describe("Image encoding format"),
        timeoutMs: DefaultTimeoutSchema.default(30_000)
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async ({ target, tabId, format, timeoutMs }) => {
      try {
        const result = (await bridge.call("renderDocumentView", { target, tabId, format }, timeoutMs)) as Record<
          string,
          unknown
        >;
        const base64 = typeof result.base64 === "string" ? result.base64 : undefined;
        const mimeType = typeof result.mimeType === "string" ? result.mimeType : "image/png";
        const currentTarget = (result.target as { documentName?: string; documentType?: string }) ?? {};
        const summary = `Canvas viewport rendered for ${currentTarget.documentName ?? "active document"} (${currentTarget.documentType ?? "unknown"}). Note: limits capture to visible canvas viewport.`;

        const response = ok(summary, result);
        if (base64) {
          response.content.push({
            type: "image",
            data: base64,
            mimeType
          });
        }
        return response;
      } catch (error) {
        return fail(error);
      }
    }
  );
}
