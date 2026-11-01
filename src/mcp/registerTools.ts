import type { McpServer } from "@modelcontextprotocol/server";
import type { EditorClient } from "../editor/EditorClient.js";
import { registerStatusTools } from "./tools/statusTools.js";
import { registerSchematicTools } from "./tools/schematicTools.js";
import { registerPcbTools } from "./tools/pcbTools.js";
import { registerDrcTools } from "./tools/drcTools.js";
import { registerExportTools } from "./tools/exportTools.js";
import { registerActionTools } from "./tools/actionTools.js";
import { DefaultTimeoutSchema, hasExplicitMutationConfirmation, registerReadTool } from "./tools/common.js";

export { DefaultTimeoutSchema, hasExplicitMutationConfirmation, registerReadTool };

export function registerEasyEdaTools(server: McpServer, bridge: EditorClient): void {
  registerStatusTools(server, bridge);
  registerSchematicTools(server, bridge);
  registerPcbTools(server, bridge);
  registerDrcTools(server, bridge);
  registerExportTools(server, bridge);
  registerActionTools(server, bridge);
}
