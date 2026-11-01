import type { McpServer } from "@modelcontextprotocol/server";
import type { EditorClient } from "../../editor/EditorClient.js";
import { DrcScopeSchema, DrcOperationSchema, DrcEditQuerySchema } from "../../drc/contracts.js";
import { DefaultTimeoutSchema, registerReadTool } from "./common.js";

export function registerDrcTools(server: McpServer, bridge: EditorClient): void {
  registerReadTool(server, bridge, {
    name: "easyeda_get_drc_rules",
    title: "Read native PCB design rules",
    description:
      "Read native EasyEDA Pro PCB design rules for current or configured scopes. Does not mutate the board.",
    method: "getDrcRules",
    inputSchema: {
      scope: DrcScopeSchema.default("current"),
      timeoutMs: DefaultTimeoutSchema
    },
    summary: "Read native PCB design rules."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_prepare_drc_edit",
    title: "Prepare a PCB design rule edit",
    description:
      "Prepare an explicit, reviewable edit for native EasyEDA Pro PCB design rules. Returns target identity, baseline snapshot, editId and the exact required confirmation string.",
    method: "prepareDrcEdit",
    inputSchema: {
      operation: DrcOperationSchema,
      timeoutMs: DefaultTimeoutSchema
    },
    summary: "Prepared PCB design rule edit preview."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_drc_edit_result",
    title: "Query a PCB design rule edit",
    description:
      "Query a retained DRC edit after execution or timeout. Never reapply an uncertain edit. Results live only in this extension instance.",
    method: "getDrcEditResult",
    inputSchema: {
      ...DrcEditQuerySchema.shape,
      timeoutMs: DefaultTimeoutSchema
    },
    summary: "Read retained PCB design rule edit result."
  });
}
