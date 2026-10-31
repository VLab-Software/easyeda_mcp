import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEasyEdaTools } from "./registerTools.js";
import { registerEasyEdaResources } from "./registerResources.js";
import { registerEasyEdaPrompts } from "./registerPrompts.js";
import type { EasyEdaBridge } from "../bridge/EasyEdaBridge.js";
import { PROTOCOL_VERSION } from "../protocol/messages.js";

import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "../version.js";
export { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "../version.js";
export const MCP_BRIDGE_PROTOCOL_VERSION = PROTOCOL_VERSION;

export function createMcpServer(bridge: EasyEdaBridge): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION
  });

  registerEasyEdaTools(server, bridge);
  registerEasyEdaResources(server, bridge);
  registerEasyEdaPrompts(server, bridge);

  // Hook real-time bridge status updates to MCP resource notifications
  bridge.addStatusListener(() => {
    try {
      if (server.isConnected()) {
        void server.server.sendResourceUpdated({ uri: "easyeda://project/status" });
        void server.server.sendResourceUpdated({ uri: "easyeda://project/context" });
      }
    } catch {
      // Ignore if transport is closing or client has not completed handshake
    }
  });

  return server;
}
