#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { EasyEdaBridge } from "./bridge/EasyEdaBridge.js";
import { createMcpServer } from "./mcp/server.js";

async function main(): Promise<void> {
  const bridge = new EasyEdaBridge();
  await bridge.start();

  const server = createMcpServer(bridge);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", () => {
    void bridge.stop().finally(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    void bridge.stop().finally(() => process.exit(0));
  });
}

main().catch((error) => {
  console.error(`[easyeda-mcp] Fatal error: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exit(1);
});
