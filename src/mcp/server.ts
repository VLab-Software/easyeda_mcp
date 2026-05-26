import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEasyEdaTools } from "./registerTools.js";
import type { EasyEdaBridge } from "../bridge/EasyEdaBridge.js";
import { PROTOCOL_VERSION } from "../protocol/messages.js";

export const MCP_SERVER_NAME = "easyeda-pro-mcp";
export const MCP_SERVER_VERSION = "0.1.0";
export const MCP_BRIDGE_PROTOCOL_VERSION = PROTOCOL_VERSION;

export function createMcpServer(bridge: EasyEdaBridge): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION
  });

  registerEasyEdaTools(server, bridge);

  return server;
}
