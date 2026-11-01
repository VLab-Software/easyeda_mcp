import { describe, expect, it, vi } from "vitest";
import { generatePcbAirwiresReport, generatePcbNetReport, generatePcbPlacementReport } from "./pcbBoardReports.js";

describe("pcbBoardReports", () => {
  const pcbDocInfo = {
    uuid: "pcb-doc-1",
    documentType: 3,
    parentProjectUuid: "proj-1",
    name: "Board.PcbDoc"
  };

  const compU1 = {
    getState_PrimitiveId: () => "comp-u1",
    getState_Designator: () => "U1",
    getState_Footprint: () => "SOIC-8",
    getState_X: () => 20,
    getState_Y: () => 20,
    getState_Width: () => 6,
    getState_Height: () => 5,
    layer: 1,
    getState_Pins: () => [
      {
        getState_PrimitiveId: () => "pad-u1-1",
        getState_PadNumber: () => "1",
        getState_Net: () => "GND",
        getState_X: () => 18,
        getState_Y: () => 18
      },
      {
        getState_PrimitiveId: () => "pad-u1-2",
        getState_PadNumber: () => "2",
        getState_Net: () => "VCC_3V3",
        getState_X: () => 18,
        getState_Y: () => 22
      },
      {
        getState_PrimitiveId: () => "pad-u1-3",
        getState_PadNumber: () => "3",
        getState_Net: () => "RESET",
        getState_X: () => 22,
        getState_Y: () => 18
      }
    ]
  };

  const compR1 = {
    getState_PrimitiveId: () => "comp-r1",
    getState_Designator: () => "R1",
    getState_Footprint: () => "R0805",
    getState_X: () => 40,
    getState_Y: () => 20,
    getState_Width: () => 2,
    getState_Height: () => 1.25,
    layer: 1,
    getState_Pins: () => [
      {
        getState_PrimitiveId: () => "pad-r1-1",
        getState_PadNumber: () => "1",
        getState_Net: () => "VCC_3V3",
        getState_X: () => 39,
        getState_Y: () => 20
      },
      {
        getState_PrimitiveId: () => "pad-r1-2",
        getState_PadNumber: () => "2",
        getState_Net: () => "RESET",
        getState_X: () => 41,
        getState_Y: () => 20
      }
    ]
  };

  const compR2 = {
    getState_PrimitiveId: () => "comp-r2",
    getState_Designator: () => "R2",
    getState_Footprint: () => "R0805",
    getState_X: () => 40.5, // Intentionally close to R1 (0.5mm center dist, bounding boxes overlap!)
    getState_Y: () => 20,
    getState_Width: () => 2,
    getState_Height: () => 1.25,
    layer: 1,
    getState_Pins: () => []
  };

  const compUnplaced = {
    getState_PrimitiveId: () => "comp-unplaced",
    getState_Designator: () => "C1",
    getState_Footprint: () => "C0603",
    getState_X: () => 500, // Outside 100x100 board outline
    getState_Y: () => 500,
    getState_Width: () => 1.6,
    getState_Height: () => 0.8,
    layer: 1,
    getState_Pins: () => []
  };

  const mockTrack1 = {
    getState_PrimitiveId: () => "trk-1",
    getState_Net: () => "GND",
    getState_Layer: () => 1,
    getState_LineWidth: () => 0.254,
    getState_StartX: () => 18,
    getState_StartY: () => 18,
    getState_EndX: () => 30,
    getState_EndY: () => 18
  };

  const mockVia1 = {
    getState_PrimitiveId: () => "via-1",
    getState_Net: () => "GND",
    getState_X: () => 30,
    getState_Y: () => 18
  };

  const mockZone1 = {
    getState_PrimitiveId: () => "zone-gnd",
    getState_Net: () => "GND",
    getState_Layer: () => 1,
    getState_Points: () => [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ]
  };

  function createMockApi(overrides: Record<string, any> = {}) {
    return {
      dmt_SelectControl: {
        getCurrentDocumentInfo: vi.fn(async () => pcbDocInfo)
      },
      pcb_PrimitiveComponent: {
        getAll: vi.fn(async () => [compU1, compR1, compR2, compUnplaced])
      },
      pcb_PrimitivePad: {
        getAll: vi.fn(async () => [])
      },
      pcb_PrimitiveTrack: {
        getAll: vi.fn(async () => [mockTrack1])
      },
      pcb_PrimitiveVia: {
        getAll: vi.fn(async () => [mockVia1])
      },
      pcb_PrimitiveCopperArea: {
        getAll: vi.fn(async () => [mockZone1])
      },
      pcb_Net: {
        getAllNetsName: vi.fn(async () => ["GND", "VCC_3V3", "RESET"])
      },
      pcb_PrimitiveLine: {
        getAll: vi.fn(async () => [
          // Board outline rectangle 0,0 to 100,100
          { layer: 10, getState_Layer: () => 10, startX: 0, startY: 0, endX: 100, endY: 0 },
          { layer: 10, getState_Layer: () => 10, startX: 100, startY: 0, endX: 100, endY: 100 },
          { layer: 10, getState_Layer: () => 10, startX: 100, startY: 100, endX: 0, endY: 100 },
          { layer: 10, getState_Layer: () => 10, startX: 0, startY: 100, endX: 0, endY: 0 }
        ])
      },
      ...overrides
    };
  }

  describe("generatePcbAirwiresReport", () => {
    it("generates inferred airwires with MST for unrouted nets", async () => {
      const api = createMockApi();
      const report = await generatePcbAirwiresReport(() => api as any);

      expect(report.method).toBe("inferred_topology");
      expect(report.tolerances.unit).toBe("mm");
      expect(report.inferenceLimits).toContain("Minimum Spanning Tree");
      expect(report.totalAirwires).toBeGreaterThan(0);
      expect(report.unroutedNetsCount).toBeGreaterThan(0);

      // RESET net connects U1 pin 3 to R1 pin 2
      expect(report.airwiresByNet["RESET"]).toBe(1);
      const resetAirwire = report.airwires.find((a) => a.net === "RESET");
      expect(resetAirwire).toBeDefined();
      expect(resetAirwire?.from.componentDesignator).toBe("U1");
      expect(resetAirwire?.to.componentDesignator).toBe("R1");
      expect(resetAirwire?.length).toBeGreaterThan(15);
    });

    it("uses native ratsnest primitives when available in API", async () => {
      const nativeRatsnest = [
        {
          getState_PrimitiveId: () => "ratsnest-1",
          getState_Net: () => "RESET",
          getState_StartX: () => 22,
          getState_StartY: () => 18,
          getState_EndX: () => 41,
          getState_EndY: () => 20
        }
      ];

      const api = createMockApi({
        pcb_PrimitiveRatsnest: {
          getAll: vi.fn(async () => nativeRatsnest)
        }
      });

      const report = await generatePcbAirwiresReport(() => api as any);
      expect(report.method).toBe("native_ratsnest");
      expect(report.totalAirwires).toBe(1);
      expect(report.airwires[0].net).toBe("RESET");
      expect(report.airwires[0].id).toBe("ratsnest-1");
    });

    it("filters airwires by specific net", async () => {
      const api = createMockApi();
      const report = await generatePcbAirwiresReport(() => api as any, { net: "RESET" });
      expect(report.unroutedNetsCount).toBe(1);
      expect(report.airwires.every((a) => a.net === "RESET")).toBe(true);
    });

    it("throws error if document is not PCB", async () => {
      const api = createMockApi({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({ documentType: 1, name: "Sheet.SchDoc" }))
        }
      });

      await expect(generatePcbAirwiresReport(() => api as any)).rejects.toThrow("requires an active PCB document");
    });
  });

  describe("generatePcbPlacementReport", () => {
    it("detects component bounding boxes, collisions, and out-of-boundary components", async () => {
      const api = createMockApi();
      const report = await generatePcbPlacementReport(() => api as any, { collisionTolerance: 0.2 });

      expect(report.method).toBe("geometry_bounding_box");
      expect(report.tolerances.unit).toBe("mm");
      expect(report.totalComponents).toBe(4);
      expect(report.placedComponentsCount).toBe(3);
      expect(report.unplacedComponentsCount).toBe(1);
      expect(report.unplacedComponents[0].designator).toBe("C1");
      expect(report.unplacedComponents[0].reason).toContain("outside board outline");

      // Collision between R1 and R2
      expect(report.collisionWarningsCount).toBeGreaterThan(0);
      const collision = report.collisions.find(
        (c) => (c.componentA === "R1" && c.componentB === "R2") || (c.componentA === "R2" && c.componentB === "R1")
      );
      expect(collision).toBeDefined();
      expect(collision?.isOverlap).toBe(true);

      // Layer distribution
      expect(report.layerDistribution.top).toBe(3);
      expect(report.layerDistribution.bottom).toBe(0);

      // Density calculation against 100x100mm board (10000mm²)
      expect(report.boardAreaMm2).toBe(10000);
      expect(report.densityPercent).toBeGreaterThan(0);
    });
  });

  describe("generatePcbNetReport", () => {
    it("reports net metrics, categories, track lengths, and completion status", async () => {
      const api = createMockApi();
      const report = await generatePcbNetReport(() => api as any);

      expect(report.method).toBe("physical_extraction");
      expect(report.totalNets).toBe(3);
      expect(report.categoryCounts.ground).toBe(1);
      expect(report.categoryCounts.power).toBe(1);
      expect(report.categoryCounts.signal).toBe(1);

      // GND is routed via copper zone
      const gnd = report.nets.find((n) => n.net === "GND");
      expect(gnd).toBeDefined();
      expect(gnd?.category).toBe("ground");
      expect(gnd?.routingStatus).toBe("routed");
      expect(gnd?.completionPercent).toBe(100);
      expect(gnd?.viaCount).toBe(1);
      expect(gnd?.copperZoneCount).toBe(1);

      // RESET is unrouted (no tracks)
      const reset = report.nets.find((n) => n.net === "RESET");
      expect(reset).toBeDefined();
      expect(reset?.category).toBe("signal");
      expect(reset?.routingStatus).toBe("unrouted");
      expect(reset?.airwireCount).toBe(1);

      // Summary
      expect(report.totalViasCount).toBe(1);
      expect(report.totalCopperZonesCount).toBe(1);
      expect(report.totalTrackLengthMm).toBeGreaterThan(10);
    });

    it("filters nets by category and status", async () => {
      const api = createMockApi();
      const report = await generatePcbNetReport(() => api as any, { category: "ground" });
      expect(report.nets).toHaveLength(1);
      expect(report.nets[0].net).toBe("GND");

      const unroutedReport = await generatePcbNetReport(() => api as any, { status: "unrouted" });
      expect(unroutedReport.nets.every((n) => n.routingStatus === "unrouted")).toBe(true);
    });
  });
});
