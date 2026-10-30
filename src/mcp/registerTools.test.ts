import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { hasExplicitMutationConfirmation, registerEasyEdaTools } from "./registerTools.js";
import { BridgeTimeoutError, BridgeUnavailableError } from "../bridge/errors.js";

const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

async function makeClient(bridge: { endpoint: string; getStatus: () => unknown; call: ReturnType<typeof vi.fn> }): Promise<Client> {
  const server = new McpServer({
    name: "test-server",
    version: "0.0.0"
  });
  registerEasyEdaTools(server, bridge as never);

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
  return client;
}

describe("mutation confirmation guard", () => {
  it("exposes DRC tools and rejects a vague DRC confirmation before dispatch", async () => {
    const bridge = { endpoint: "ws://127.0.0.1:8765", getStatus: () => ({ connected: true }), call: vi.fn() };
    const client = await makeClient(bridge);
    const tools = await client.listTools();
    expect(tools.tools.map(tool => tool.name)).toEqual(expect.arrayContaining(["easyeda_get_drc_rules", "easyeda_prepare_drc_edit", "easyeda_get_drc_edit_result"]));
    const result = await client.callTool({ name: "easyeda_confirmed_action", arguments: {
      action: "editDrcRules", confirmation: "confirmo", params: { editId: "22bd6220-9f2e-40a8-a019-d32a2f4d67eb" }
    } });
    expect(result.isError).toBe(true); expect(bridge.call).not.toHaveBeenCalled();
  });
  it.each([new BridgeTimeoutError("confirmedAction", 100), new BridgeUnavailableError()])("does not recommend retrying an inconclusive DRC mutation: %s", async error => {
    const editId = "22bd6220-9f2e-40a8-a019-d32a2f4d67eb";
    const bridge = { endpoint: "ws://127.0.0.1:8765", getStatus: () => ({ connected: true }), call: vi.fn().mockRejectedValue(error) };
    const client = await makeClient(bridge);
    const result = await client.callTool({ name: "easyeda_confirmed_action", arguments: {
      action: "editDrcRules", confirmation: `CONFIRM editDrcRules ${editId}`, params: { editId }
    } });
    expect(result.structuredContent).toMatchObject({ error: "drc_edit_outcome_unknown", status: "unknown", editId, retryable: false });
    expect(bridge.call).toHaveBeenCalledTimes(1);
  });
  it("forwards a reviewed DRC edit and marks a failed result as an MCP error", async () => {
    const editId = "22bd6220-9f2e-40a8-a019-d32a2f4d67eb";
    const bridge = { endpoint: "ws://127.0.0.1:8765", getStatus: () => ({ connected: true }), call: vi.fn().mockResolvedValue({ status: "failed" }) };
    const client = await makeClient(bridge);
    const result = await client.callTool({ name: "easyeda_confirmed_action", arguments: { action: "editDrcRules", confirmation: `CONFIRM editDrcRules ${editId}`, params: { editId } } });
    expect(bridge.call).toHaveBeenCalledWith("confirmedAction", { action: "editDrcRules", confirmation: `CONFIRM editDrcRules ${editId}`, params: { editId } }, 60_000);
    expect(result.isError).toBe(true);
  });
  it("accepts explicit confirmation phrases", () => {
    expect(hasExplicitMutationConfirmation("confirma salvar")).toBe(true);
    expect(hasExplicitMutationConfirmation("I confirm this save")).toBe(true);
  });

  it("rejects vague or missing confirmation", () => {
    expect(hasExplicitMutationConfirmation("pode salvar")).toBe(false);
    expect(hasExplicitMutationConfirmation("save it")).toBe(false);
  });

  it("blocks mutating actions without explicit confirmation", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: () => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn()
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_confirmed_action",
      arguments: {
        action: "save",
        confirmation: "pode salvar"
      }
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toContain('Action "save" was blocked');
    expect(bridge.call).not.toHaveBeenCalled();
  });

  it("forwards confirmed actions to the bridge", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: () => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => ({ saved: true, documentUuid: "doc-123" }))
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_confirmed_action",
      arguments: {
        action: "save",
        confirmation: "confirma salvar",
        timeoutMs: 12_345
      }
    });

    expect(bridge.call).toHaveBeenCalledWith("confirmedAction", {
      action: "save",
      confirmation: "confirma salvar",
      params: undefined
    }, 12_345);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      action: "save",
      result: {
        saved: true,
        documentUuid: "doc-123"
      }
    });
  });

  it("forwards verify_connections checks and preserves structured results", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: () => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => ({
        checks: [
          {
            id: "u5-vcc",
            type: "pin_on_net",
            status: "pass",
            message: "Pin is on expected net.",
            evidence: {
              reason: "matched node",
              nodeIds: ["node:1"],
              nets: ["VBUS"]
            }
          }
        ],
        summary: {
          passed: 1,
          warnings: 0,
          failed: 0,
          unknown: 0
        },
        confidence: "high"
      }))
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_verify_connections",
      arguments: {
        checks: [
          {
            id: "u5-vcc",
            type: "pin_on_net",
            component: "U5",
            pinName: "VCC",
            net: "VBUS"
          }
        ],
        maxHops: 6,
        timeoutMs: 20_000
      }
    });

    expect(bridge.call).toHaveBeenCalledWith("verifyConnections", {
      checks: [
        {
          id: "u5-vcc",
          type: "pin_on_net",
          component: "U5",
          pinName: "VCC",
          net: "VBUS"
        }
      ],
      includeRaw: false,
      allPages: true,
      maxHops: 6
    }, 20_000);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      result: {
        summary: {
          passed: 1,
          failed: 0
        },
        confidence: "high"
      }
    });
  });

  it("returns a doctor report without calling the bridge RPC layer", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: () => ({
        connected: false,
        connectionState: "disconnected",
        message: "Extension not connected.",
        updatedAt: new Date().toISOString()
      }),
      call: vi.fn()
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_doctor",
      arguments: {}
    });

    expect(bridge.call).not.toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toContain("diagnostics");
    expect(result.structuredContent).toMatchObject({
      doctor: {
        bridge: {
          endpoint: "ws://127.0.0.1:8765"
        },
        extension: {
          connected: false
        }
      }
    });
  });

  it("marks the active document as available when documentInfo exists", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: () => ({
        connected: true,
        connectionState: "connected",
        activeDocumentType: "schematic",
        documentInfo: {
          documentType: 1,
          uuid: "doc-123"
        },
        updatedAt: new Date().toISOString()
      }),
      call: vi.fn()
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_doctor",
      arguments: {}
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      doctor: {
        activeDocument: {
          available: true,
          type: "schematic"
        },
        nextSteps: [
          "The bridge looks healthy.",
          "Use easyeda_live_status for quick checks and easyeda_get_context for deeper editor state."
        ]
      }
    });
  });

  it("exposes Phase 1 tools and forwards calls to the bridge", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: () => ({ connected: true }),
      call: vi.fn(async (method: string, params: unknown) => {
        if (method === "exportCpl") return { saved: true, fileName: "test.csv" };
        if (method === "runDrc") return { passed: true, errorsCount: 0 };
        if (method === "getPcbLayers") return { layerCount: 4, copperLayerCount: 2 };
        if (method === "getRoutingStatus") return { totalNets: 10, routedNets: 10, completionPercent: 100 };
        if (method === "listPcbComponents") return { total: 2, count: 2, components: [] };
        if (method === "highlightNet") return { highlighted: true, net: "GND" };
        if (method === "getSelection") return { count: 0, selection: [] };
        if (method === "searchLibrary") return { count: 1, results: [] };
        return { ok: true, params };
      })
    };
    const client = await makeClient(bridge);
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "easyeda_export_cpl",
        "easyeda_run_drc",
        "easyeda_get_pcb_layers",
        "easyeda_get_routing_status",
        "easyeda_list_pcb_components",
        "easyeda_highlight_net",
        "easyeda_get_selection",
        "easyeda_search_library"
      ])
    );

    // Call exportCpl
    const cplRes = await client.callTool({
      name: "easyeda_export_cpl",
      arguments: { fileName: "test", format: "csv", unit: "mm" }
    });
    expect(cplRes.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith("exportCpl", { fileName: "test", format: "csv", unit: "mm" }, 30_000);

    // Call runDrc
    const drcRes = await client.callTool({
      name: "easyeda_run_drc",
      arguments: { strict: true }
    });
    expect(drcRes.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith("runDrc", { strict: true }, 60_000);

    // Call getPcbLayers
    const layersRes = await client.callTool({
      name: "easyeda_get_pcb_layers",
      arguments: {}
    });
    expect(layersRes.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith("getPcbLayers", {}, 10_000);

    // Call getRoutingStatus
    const routingRes = await client.callTool({
      name: "easyeda_get_routing_status",
      arguments: { includeNetLengths: true }
    });
    expect(routingRes.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith("getRoutingStatus", { includeNetLengths: true }, 30_000);

    // Call listPcbComponents
    const pcbCompRes = await client.callTool({
      name: "easyeda_list_pcb_components",
      arguments: { layer: "top" }
    });
    expect(pcbCompRes.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith("listPcbComponents", { layer: "top", limit: 100, includeRaw: false }, 30_000);

    // Call highlightNet
    const hlRes = await client.callTool({
      name: "easyeda_highlight_net",
      arguments: { net: "GND" }
    });
    expect(hlRes.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith("highlightNet", { net: "GND", clear: false }, 10_000);

    // Call getSelection
    const selRes = await client.callTool({
      name: "easyeda_get_selection",
      arguments: {}
    });
    expect(selRes.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith("getSelection", {}, 10_000);

    // Call searchLibrary
    const libRes = await client.callTool({
      name: "easyeda_search_library",
      arguments: { query: "C1523" }
    });
    expect(libRes.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith("searchLibrary", { query: "C1523", limit: 20 }, 30_000);
    expect(bridge.call).toHaveBeenCalledWith("getRoutingStatus", { includeNetLengths: true }, 30_000);
  });
});
