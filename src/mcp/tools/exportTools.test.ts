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
      "easyeda_export_image",
      "easyeda_export_3d_model",
      "easyeda_export_project_archive",
      "easyeda_export_dxf",
      "easyeda_search_library",
      "easyeda_get_device_details",
      "easyeda_compare_devices",
      "easyeda_verify_pin_pad_mapping"
    ]);
  });

  it("invokes easyeda_export_image with svg format and transparency", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        saved: true,
        fileName: "board-render.svg",
        format: "svg",
        scope: "pcb",
        validation: { valid: true, fileSizeBytes: 1024 }
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerExportTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_export_image",
      arguments: {
        fileName: "board-render",
        format: "svg",
        transparentBackground: true,
        scope: "pcb"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "exportImage",
      {
        fileName: "board-render",
        format: "svg",
        scope: "pcb",
        theme: "default",
        transparentBackground: true,
        dpi: 300
      },
      30_000
    );

    await client.close();
  });

  it("invokes easyeda_export_3d_model with STEP format and 3D component models", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        saved: true,
        fileName: "board-cad.step",
        format: "step",
        quality: "high",
        validation: { valid: true, fileSizeBytes: 20480 }
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerExportTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_export_3d_model",
      arguments: {
        fileName: "board-cad",
        format: "step",
        includeComponents3D: true,
        quality: "high"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "export3dModel",
      {
        fileName: "board-cad",
        format: "step",
        includeComponents3D: true,
        includeCopper: true,
        includeSilkscreen: true,
        quality: "high"
      },
      60_000
    );

    await client.close();
  });

  it("invokes easyeda_export_project_archive with epro format", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        saved: true,
        fileName: "my-project.epro",
        format: "epro",
        projectName: "PowerSupply",
        documentCount: 3,
        validation: { valid: true }
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerExportTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_export_project_archive",
      arguments: {
        fileName: "my-project",
        format: "epro",
        includeLibraries: true
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "exportProjectArchive",
      {
        fileName: "my-project",
        format: "epro",
        includeLibraries: true,
        includeHistory: false
      },
      60_000
    );

    await client.close();
  });

  it("invokes easyeda_export_dxf with PCB scope and DXF 2004 version", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        saved: true,
        fileName: "board-drawing.dxf",
        format: "dxf",
        unit: "mm",
        dxfVersion: "2004",
        validation: { valid: true }
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerExportTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_export_dxf",
      arguments: {
        fileName: "board-drawing",
        unit: "mm",
        dxfVersion: "2004"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "exportDxf",
      {
        fileName: "board-drawing",
        scope: "pcb",
        unit: "mm",
        dxfVersion: "2004"
      },
      30_000
    );

    await client.close();
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
