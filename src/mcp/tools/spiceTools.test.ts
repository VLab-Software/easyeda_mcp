import type { EditorStatus } from "../../protocol/messages.js";
import { describe, expect, it, vi } from "vitest";
import { McpServer, InMemoryTransport } from "@modelcontextprotocol/server";
import { Client } from "@modelcontextprotocol/client";
import { registerSpiceTools } from "./spiceTools.js";

describe("spiceTools", () => {
  it("registers SPICE feasibility study and netlist generation tools", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    const registerToolSpy = vi.spyOn(server, "registerTool");
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn()
    };

    registerSpiceTools(server, bridge as any);

    const registeredToolNames = registerToolSpy.mock.calls.map((call) => call[0]);
    expect(registeredToolNames).toEqual(["easyeda_evaluate_spice_support", "easyeda_generate_spice_netlist"]);
  });

  it("invokes easyeda_evaluate_spice_support through client", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        feasibilityScorePercent: 90,
        isSimulatable: true,
        verdict: "simulation_ready"
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerSpiceTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_evaluate_spice_support",
      arguments: { groundNet: "GND" }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith("evaluateSpiceFeasibility", { groundNet: "GND" }, 30_000);
    expect(result.structuredContent).toMatchObject({
      result: {
        isSimulatable: true,
        verdict: "simulation_ready"
      }
    });

    await client.close();
  });

  it("invokes easyeda_generate_spice_netlist with tran analysis", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        saved: true,
        fileName: "filter.cir",
        directive: ".tran 10u 5ms",
        elementsCount: 3
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerSpiceTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_generate_spice_netlist",
      arguments: {
        analysisType: "tran",
        analysisParams: "10u 5ms",
        groundNet: "0"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "generateSpiceNetlist",
      {
        analysisType: "tran",
        analysisParams: "10u 5ms",
        groundNet: "0",
        includeSubcircuits: true,
        includeDefaultModels: true
      },
      30_000
    );

    await client.close();
  });
});
