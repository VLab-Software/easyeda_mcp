import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEasyEdaTools } from "./registerTools.js";
import type { EasyEdaBridge } from "../bridge/EasyEdaBridge.js";

export function createMcpServer(bridge: EasyEdaBridge): McpServer {
  const server = new McpServer({
    name: "easyeda-pro-mcp",
    version: "0.1.0"
  });

  registerEasyEdaTools(server, bridge);

  return server;
}
