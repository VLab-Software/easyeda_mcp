import { describe, expect, it, vi } from "vitest";
import { createPcbHandlers, normalizePcbPad } from "./pcbHandlers.js";

describe("Extension PCB Handlers - Pads and Components", () => {
  const pcbDocInfo = {
    uuid: "doc-pcb-123",
    name: "MainBoard.PcbDoc",
    documentType: 3, // PCB
    parentProjectUuid: "proj-pcb-456",
    projectName: "TestPcbProject",
    tabId: "tab-pcb-1"
  };

  const mockComponentU1 = {
    primitiveId: "comp-u1",
    designator: "U1",
    footprint: "SOIC-8",
    value: "NE555",
    x: 1000,
    y: 2000,
    rotation: 90,
    layer: 1, // Top
    properties: { Manufacturer: "TI", PartNumber: "NE555DR" },
    getAllPins: vi.fn(async () => [
      {
        primitiveId: "pad-u1-1",
        padNumber: "1",
        net: "GND",
        x: 950,
        y: 1950,
        layer: 1,
        width: 40,
        height: 60,
        holeDiameter: 0,
        shape: "rect"
      },
      {
        primitiveId: "pad-u1-8",
        padNumber: "8",
        net: "VCC",
        x: 1050,
        y: 2050,
        layer: 1,
        width: 40,
        height: 60,
        holeDiameter: 0,
        shape: "rect"
      }
    ])
  };

  const mockComponentJ1 = {
    primitiveId: "comp-j1",
    designator: "J1",
    footprint: "HDR-1x2",
    value: "CONN",
    x: 500,
    y: 500,
    rotation: 0,
    layer: 11, // MultiLayer
    pins: [
      {
        primitiveId: "pad-j1-1",
        padNumber: "1",
        net: "VCC",
        x: 500,
        y: 500,
        layer: "MultiLayer",
        width: 60,
        height: 60,
        holeDiameter: 35,
        shape: "round"
      },
      {
        primitiveId: "pad-j1-2",
        padNumber: "2",
        net: "GND",
        x: 500,
        y: 600,
        layer: "MultiLayer",
        width: 60,
        height: 60,
        holeDiameter: 35,
        shape: "round"
      }
    ]
  };

  const mockStandalonePads = [
    {
      primitiveId: "pad-tp-1",
      padNumber: "TP1",
      net: "VCC",
      x: 300,
      y: 300,
      layer: 1,
      width: 50,
      height: 50,
      holeDiameter: 0,
      shape: "round"
    }
  ];

  function makeMockApi(docInfo: any = pcbDocInfo) {
    return {
      dmt_SelectControl: {
        getCurrentDocumentInfo: vi.fn(async () => docInfo)
      },
      pcb_PrimitiveComponent: {
        getAll: vi.fn(async () => [mockComponentU1, mockComponentJ1])
      },
      pcb_PrimitivePad: {
        getAll: vi.fn(async () => mockStandalonePads)
      },
      pcb_Net: {
        getAllNetsName: vi.fn(async () => ["GND", "VCC"])
      }
    };
  }

  describe("normalizePcbPad", () => {
    it("normalizes SMD pad with side, net, and dimensions", () => {
      const raw = {
        primitiveId: "pad-1",
        padNumber: "1",
        net: "VCC",
        x: 100,
        y: 200,
        layer: 1,
        width: 30,
        height: 50,
        holeDiameter: 0,
        shape: "rect"
      };
      const normalized = normalizePcbPad(raw, { designator: "R1", primitiveId: "comp-r1" });
      expect(normalized).toMatchObject({
        primitiveId: "pad-1",
        padNumber: "1",
        net: "VCC",
        x: 100,
        y: 200,
        layer: 1,
        side: "top",
        isThroughHole: false,
        componentDesignator: "R1",
        componentPrimitiveId: "comp-r1"
      });
    });

    it("normalizes through-hole pad with holeDiameter and multi-layer side", () => {
      const raw = {
        primitiveId: "pad-th-1",
        padNumber: "1",
        net: "GND",
        x: 500,
        y: 500,
        layer: 11,
        holeDiameter: 40,
        width: 70,
        height: 70
      };
      const normalized = normalizePcbPad(raw);
      expect(normalized).toMatchObject({
        side: "multi",
        isThroughHole: true,
        holeDiameter: 40
      });
    });
  });

  describe("getPcbPads", () => {
    it("collects all pads from components and standalone pads", async () => {
      const mockApi = makeMockApi();
      const handlers = createPcbHandlers(() => mockApi);

      const result = (await handlers.getPcbPads({})) as any;

      expect(result.totalPads).toBe(5); // 2 from U1, 2 from J1, 1 standalone
      expect(result.count).toBe(5);
      expect(result.pads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ padNumber: "1", componentDesignator: "U1", net: "GND" }),
          expect.objectContaining({ padNumber: "8", componentDesignator: "U1", net: "VCC" }),
          expect.objectContaining({ padNumber: "1", componentDesignator: "J1", isThroughHole: true }),
          expect.objectContaining({ padNumber: "TP1", componentDesignator: undefined, net: "VCC" })
        ])
      );
    });

    it("filters pads by component designator", async () => {
      const mockApi = makeMockApi();
      const handlers = createPcbHandlers(() => mockApi);

      const result = (await handlers.getPcbPads({ component: "U1" })) as any;

      expect(result.count).toBe(2);
      expect(result.pads.every((p: any) => p.componentDesignator === "U1")).toBe(true);
    });

    it("filters pads by net name", async () => {
      const mockApi = makeMockApi();
      const handlers = createPcbHandlers(() => mockApi);

      const result = (await handlers.getPcbPads({ net: "GND" })) as any;

      expect(result.count).toBe(2);
      expect(result.pads.every((p: any) => p.net === "GND")).toBe(true);
    });

    it("filters pads by layer/through-hole side", async () => {
      const mockApi = makeMockApi();
      const handlers = createPcbHandlers(() => mockApi);

      const result = (await handlers.getPcbPads({ layer: "multi" })) as any;

      expect(result.count).toBe(2);
      expect(result.pads.every((p: any) => p.isThroughHole === true)).toBe(true);
    });

    it("rejects when active document does not match expected PCB target", async () => {
      const mockApi = makeMockApi({
        uuid: "doc-sch-1",
        documentType: 1 // Schematic
      });
      const handlers = createPcbHandlers(() => mockApi);

      await expect(
        handlers.getPcbPads({
          expectedTarget: { documentType: "pcb" }
        })
      ).rejects.toThrow();
    });

    it("asserts expectedTarget match", async () => {
      const mockApi = makeMockApi();
      const handlers = createPcbHandlers(() => mockApi);

      await expect(
        handlers.getPcbPads({
          expectedTarget: { documentId: "wrong-pcb-uuid" }
        })
      ).rejects.toThrow("Active document");
    });
  });

  describe("listPcbComponents", () => {
    it("lists components and attaches pad details when includePads is true", async () => {
      const mockApi = makeMockApi();
      const handlers = createPcbHandlers(() => mockApi);

      const result = (await handlers.listPcbComponents({ includePads: true, includeProperties: true })) as any;

      expect(result.total).toBe(2);
      const u1 = result.components.find((c: any) => c.designator === "U1");
      expect(u1).toBeDefined();
      expect(u1.padCount).toBe(2);
      expect(u1.pads).toHaveLength(2);
      expect(u1.pads[0]).toMatchObject({ padNumber: "1", net: "GND" });
      expect(u1.properties).toEqual({ Manufacturer: "TI", PartNumber: "NE555DR" });
    });

    it("rejects listPcbComponents when active document does not match expected PCB target", async () => {
      const mockApi = makeMockApi({
        uuid: "doc-sch-1",
        documentType: 1 // Schematic
      });
      const handlers = createPcbHandlers(() => mockApi);

      await expect(
        handlers.listPcbComponents({
          expectedTarget: { documentType: "pcb" }
        })
      ).rejects.toThrow();
    });
  });
});
