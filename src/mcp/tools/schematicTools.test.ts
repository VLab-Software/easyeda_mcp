import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import type { EditorClient } from "../../editor/EditorClient.js";
import type { EditorStatus } from "../../protocol/messages.js";
import { registerSchematicTools } from "./schematicTools.js";

async function makeClient(bridge: EditorClient) {
  const server = new McpServer({ name: "test", version: "1.0.0" });
  registerSchematicTools(server, bridge);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("schematicTools MCP registration and invocation", () => {
  it("registers all schematic inspection, native nets, and ERC tools", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    const registerToolSpy = vi.spyOn(server, "registerTool");
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn()
    };

    registerSchematicTools(server, bridge);

    const registeredToolNames = registerToolSpy.mock.calls.map((call) => call[0]);
    expect(registeredToolNames).toEqual([
      "easyeda_find_component",
      "easyeda_find_net",
      "easyeda_schematic_snapshot",
      "easyeda_get_schematic_nets",
      "easyeda_list_schematic_components",
      "easyeda_get_component_pins",
      "easyeda_trace_net",
      "easyeda_trace_component",
      "easyeda_find_unconnected_pins",
      "easyeda_run_schematic_erc",
      "easyeda_validate_schematic_area",
      "easyeda_verify_connections"
    ]);
  });

  it("invokes easyeda_get_schematic_nets and returns structured content", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => ({
        available: true,
        status: "complete",
        totalNets: 3,
        nets: ["GND", "RESET", "VCC"],
        confidence: "high"
      }))
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_get_schematic_nets",
      arguments: {
        pageId: "sheet-1",
        allPages: false
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getSchematicNets",
      expect.objectContaining({
        pageId: "sheet-1",
        allPages: false
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        available: true,
        status: "complete",
        totalNets: 3,
        nets: ["GND", "RESET", "VCC"]
      }
    });
  });

  it("invokes easyeda_run_schematic_erc and returns ERC violations", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => ({
        available: true,
        passed: false,
        status: "violations_found",
        violationsCount: 1,
        violations: [
          {
            rule: "floating_pin",
            message: "Pin U1.4 is unconnected",
            severity: "error"
          }
        ]
      }))
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_run_schematic_erc",
      arguments: {
        strict: true
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "runSchematicErc",
      expect.objectContaining({
        strict: true
      }),
      60_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        passed: false,
        status: "violations_found",
        violationsCount: 1
      }
    });
  });
});
