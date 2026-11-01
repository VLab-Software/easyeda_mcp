import type { McpServer } from "@modelcontextprotocol/server";
import type { EditorClient } from "../../editor/EditorClient.js";
import { PROTOCOL_VERSION } from "../../protocol/messages.js";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "../../version.js";
import { ok } from "../toolResult.js";
import { DefaultTimeoutSchema, doctorNextSteps, registerReadTool } from "./common.js";

export function registerStatusTools(server: McpServer, bridge: EditorClient): void {
  server.registerTool(
    "easyeda_live_status",
    {
      title: "EasyEDA Pro live status",
      description:
        "Checks whether the EasyEDA Pro extension is connected and reports active document/capability information.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => {
      const status = bridge.getStatus();
      const summary = status.connected
        ? status.compatibility?.compatible === false
          ? "EasyEDA Pro extension is connected, but its bridge protocol is incompatible."
          : "EasyEDA Pro extension is connected."
        : "EasyEDA Pro extension is not connected.";
      return ok(summary, {
        status,
        bridgeEndpoint: bridge.endpoint
      });
    }
  );

  server.registerTool(
    "easyeda_doctor",
    {
      title: "EasyEDA Pro bridge diagnostics",
      description:
        "Returns a structured diagnosis of the local MCP bridge, EasyEDA Pro extension connection state, protocol compatibility, active document context, and suggested next steps.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => {
      const status = bridge.getStatus();
      const hasDocumentContext = Boolean(status.documentName || status.projectName || status.documentInfo);
      const nextSteps = doctorNextSteps(status);
      const summary = status.connected
        ? status.compatibility?.compatible === false
          ? "Bridge diagnostics found a protocol compatibility problem."
          : "Bridge diagnostics look healthy."
        : "Bridge diagnostics found that the EasyEDA Pro extension is disconnected.";
      return ok(summary, {
        doctor: {
          server: {
            name: MCP_SERVER_NAME,
            version: MCP_SERVER_VERSION,
            protocolVersion: PROTOCOL_VERSION
          },
          bridge: {
            endpoint: bridge.endpoint
          },
          extension: {
            connected: status.connected,
            connectionState: status.connectionState ?? (status.connected ? "connected" : "disconnected"),
            version: status.extensionVersion,
            protocolVersion: status.protocolVersion,
            compatibility: status.compatibility ?? {
              compatible: false,
              expectedProtocolVersion: PROTOCOL_VERSION,
              actualProtocolVersion: status.protocolVersion,
              reason: "The extension has not reported protocol compatibility yet."
            }
          },
          activeDocument: {
            available: hasDocumentContext,
            type: status.activeDocumentType ?? "unknown",
            projectName: status.projectName,
            documentName: status.documentName
          },
          status,
          nextSteps
        }
      });
    }
  );

  registerReadTool(server, bridge, {
    name: "easyeda_get_context",
    title: "Get EasyEDA Pro editor context",
    description:
      "Summarizes active project, active document, selection, and editor context from the open EasyEDA Pro instance.",
    method: "getContext",
    inputSchema: {
      timeoutMs: DefaultTimeoutSchema
    },
    summary: "Fetched EasyEDA Pro context."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_selection",
    title: "Get current canvas selection",
    description:
      "Returns components, pins, or primitives currently selected by the user on the active schematic or PCB canvas.",
    method: "getSelection",
    inputSchema: {
      timeoutMs: DefaultTimeoutSchema
    },
    summary: "Fetched current EasyEDA Pro editor selection."
  });
}
