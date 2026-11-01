import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import type { EditorClient } from "../../editor/EditorClient.js";
import type { EditorStatus } from "../../protocol/messages.js";
import { registerSchematicMutationTools } from "./schematicMutationTools.js";

async function makeClient(bridge: EditorClient) {
  const server = new McpServer({ name: "test", version: "1.0.0" });
  registerSchematicMutationTools(server, bridge);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("Schematic Mutation MCP Tools", () => {
  it("registers schematic mutation tools in the catalog", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn()
    };
    const client = await makeClient(bridge);
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name);

    expect(names).toContain("easyeda_prepare_schematic_component");
    expect(names).toContain("easyeda_prepare_schematic_wire");
    expect(names).toContain("easyeda_prepare_schematic_port");
    expect(names).toContain("easyeda_prepare_schematic_bus");
    expect(names).toContain("easyeda_prepare_schematic_pcb_sync");
    expect(names).toContain("easyeda_get_mutation_result");
  });

  it("prepares a schematic component mutation and formats instructions", async () => {
    const mutationId = "mutation-uuid-456";
    const confirmation = `CONFIRM schematic:createComponent ${mutationId}`;
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => ({
        mutationId,
        confirmation,
        action: "createComponent",
        preview: {
          impact: "Creates new component at (1000, 2000) with device C1523.",
          scope: "document:sch-doc-1"
        },
        expiresAt: new Date(Date.now() + 300_000).toISOString()
      }))
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_prepare_schematic_component",
      arguments: {
        action: "create",
        device: "C1523",
        x: 1000,
        y: 2000,
        designator: "R1"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "prepareSchematicComponent",
      expect.objectContaining({
        action: "create",
        device: "C1523",
        x: 1000,
        y: 2000,
        designator: "R1"
      }),
      30_000
    );
    expect(result).toMatchObject({
      content: [
        {
          type: "text",
          text: expect.stringContaining(`CONFIRM schematic:createComponent ${mutationId}`)
        }
      ]
    });
    expect(result.structuredContent).toMatchObject({
      mutationId,
      confirmation
    });
  });

  it("queries mutation outcome via easyeda_get_mutation_result", async () => {
    const mutationId = "mutation-uuid-789";
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => ({
        mutationId,
        domain: "schematic",
        action: "createComponent",
        status: "applied",
        documentSaved: false,
        after: {
          primitiveId: "prim-1",
          designator: "R1",
          verified: true
        }
      }))
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_get_mutation_result",
      arguments: {
        mutationId
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith("getMutationResult", { mutationId }, 10_000);
    expect(result).toMatchObject({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Mutation mutation-uuid-789 (schematic:createComponent) status: applied.")
        }
      ]
    });
    expect(result.structuredContent).toMatchObject({
      status: "applied",
      documentSaved: false
    });
  });

  it("handles preparation errors gracefully", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => {
        throw new Error("Schematic component mutations require an active schematic document.");
      })
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_prepare_schematic_component",
      arguments: {
        action: "move",
        component: "R1",
        x: 100,
        y: 200
      }
    });

    expect(result.isError).toBe(true);
    expect(result).toMatchObject({
      content: [
        {
          type: "text",
          text: expect.stringContaining("require an active schematic document")
        }
      ]
    });
  });

  it("prepares a wire creation mutation and returns confirmation instructions", async () => {
    const mutationId = "wire-mut-123";
    const confirmation = `CONFIRM schematic:createWire ${mutationId}`;
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => ({
        mutationId,
        confirmation,
        action: "createWire",
        preview: {
          impact: "Creates wire from (100, 200) to (300, 200) on net VCC.",
          scope: "document:sch-doc-1"
        },
        expiresAt: new Date(Date.now() + 300_000).toISOString()
      }))
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_prepare_schematic_wire",
      arguments: {
        action: "createWire",
        coordinates: [100, 200, 300, 200],
        net: "VCC"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "prepareSchematicWire",
      expect.objectContaining({
        action: "createWire",
        coordinates: [100, 200, 300, 200],
        net: "VCC"
      }),
      30_000
    );
    expect(result).toMatchObject({
      content: [
        {
          type: "text",
          text: expect.stringContaining(`CONFIRM schematic:createWire ${mutationId}`)
        }
      ]
    });
    expect(result.structuredContent).toMatchObject({
      mutationId,
      confirmation
    });
  });

  it("prepares a net label mutation via easyeda_prepare_schematic_wire", async () => {
    const mutationId = "netlabel-mut-456";
    const confirmation = `CONFIRM schematic:addNetLabel ${mutationId}`;
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => ({
        mutationId,
        confirmation,
        action: "addNetLabel",
        preview: {
          impact: "Attaches net label GND at (500, 600).",
          scope: "document:sch-doc-1"
        },
        expiresAt: new Date(Date.now() + 300_000).toISOString()
      }))
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_prepare_schematic_wire",
      arguments: {
        action: "addNetLabel",
        net: "GND",
        x: 500,
        y: 600
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "prepareSchematicWire",
      expect.objectContaining({
        action: "addNetLabel",
        net: "GND",
        x: 500,
        y: 600
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      mutationId,
      confirmation
    });
  });

  it("prepares a net port mutation via easyeda_prepare_schematic_port", async () => {
    const mutationId = "mut-sch-createPort-123";
    const confirmation = `CONFIRM sch:createPort ${mutationId}`;
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => ({
        mutationId,
        confirmation,
        action: "createPort",
        preview: {
          impact: "Creates net port 'TXD' (type: output) at (100, 200).",
          scope: "port:TXD"
        },
        expiresAt: new Date(Date.now() + 300_000).toISOString()
      }))
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_prepare_schematic_port",
      arguments: {
        action: "createPort",
        name: "TXD",
        portType: "output",
        x: 100,
        y: 200,
        rotation: 0
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "prepareSchematicPort",
      expect.objectContaining({
        action: "createPort",
        name: "TXD",
        portType: "output",
        x: 100,
        y: 200
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      mutationId,
      confirmation
    });
  });

  it("prepares a bus mutation via easyeda_prepare_schematic_bus", async () => {
    const mutationId = "mut-sch-createBus-456";
    const confirmation = `CONFIRM sch:createBus ${mutationId}`;
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => ({
        mutationId,
        confirmation,
        action: "createBus",
        preview: {
          impact: "Creates bus 'DATA[0..7]' with 4 points.",
          scope: "bus:DATA[0..7]"
        },
        expiresAt: new Date(Date.now() + 300_000).toISOString()
      }))
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_prepare_schematic_bus",
      arguments: {
        action: "createBus",
        name: "DATA[0..7]",
        coordinates: [100, 200, 300, 200],
        lineWidth: 3
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "prepareSchematicBus",
      expect.objectContaining({
        action: "createBus",
        name: "DATA[0..7]",
        coordinates: [100, 200, 300, 200],
        lineWidth: 3
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      mutationId,
      confirmation
    });
  });

  it("prepares a sync mutation via easyeda_prepare_schematic_pcb_sync", async () => {
    const mutationId = "mut-sync-pcb-123";
    const confirmation = `CONFIRM sync:syncToPcb ${mutationId}`;
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => ({
        mutationId,
        confirmation,
        action: "syncToPcb",
        preview: {
          impact: "Pushes 2 unplaced components to PCB.",
          scope: "pcb:doc-pcb-1"
        },
        expiresAt: new Date(Date.now() + 300_000).toISOString()
      }))
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_prepare_schematic_pcb_sync",
      arguments: {
        action: "syncToPcb"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "prepareSchematicPcbSync",
      expect.objectContaining({
        action: "syncToPcb"
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      mutationId,
      confirmation
    });
  });
});
