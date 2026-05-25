import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { EasyEdaBridge } from "../bridge/EasyEdaBridge.js";
import { createMcpServer } from "./server.js";

const bridges: EasyEdaBridge[] = [];
const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(bridges.splice(0).map((bridge) => bridge.stop()));
});

describe("EasyEDA MCP server", () => {
  it("lists EasyEDA tools and returns actionable disconnected status", async () => {
    const bridge = new EasyEdaBridge({
      port: 0,
      logger: {
        error: () => undefined,
        warn: () => undefined,
        info: () => undefined
      }
    });
    await bridge.start();
    bridges.push(bridge);

    const server = createMcpServer(bridge);
    const client = new Client({
      name: "test-client",
      version: "0.0.0"
    });
    clients.push(client);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport)
    ]);

    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);
    expect(toolNames).toContain("easyeda_live_status");
    expect(toolNames).toContain("easyeda_confirmed_action");
    expect(toolNames).toContain("easyeda_schematic_snapshot");
    expect(toolNames).toContain("easyeda_trace_component");
    expect(toolNames).toContain("easyeda_validate_schematic_area");

    const result = await client.callTool({
      name: "easyeda_get_context",
      arguments: {}
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toContain("EasyEDA Pro extension is not connected");
  });
});
