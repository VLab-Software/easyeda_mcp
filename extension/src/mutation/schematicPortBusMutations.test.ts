import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzePortsAndBusesDiagnostics,
  distanceToPolyline,
  distanceToSegment,
  fetchSchematicPortsBusesReport,
  normalizeLineCoordinates,
  parseBusName,
  prepareSchematicBusMutation,
  prepareSchematicPortMutation
} from "./schematicPortBusMutations.js";
import { extensionMutations } from "./mutationManager.js";
import { createActionHandlers } from "../handlers/actionHandlers.js";
import type { EasyEdaApi } from "../types.js";

describe("schematicPortBusMutations", () => {
  beforeEach(() => {
    extensionMutations.invalidateAll();
  });

  describe("parseBusName & geometry helpers", () => {
    it("parses ascending bus ranges like DATA[0..7]", () => {
      const res = parseBusName("DATA[0..7]");
      expect(res.prefix).toBe("DATA");
      expect(res.range).toEqual({
        start: 0,
        end: 7,
        count: 8,
        signals: ["DATA0", "DATA1", "DATA2", "DATA3", "DATA4", "DATA5", "DATA6", "DATA7"]
      });
      expect(res.signals).toHaveLength(8);
      expect(res.signals[0]).toBe("DATA0");
      expect(res.signals[7]).toBe("DATA7");
    });

    it("parses descending bus ranges like ADDR[3:0]", () => {
      const res = parseBusName("ADDR[3:0]");
      expect(res.prefix).toBe("ADDR");
      expect(res.range?.signals).toEqual(["ADDR3", "ADDR2", "ADDR1", "ADDR0"]);
    });

    it("parses bracketed member lists like BUS[RX,TX,CTS]", () => {
      const res = parseBusName("BUS[RX,TX,CTS]");
      expect(res.prefix).toBe("BUS");
      expect(res.signals).toEqual(["BUS_RX", "BUS_TX", "BUS_CTS"]);
    });

    it("parses comma-separated lists and single net names", () => {
      const list = parseBusName("SPI_CLK, SPI_MISO, SPI_MOSI");
      expect(list.signals).toEqual(["SPI_CLK", "SPI_MISO", "SPI_MOSI"]);

      const single = parseBusName("VBUS");
      expect(single.signals).toEqual(["VBUS"]);
    });

    it("throws error for excessively large bus ranges", () => {
      expect(() => parseBusName("DATA[0..1000]")).toThrowError(/maximum allowed is 512/);
    });

    it("normalizes coordinates and computes line/polyline distances", () => {
      const flat = normalizeLineCoordinates([10, 20, 30, 40]);
      expect(flat).toEqual([10, 20, 30, 40]);

      const pairs = normalizeLineCoordinates([
        [10, 20],
        [30, 40]
      ]);
      expect(pairs).toEqual([10, 20, 30, 40]);

      expect(() => normalizeLineCoordinates([10])).toThrowError(/at least 2 points/);

      // Distance from point (15, 20) to segment (10, 20)-(30, 20) should be 0
      const dSeg = distanceToSegment({ x: 15, y: 20 }, { x: 10, y: 20 }, { x: 30, y: 20 });
      expect(dSeg).toBe(0);

      // Distance from point (15, 25) to same segment should be 5
      const dOff = distanceToSegment({ x: 15, y: 25 }, { x: 10, y: 20 }, { x: 30, y: 20 });
      expect(dOff).toBeCloseTo(5);

      // Distance to polyline
      const dPoly = distanceToPolyline({ x: 15, y: 25 }, [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
        { x: 30, y: 20 }
      ]);
      expect(dPoly).toBeCloseTo(5);
    });
  });

  describe("analyzePortsAndBusesDiagnostics", () => {
    it("flags conflicting port directions and dangling bus entries", () => {
      const diagnostics = analyzePortsAndBusesDiagnostics(
        [
          { primitiveId: "p1", name: "TXD", portType: "output", x: 100, y: 100, rotation: 0 },
          { primitiveId: "p2", name: "TXD", portType: "input", x: 200, y: 200, rotation: 0 },
          { primitiveId: "p3", name: "", portType: "bidirectional", x: 300, y: 300, rotation: 0 }
        ],
        [
          {
            primitiveId: "b1",
            name: "DATA[0..3]",
            prefix: "DATA",
            signals: ["DATA0", "DATA1", "DATA2", "DATA3"],
            coordinates: [100, 100, 200, 100],
            points: [
              { x: 100, y: 100 },
              { x: 200, y: 100 }
            ]
          }
        ],
        [
          // Touching bus at (120, 100) with matching net
          {
            primitiveId: "be1",
            startX: 120,
            startY: 100,
            endX: 130,
            endY: 110,
            net: "DATA1"
          },
          // Touching bus at (150, 100) with mismatched net
          {
            primitiveId: "be2",
            startX: 150,
            startY: 100,
            endX: 160,
            endY: 110,
            net: "RESET"
          },
          // Far away from bus (dangling)
          {
            primitiveId: "be3",
            startX: 500,
            startY: 500,
            endX: 510,
            endY: 510,
            net: "DATA0"
          }
        ]
      );

      const codes = diagnostics.map((d) => d.code);
      expect(codes).toContain("conflicting_port_types");
      expect(codes).toContain("unnamed_port");
      expect(codes).toContain("bus_signal_mismatch");
      expect(codes).toContain("dangling_bus_entry");
    });
  });

  describe("fetchSchematicPortsBusesReport", () => {
    it("collects ports, buses, and bus entries from EasyEDA Pro API", async () => {
      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "schematic",
            uuid: "doc-sch-1",
            title: "Main.json"
          }))
        },
        sch_PrimitiveNetPort: {
          getAll: vi.fn(async () => [
            { primitiveId: "port-1", name: "CLK", portType: "input", x: 50, y: 80, rotation: 0 }
          ])
        },
        sch_PrimitiveBus: {
          getAll: vi.fn(async () => [
            {
              primitiveId: "bus-1",
              name: "ADDR[0..15]",
              pointList: [0, 100, 400, 100],
              lineWidth: 2
            }
          ])
        },
        sch_PrimitiveBusEntry: {
          getAll: vi.fn(async () => [
            {
              primitiveId: "entry-1",
              startX: 50,
              startY: 100,
              endX: 60,
              endY: 110,
              net: "ADDR0"
            }
          ])
        }
      };

      const report = await fetchSchematicPortsBusesReport(() => mockApi);
      expect(report.summary.portCount).toBe(1);
      expect(report.summary.busCount).toBe(1);
      expect(report.summary.busEntryCount).toBe(1);
      expect(report.summary.totalSignalsInBuses).toBe(16);
      expect(report.ports[0].name).toBe("CLK");
      expect(report.buses[0].name).toBe("ADDR[0..15]");
      expect(report.busEntries[0].net).toBe("ADDR0");
      expect(report.diagnostics).toHaveLength(0);
    });

    it("rejects non-schematic active documents", async () => {
      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "pcb",
            uuid: "doc-pcb-1",
            title: "Board.pcb"
          }))
        }
      };

      await expect(fetchSchematicPortsBusesReport(() => mockApi)).rejects.toThrowError(/active schematic/);
    });
  });

  describe("prepareSchematicPortMutation & execution", () => {
    it("prepares and executes createPort mutation", async () => {
      let createdPortRecord: any = null;
      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "schematic",
            uuid: "doc-sch-1",
            title: "Main.json"
          }))
        },
        sch_PrimitiveNetPort: {
          getAll: vi.fn(async () => (createdPortRecord ? [createdPortRecord] : [])),
          create: vi.fn(async (params) => {
            createdPortRecord = { primitiveId: "port-new-1", ...params };
            return createdPortRecord;
          })
        }
      };

      const prep = await prepareSchematicPortMutation(() => mockApi, {
        action: "createPort",
        name: "SPI_CS",
        portType: "output",
        x: 120,
        y: 240,
        rotation: 90
      });

      expect(typeof prep.mutationId).toBe("string");
      expect(prep.confirmation).toContain("CONFIRM schematic:createPort");

      const actionHandlers = createActionHandlers(() => mockApi, {} as any, extensionMutations);
      const res = (await actionHandlers.confirmedAction({
        action: "mutation",
        params: { mutationId: prep.mutationId },
        confirmation: prep.confirmation
      })) as any;

      expect(res.status).toBe("applied");
      expect((res.after as any).name).toBe("SPI_CS");
      expect((res.after as any).portType).toBe("output");
      expect((res.after as any).verified).toBe(true);
    });

    it("prepares and executes modifyPort mutation", async () => {
      let portRecord: any = {
        primitiveId: "port-10",
        name: "OLD_NET",
        portType: "bidirectional",
        x: 100,
        y: 100,
        rotation: 0
      };

      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "schematic",
            uuid: "doc-sch-1",
            title: "Main.json"
          }))
        },
        sch_PrimitiveNetPort: {
          getAll: vi.fn(async () => [portRecord]),
          modify: vi.fn(async (id, props) => {
            portRecord = { ...portRecord, ...props };
            return true;
          })
        }
      };

      const prep = await prepareSchematicPortMutation(() => mockApi, {
        action: "modifyPort",
        portId: "port-10",
        name: "NEW_NET",
        portType: "input"
      });

      expect(typeof prep.mutationId).toBe("string");
      expect(prep.confirmation).toContain("CONFIRM schematic:modifyPort");

      const actionHandlers = createActionHandlers(() => mockApi, {} as any, extensionMutations);
      const res = (await actionHandlers.confirmedAction({
        action: "mutation",
        params: { mutationId: prep.mutationId },
        confirmation: prep.confirmation
      })) as any;

      expect(res.status).toBe("applied");
      expect((res.after as any).port.name).toBe("NEW_NET");
      expect((res.after as any).port.portType).toBe("input");
    });

    it("prepares and executes deletePort mutation", async () => {
      let portList = [
        { primitiveId: "port-del-1", name: "UNUSED", portType: "bidirectional", x: 10, y: 10, rotation: 0 }
      ];

      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "schematic",
            uuid: "doc-sch-1",
            title: "Main.json"
          }))
        },
        sch_PrimitiveNetPort: {
          getAll: vi.fn(async () => portList),
          delete: vi.fn(async ([id]) => {
            portList = portList.filter((p) => p.primitiveId !== id);
            return true;
          })
        }
      };

      const prep = await prepareSchematicPortMutation(() => mockApi, {
        action: "deletePort",
        portId: "port-del-1"
      });

      const actionHandlers = createActionHandlers(() => mockApi, {} as any, extensionMutations);
      const res = (await actionHandlers.confirmedAction({
        action: "mutation",
        params: { mutationId: prep.mutationId },
        confirmation: prep.confirmation
      })) as any;

      expect(res.status).toBe("applied");
      expect((res.after as any).deleted).toBe(true);
      expect(portList).toHaveLength(0);
    });
  });

  describe("prepareSchematicBusMutation & execution", () => {
    it("prepares and executes createBus mutation", async () => {
      let createdBusRecord: any = null;
      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "schematic",
            uuid: "doc-sch-1",
            title: "Main.json"
          }))
        },
        sch_PrimitiveBus: {
          getAll: vi.fn(async () => (createdBusRecord ? [createdBusRecord] : [])),
          create: vi.fn(async (coords, options) => {
            createdBusRecord = {
              primitiveId: "bus-created-1",
              name: options.name,
              pointList: coords,
              lineWidth: options.strokeWidth
            };
            return createdBusRecord;
          })
        }
      };

      const prep = await prepareSchematicBusMutation(() => mockApi, {
        action: "createBus",
        name: "DATA[0..7]",
        coordinates: [100, 200, 300, 200],
        lineWidth: 3
      });

      expect(typeof prep.mutationId).toBe("string");
      expect(prep.confirmation).toContain("CONFIRM schematic:createBus");
      expect((prep.preview as any).impact).toContain("DATA[0..7]");

      const actionHandlers = createActionHandlers(() => mockApi, {} as any, extensionMutations);
      const res = (await actionHandlers.confirmedAction({
        action: "mutation",
        params: { mutationId: prep.mutationId },
        confirmation: prep.confirmation
      })) as any;

      expect(res.status).toBe("applied");
      expect((res.after as any).name).toBe("DATA[0..7]");
      expect((res.after as any).signalsCount).toBe(8);
      expect((res.after as any).verified).toBe(true);
    });

    it("prepares and executes createBusEntry mutation", async () => {
      let createdEntryRecord: any = null;
      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "schematic",
            uuid: "doc-sch-1",
            title: "Main.json"
          }))
        },
        sch_PrimitiveBusEntry: {
          getAll: vi.fn(async () => (createdEntryRecord ? [createdEntryRecord] : [])),
          create: vi.fn(async (params) => {
            createdEntryRecord = {
              primitiveId: "entry-created-1",
              ...params
            };
            return createdEntryRecord;
          })
        }
      };

      const prep = await prepareSchematicBusMutation(() => mockApi, {
        action: "createBusEntry",
        startX: 120,
        startY: 200,
        endX: 130,
        endY: 210,
        net: "DATA0"
      });

      expect(typeof prep.mutationId).toBe("string");
      expect(prep.confirmation).toContain("CONFIRM schematic:createBusEntry");

      const actionHandlers = createActionHandlers(() => mockApi, {} as any, extensionMutations);
      const res = (await actionHandlers.confirmedAction({
        action: "mutation",
        params: { mutationId: prep.mutationId },
        confirmation: prep.confirmation
      })) as any;

      expect(res.status).toBe("applied");
      expect((res.after as any).net).toBe("DATA0");
      expect((res.after as any).verified).toBe(true);
    });

    it("prepares and executes deleteBusEntry mutation", async () => {
      let entries = [{ primitiveId: "entry-del-1", startX: 10, startY: 10, endX: 20, endY: 20 }];
      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "schematic",
            uuid: "doc-sch-1",
            title: "Main.json"
          }))
        },
        sch_PrimitiveBusEntry: {
          getAll: vi.fn(async () => entries),
          delete: vi.fn(async ([id]) => {
            entries = entries.filter((e) => e.primitiveId !== id);
            return true;
          })
        }
      };

      const prep = await prepareSchematicBusMutation(() => mockApi, {
        action: "deleteBusEntry",
        entryId: "entry-del-1"
      });

      const actionHandlers = createActionHandlers(() => mockApi, {} as any, extensionMutations);
      const res = (await actionHandlers.confirmedAction({
        action: "mutation",
        params: { mutationId: prep.mutationId },
        confirmation: prep.confirmation
      })) as any;

      expect(res.status).toBe("applied");
      expect((res.after as any).deleted).toBe(true);
      expect(entries).toHaveLength(0);
    });
  });
});
