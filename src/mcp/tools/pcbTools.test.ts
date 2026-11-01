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
      "easyeda_get_board_outline",
      "easyeda_prepare_board_outline",
      "easyeda_prepare_pcb_routing",
      "easyeda_prepare_pcb_layout",
      "easyeda_get_pcb_tracks",
      "easyeda_get_pcb_vias",
      "easyeda_prepare_pcb_track_via",
      "easyeda_highlight_net",
      "easyeda_get_copper_zones",
      "easyeda_get_keepouts",
      "easyeda_prepare_copper_keepout",
      "easyeda_get_pcb_airwires",
      "easyeda_get_pcb_placement_report",
      "easyeda_get_pcb_net_report",
      "easyeda_get_pcb_net_classes",
      "easyeda_get_pcb_differential_pairs",
      "easyeda_get_pcb_length_groups",
      "easyeda_prepare_pcb_net_constraint",
      "easyeda_get_pcb_3d_inspection",
      "easyeda_get_pcb_3d_view",
      "easyeda_prepare_pcb_external_import"
    ]);
  });

  it("invokes easyeda_run_drc with detailed parameters and target assertion", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        executionId: "drc_123456_abc",
        executedAt: "2026-11-01T15:00:00.000Z",
        status: "violations_found",
        passed: false,
        violationsCount: 1,
        errorsCount: 1,
        warningsCount: 0,
        violations: [
          {
            id: "violation-1",
            rule: "Clearance",
            category: "Clearance",
            message: "Clearance error: actual 0.12mm, required 0.20mm",
            severity: "error",
            evidence: { actual: 0.12, expected: 0.2, difference: -0.08 }
          }
        ],
        summary: {
          totalViolations: 1,
          errors: 1,
          warnings: 0,
          byCategory: { Clearance: 1 }
        },
        editorComparison: {
          editorApiQueried: true,
          editorErrorCount: 1,
          checkErrorCount: 1,
          matched: true
        }
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_run_drc",
      arguments: {
        strict: true,
        severity: "error",
        rule: "Clearance",
        limit: 50,
        compareWithEditor: true,
        target: { documentId: "pcb-doc-123" }
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "runDrc",
      {
        strict: true,
        severity: "error",
        rule: "Clearance",
        limit: 50,
        compareWithEditor: true,
        target: { documentId: "pcb-doc-123" }
      },
      60_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        passed: false,
        status: "violations_found",
        violationsCount: 1,
        errorsCount: 1
      }
    });

    await client.close();
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

  it("invokes easyeda_get_board_outline", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        exists: true,
        segmentCount: 4,
        bounds: { minX: 0, minY: 0, maxX: 100, maxY: 80, width: 100, height: 80 },
        isClosed: true,
        perimeter: 360
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_board_outline",
      arguments: {
        includeSegments: true
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getBoardOutline",
      expect.objectContaining({
        includeSegments: true
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        exists: true,
        segmentCount: 4,
        isClosed: true
      }
    });

    await client.close();
  });

  it("invokes easyeda_prepare_board_outline for setting a rectangular outline", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        mutationId: "mut-outline-456",
        confirmation: "CONFIRM pcb:setBoardOutline mut-outline-456",
        action: "setBoardOutline",
        preview: {
          impact: "Sets rectangular board outline 100x80mm at (0, 0).",
          changedKeys: ["bounds", "width", "height"],
          requestedAfter: { bounds: { width: 100, height: 80 } }
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
      name: "easyeda_prepare_board_outline",
      arguments: {
        action: "set_rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 80
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "prepareBoardOutline",
      expect.objectContaining({
        action: "set_rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 80
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      mutationId: "mut-outline-456",
      confirmation: "CONFIRM pcb:setBoardOutline mut-outline-456"
    });

    await client.close();
  });

  it("invokes easyeda_prepare_pcb_routing for autorouting", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        mutationId: "mut-route-789",
        confirmation: "CONFIRM pcb:autoroute mut-route-789",
        action: "autoroute",
        preview: {
          impact: "Executes native PCB auto-routing for all unrouted nets.",
          changedKeys: ["routing", "routedNets"]
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
      name: "easyeda_prepare_pcb_routing",
      arguments: {
        action: "autoroute",
        keepExistingRoutes: true
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "preparePcbRouting",
      expect.objectContaining({
        action: "autoroute",
        keepExistingRoutes: true
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      mutationId: "mut-route-789",
      confirmation: "CONFIRM pcb:autoroute mut-route-789"
    });

    await client.close();
  });

  it("invokes easyeda_prepare_pcb_layout for autolayout", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        mutationId: "mut-layout-101",
        confirmation: "CONFIRM pcb:autolayout mut-layout-101",
        action: "autolayout",
        preview: {
          impact: "Executes native PCB auto-layout to position components within the board outline.",
          changedKeys: ["layout", "componentPositions"]
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
      name: "easyeda_prepare_pcb_layout",
      arguments: {
        action: "autolayout",
        components: ["U1", "R1"]
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "preparePcbLayout",
      expect.objectContaining({
        action: "autolayout",
        components: ["U1", "R1"]
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      mutationId: "mut-layout-101",
      confirmation: "CONFIRM pcb:autolayout mut-layout-101"
    });

    await client.close();
  });

  it("invokes easyeda_get_pcb_tracks with net and layer filters", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        totalTracks: 1,
        count: 1,
        tracks: [
          {
            primitiveId: "track-101",
            net: "GND",
            layer: 1,
            lineWidth: 0.254,
            startX: 10,
            startY: 20,
            endX: 30,
            endY: 20,
            length: 20
          }
        ]
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_pcb_tracks",
      arguments: {
        net: "GND",
        layer: 1
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getPcbTracks",
      expect.objectContaining({
        net: "GND",
        layer: 1
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        totalTracks: 1,
        count: 1
      }
    });

    await client.close();
  });

  it("invokes easyeda_get_pcb_vias with net filter", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        totalVias: 1,
        count: 1,
        vias: [
          {
            primitiveId: "via-201",
            net: "VCC",
            x: 15,
            y: 25,
            diameter: 0.6,
            holeDiameter: 0.3
          }
        ]
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_pcb_vias",
      arguments: {
        net: "VCC"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getPcbVias",
      expect.objectContaining({
        net: "VCC"
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        totalVias: 1,
        count: 1
      }
    });

    await client.close();
  });

  it("invokes easyeda_prepare_pcb_track_via to stage a track creation mutation", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        mutationId: "mut-trk-99",
        confirmation: "CONFIRM pcb:createTrack mut-trk-99",
        preview: {
          impact: "Creates PCB track on layer 1 (Net: GND, width: 0.254mm) from (10, 10) to (20, 20).",
          scope: "track:create:layer=1:net=GND"
        }
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_prepare_pcb_track_via",
      arguments: {
        entity: "track",
        action: "create",
        net: "GND",
        layer: 1,
        startX: 10,
        startY: 10,
        endX: 20,
        endY: 20,
        lineWidth: 0.254
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "preparePcbTrackVia",
      expect.objectContaining({
        entity: "track",
        action: "create",
        net: "GND"
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      mutationId: "mut-trk-99",
      confirmation: "CONFIRM pcb:createTrack mut-trk-99"
    });

    await client.close();
  });

  it("invokes easyeda_get_copper_zones with filters and returns normalized zones", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        totalZones: 1,
        count: 1,
        zones: [
          {
            primitiveId: "zone_1",
            net: "GND",
            layer: 1,
            clearance: 0.254,
            fillType: "solid",
            isPoured: true,
            vertexCount: 4,
            points: [
              { x: 0, y: 0 },
              { x: 50, y: 0 },
              { x: 50, y: 50 },
              { x: 0, y: 50 }
            ],
            bounds: { minX: 0, minY: 0, maxX: 50, maxY: 50, width: 50, height: 50 }
          }
        ]
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_copper_zones",
      arguments: {
        net: "GND"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getCopperZones",
      expect.objectContaining({
        net: "GND"
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        totalZones: 1,
        count: 1
      }
    });

    await client.close();
  });

  it("invokes easyeda_get_keepouts with layer filter and returns keepout areas", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        totalKeepouts: 1,
        count: 1,
        keepouts: [
          {
            primitiveId: "kp_1",
            layer: "AllLayers",
            keepoutType: "all",
            vertexCount: 4,
            points: [
              { x: 10, y: 10 },
              { x: 20, y: 10 },
              { x: 20, y: 20 },
              { x: 10, y: 20 }
            ],
            bounds: { minX: 10, minY: 10, maxX: 20, maxY: 20, width: 10, height: 10 }
          }
        ]
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_keepouts",
      arguments: {
        layer: "AllLayers"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getKeepouts",
      expect.objectContaining({
        layer: "AllLayers"
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        totalKeepouts: 1,
        count: 1
      }
    });

    await client.close();
  });

  it("invokes easyeda_prepare_copper_keepout to stage a copper rebuild mutation", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        mutationId: "mut-cop-100",
        confirmation: "CONFIRM pcb:rebuildCopper mut-cop-100",
        preview: {
          impact: "Rebuilds all copper zones across PCB.",
          scope: "copperZone:rebuild:all"
        }
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_prepare_copper_keepout",
      arguments: {
        entity: "copperZone",
        action: "rebuild"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "prepareCopperKeepout",
      expect.objectContaining({
        entity: "copperZone",
        action: "rebuild"
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      mutationId: "mut-cop-100",
      confirmation: "CONFIRM pcb:rebuildCopper mut-cop-100"
    });

    await client.close();
  });

  it("invokes easyeda_get_pcb_airwires with net filter and returns airwire report", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        method: "inferred_topology",
        totalAirwires: 2,
        totalAirwireLengthMm: 45.2,
        unroutedNetsCount: 1,
        airwiresByNet: { RESET: 2 },
        airwires: [
          {
            id: "airwire-mst-1",
            net: "RESET",
            from: { componentDesignator: "U1", padNumber: "1", x: 10, y: 10 },
            to: { componentDesignator: "R1", padNumber: "2", x: 20, y: 10 },
            length: 10,
            manhattanLength: 10
          }
        ]
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_pcb_airwires",
      arguments: {
        net: "RESET"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getPcbAirwires",
      expect.objectContaining({
        net: "RESET"
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        totalAirwires: 2,
        unroutedNetsCount: 1
      }
    });

    await client.close();
  });

  it("invokes easyeda_get_pcb_placement_report with collision tolerance", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        method: "geometry_bounding_box",
        totalComponents: 10,
        placedComponentsCount: 10,
        unplacedComponentsCount: 0,
        collisionWarningsCount: 0,
        layerDistribution: { top: 8, bottom: 2, unknown: 0 }
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_pcb_placement_report",
      arguments: {
        collisionTolerance: 0.3
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getPcbPlacementReport",
      expect.objectContaining({
        collisionTolerance: 0.3
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        totalComponents: 10,
        placedComponentsCount: 10
      }
    });

    await client.close();
  });

  it("invokes easyeda_get_pcb_net_report with category filter", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        method: "physical_extraction",
        totalNets: 5,
        routedNetsCount: 4,
        unroutedNetsCount: 1,
        overallRoutingCompletionPercent: 92.5,
        categoryCounts: { power: 1, ground: 1, signal: 3 }
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_pcb_net_report",
      arguments: {
        category: "power"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getPcbNetReport",
      expect.objectContaining({
        category: "power"
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        totalNets: 5,
        overallRoutingCompletionPercent: 92.5
      }
    });

    await client.close();
  });

  it("invokes easyeda_get_pcb_net_classes and returns net classes", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        totalClasses: 1,
        classes: [
          {
            name: "PWR",
            nets: ["VCC", "GND"],
            netCount: 2,
            routingWidth: 0.5,
            clearance: 0.3,
            source: "native_api"
          }
        ]
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_pcb_net_classes",
      arguments: {
        name: "PWR"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getPcbNetClasses",
      expect.objectContaining({
        name: "PWR"
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        totalClasses: 1
      }
    });

    await client.close();
  });

  it("invokes easyeda_get_pcb_differential_pairs and returns differential pairs", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        totalPairs: 1,
        pairs: [
          {
            name: "DIFF_USB",
            positiveNet: "USB_DP",
            negativeNet: "USB_DM",
            skewMm: 0.05,
            toleranceMm: 0.15,
            matched: true,
            source: "inferred_naming"
          }
        ]
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_pcb_differential_pairs",
      arguments: {
        toleranceMm: 0.15
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getPcbDifferentialPairs",
      expect.objectContaining({
        toleranceMm: 0.15
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        totalPairs: 1
      }
    });

    await client.close();
  });

  it("invokes easyeda_get_pcb_length_groups and returns equal length groups", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        totalGroups: 1,
        groups: [
          {
            name: "BUS_DATA",
            nets: ["D0", "D1", "D2", "D3"],
            netCount: 4,
            maxSkewMm: 0.2,
            toleranceMm: 0.5,
            compliant: true,
            source: "native_api"
          }
        ]
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_pcb_length_groups",
      arguments: {
        name: "BUS_DATA"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getPcbLengthGroups",
      expect.objectContaining({
        name: "BUS_DATA"
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        totalGroups: 1
      }
    });

    await client.close();
  });

  it("invokes easyeda_prepare_pcb_net_constraint to stage a differential pair creation", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        mutationId: "mut-diff-1",
        confirmation: "CONFIRM pcb:createDifferentialPair mut-diff-1",
        preview: {
          impact: "Creates differential pair 'DIFF_PCIE' (PCIE_TXP / PCIE_TXN, target: 100Ω, tol: ±0.1mm).",
          scope: "differentialPair:create:DIFF_PCIE"
        }
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_prepare_pcb_net_constraint",
      arguments: {
        entity: "differentialPair",
        action: "create",
        name: "DIFF_PCIE",
        positiveNet: "PCIE_TXP",
        negativeNet: "PCIE_TXN",
        targetImpedance: 100,
        toleranceMm: 0.1
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "prepareNetConstraint",
      expect.objectContaining({
        entity: "differentialPair",
        action: "create",
        name: "DIFF_PCIE"
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      mutationId: "mut-diff-1",
      confirmation: "CONFIRM pcb:createDifferentialPair mut-diff-1"
    });

    await client.close();
  });

  it("invokes easyeda_get_pcb_3d_inspection with height clearance parameters", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        envelope: {
          boardThicknessMm: 1.6,
          maxHeightTopMm: 3.2,
          totalEnvelopeHeightMm: 5.4,
          enclosureStatus: "FIT"
        },
        totalComponents: 10,
        missing3dModels: []
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_pcb_3d_inspection",
      arguments: {
        maxHeightMm: 5.0,
        enclosureHeightMm: 10.0,
        checkInterference: true
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getPcb3dInspection",
      {
        maxHeightMm: 5.0,
        enclosureHeightMm: 10.0,
        checkInterference: true
      },
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      result: {
        envelope: { totalEnvelopeHeightMm: 5.4 }
      }
    });

    await client.close();
  });

  it("invokes easyeda_get_pcb_3d_view with viewAngle preset", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        viewAngle: "isometric_sw",
        camera: { pitch: 45, yaw: 225 },
        renderingLayers: { component3dModels: true }
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_get_pcb_3d_view",
      arguments: {
        viewAngle: "isometric_sw"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "getPcb3dView",
      {
        viewAngle: "isometric_sw"
      },
      30_000
    );

    await client.close();
  });

  it("invokes easyeda_prepare_pcb_external_import with inline content", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn(async () => ({
        mutationId: "mut-import-1",
        confirmation: "CONFIRM pcb:import_external mut-import-1",
        preview: {
          impact: "Import 4 external primitives onto active PCB.",
          scope: "PCB: active document"
        }
      }))
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPcbTools(server, bridge as any);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "easyeda_prepare_pcb_external_import",
      arguments: {
        format: "specctra_ses",
        content: "(session test ...)"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "preparePcbExternalImport",
      expect.objectContaining({
        format: "specctra_ses",
        content: "(session test ...)"
      }),
      30_000
    );
    expect(result.structuredContent).toMatchObject({
      mutationId: "mut-import-1",
      confirmation: "CONFIRM pcb:import_external mut-import-1"
    });

    await client.close();
  });
});
