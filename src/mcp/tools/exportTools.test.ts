import type { EditorStatus } from "../../protocol/messages.js";
import { describe, expect, it, vi } from "vitest";
import { McpServer, InMemoryTransport } from "@modelcontextprotocol/server";
import { Client } from "@modelcontextprotocol/client";
import { registerExportTools } from "./exportTools.js";

describe("exportTools", () => {
  it("registers all export, navigation and library tools", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    const registerToolSpy = vi.spyOn(server, "registerTool");
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn()
    };

    registerExportTools(server, bridge);

    const registeredToolNames = registerToolSpy.mock.calls.map((call) => call[0]);
    expect(registeredToolNames).toEqual([
      "easyeda_navigate_component",
      "easyeda_navigate_region",
      "easyeda_zoom_board",
      "easyeda_export_bom",
      "easyeda_export_netlist",
      "easyeda_export_gerber",
      "easyeda_export_pdf",
      "easyeda_export_cpl",
      "easyeda_search_library",
      "easyeda_get_device_details",
      "easyeda_compare_devices",
      "easyeda_verify_pin_pad_mapping"
    ]);
  });

  it("invokes easyeda_get_device_details with designator query", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        device: { name: "STM32F103C8T6", uuid: "dev-1" },
        mappingIntegrity: { complete: true }
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerExportTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_device_details",
      arguments: { designator: "U1" }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getDeviceDetails",
      {
        designator: "U1",
        includePinPadMap: true,
        includeRaw: false
      },
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        device: { name: "STM32F103C8T6" }
      }
    });

    await client.close();
  });

  it("invokes easyeda_compare_devices with deviceA and deviceB", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        summary: { dropInReplacement: true, compatibilityScorePercent: 100 }
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerExportTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_compare_devices",
      arguments: { deviceA: "C1523", deviceB: "C2040" }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "compareDevices",
      {
        deviceA: "C1523",
        deviceB: "C2040",
        strictPinout: true
      },
      30_000
    );

    await client.close();
  });

  it("invokes easyeda_verify_pin_pad_mapping for all components", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        totalComponentsChecked: 15,
        mismatchesCount: 0,
        verified: true
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerExportTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_verify_pin_pad_mapping",
      arguments: {}
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith("verifyPinPadMapping", {}, 30_000);

    await client.close();
  });
});
