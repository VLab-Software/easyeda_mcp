#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { EasyEdaBridge } from "./bridge/EasyEdaBridge.js";
import { handleCliArgs } from "./cli/cli.js";
import { installLifecycleHandlers } from "./lifecycle.js";
import { createMcpServer } from "./mcp/server.js";

async function main(): Promise<void> {
  const cliResult = handleCliArgs(process.argv.slice(2));
  if (cliResult.handled) {
    process.exitCode = cliResult.exitCode;
    return;
  }

  const bridge = new EasyEdaBridge();
  await bridge.start();

  const server = createMcpServer(bridge);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  installLifecycleHandlers({ bridge, server, transport });
}

main().catch((error) => {
  console.error(`[easyeda-mcp] Fatal error: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exit(1);
});
