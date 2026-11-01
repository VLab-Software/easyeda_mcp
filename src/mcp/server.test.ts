import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { EasyEdaBridge } from "../bridge/EasyEdaBridge.js";
import { createMcpServer } from "./server.js";
import type { EditorClient } from "../editor/EditorClient.js";
import { createDisconnectedStatus } from "../protocol/messages.js";

const bridges: EasyEdaBridge[] = [];
const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(bridges.splice(0).map((bridge) => bridge.stop()));
});

describe("EasyEDA MCP server", () => {
  it("serves diagnostics and forwards calls through a transport-independent editor client", async () => {
    const calls: Array<{ method: string; params: unknown; timeoutMs?: number }> = [];
    const status = createDisconnectedStatus();
    const editor: EditorClient = {
      endpoint: "ws://editor-test:1234",
      getStatus: () => status,
      async call(method, params, timeoutMs) {
        calls.push({ method, params, timeoutMs });
        return { documentName: "Test.Schematic", source: "test-editor" };
      }
    };
    const server = createMcpServer(editor);
    const client = new Client({ name: "interface-client", version: "0.0.0" });
    clients.push(client);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    expect((await client.listTools()).tools).toHaveLength(41);
    const live = await client.callTool({ name: "easyeda_live_status", arguments: {} });
    expect(live.structuredContent).toEqual({ status, bridgeEndpoint: editor.endpoint });
    const doctor = await client.callTool({ name: "easyeda_doctor", arguments: {} });
    expect(doctor).toMatchObject({ structuredContent: { doctor: { bridge: { endpoint: editor.endpoint } } } });
    expect(calls).toHaveLength(0);

    const context = await client.callTool({ name: "easyeda_get_context", arguments: { timeoutMs: 1234 } });
    expect(context.structuredContent).toEqual({ result: { documentName: "Test.Schematic", source: "test-editor" } });
    expect(calls).toEqual([{ method: "getContext", params: {}, timeoutMs: 1234 }]);
  });

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
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);
    expect(toolNames).toContain("easyeda_live_status");
    expect(toolNames).toContain("easyeda_doctor");
    expect(toolNames).toContain("easyeda_confirmed_action");
    expect(toolNames).toContain("easyeda_schematic_snapshot");
    expect(toolNames).toContain("easyeda_trace_component");
    expect(toolNames).toContain("easyeda_validate_schematic_area");
    expect(toolNames).toContain("easyeda_verify_connections");
    expect(toolNames).toContain("easyeda_export_cpl");
    expect(toolNames).toContain("easyeda_run_drc");
    expect(toolNames).toContain("easyeda_get_pcb_layers");
    expect(toolNames).toContain("easyeda_get_routing_status");
    expect(toolNames).toContain("easyeda_list_pcb_components");
    expect(toolNames).toContain("easyeda_highlight_net");
    expect(toolNames).toContain("easyeda_get_selection");
    expect(toolNames).toContain("easyeda_search_library");

    const result = await client.callTool({
      name: "easyeda_get_context",
      arguments: {}
    });

    expect(result.isError).toBe(true);
    expect(result).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining("EasyEDA Pro extension is not connected") }]
    });
    const doctor = await client.callTool({ name: "easyeda_doctor", arguments: {} });
    expect(doctor).toMatchObject({ structuredContent: { doctor: { server: client.getServerVersion() } } });
  });
});
