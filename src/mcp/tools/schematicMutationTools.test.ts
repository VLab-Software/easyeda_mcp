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
});
