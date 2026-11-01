import type { EditorStatus } from "../../protocol/messages.js";
import { describe, expect, it, vi } from "vitest";
import { McpServer, InMemoryTransport } from "@modelcontextprotocol/server";
import { Client } from "@modelcontextprotocol/client";
import { registerPcbTools } from "./pcbTools.js";

describe("pcbTools", () => {
  it("registers all PCB inspection and DRC tools", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    const registerToolSpy = vi.spyOn(server, "registerTool");
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn()
    };

    registerPcbTools(server, bridge);

    const registeredToolNames = registerToolSpy.mock.calls.map((call) => call[0]);
    expect(registeredToolNames).toEqual([
      "easyeda_run_drc",
      "easyeda_get_pcb_layers",
      "easyeda_get_routing_status",
      "easyeda_list_pcb_components",
      "easyeda_get_pcb_pads",
      "easyeda_prepare_pcb_component",
      "easyeda_highlight_net"
    ]);
  });

  it("invokes easyeda_get_pcb_pads with component and net filters", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        totalPads: 2,
        count: 2,
        pads: [
          { padNumber: "1", net: "GND", componentDesignator: "C1", x: 100, y: 200 },
          { padNumber: "2", net: "VCC", componentDesignator: "C1", x: 150, y: 200 }
        ]
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_pcb_pads",
      arguments: {
        component: "C1",
        net: "GND"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getPcbPads",
      expect.objectContaining({
        component: "C1",
        net: "GND"
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        totalPads: 2,
        count: 2
      }
    });

    await client.close();
  });

  it("invokes easyeda_prepare_pcb_component for moving a component", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        mutationId: "mut-pcb-123",
        confirmation: "CONFIRM pcb:move mut-pcb-123",
        action: "move",
        preview: {
          impact: "Moves PCB component R1 from (100, 200) to (120, 250).",
          changedKeys: ["x", "y"],
          before: { x: 100, y: 200 },
          requestedAfter: { x: 120, y: 250 }
        },
        expiresAt: "2026-11-01T12:05:00.000Z"
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_prepare_pcb_component",
      arguments: {
        action: "move",
        component: "R1",
        x: 120,
        y: 250
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "preparePcbComponent",
      expect.objectContaining({
        action: "move",
        component: "R1",
        x: 120,
        y: 250
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      mutationId: "mut-pcb-123",
      confirmation: "CONFIRM pcb:move mut-pcb-123",
      action: "move"
    });

    await client.close();
  });
});
