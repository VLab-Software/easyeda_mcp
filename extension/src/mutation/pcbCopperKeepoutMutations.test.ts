import { beforeEach, describe, expect, it, vi } from "vitest";
import { extensionMutations } from "./mutationManager.js";
import {
  executePcbCopperKeepoutMutation,
  fetchPcbCopperZones,
  fetchPcbKeepouts,
  normalizeCopperZone,
  normalizeKeepout,
  preparePcbCopperKeepoutMutation
} from "./pcbCopperKeepoutMutations.js";

describe("pcbCopperKeepoutMutations", () => {
  beforeEach(() => {
    extensionMutations.invalidateAll();
  });

  const pcbDocInfo = {
    uuid: "pcb-doc-1",
    documentType: 3,
    parentProjectUuid: "proj-1",
    name: "Board.PcbDoc"
  };

  const mockZone1 = {
    getState_PrimitiveId: () => "zone-1",
    getState_Net: () => "GND",
    getState_Layer: () => 1,
    getState_Clearance: () => 0.254,
    getState_FillStyle: () => "solid",
    getState_IsPoured: () => true,
    getState_Points: () => [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 40 },
      { x: 0, y: 40 }
    ],
    getState_PrimitiveLock: () => false
  };

  const mockZone2 = {
    getState_PrimitiveId: () => "zone-2",
    getState_Net: () => "VCC_3V3",
    getState_Layer: () => 2,
    getState_Clearance: () => 0.3,
    getState_FillStyle: () => "grid",
    getState_IsPoured: () => false,
    getState_Points: () => [
      { x: 10, y: 10 },
      { x: 30, y: 10 },
      { x: 30, y: 30 },
      { x: 10, y: 30 }
    ],
    getState_PrimitiveLock: () => false
  };

  const mockKeepout1 = {
    getState_PrimitiveId: () => "keepout-1",
    getState_Layer: () => "AllLayers",
    getState_KeepoutType: () => "all",
    getState_Points: () => [
      { x: 5, y: 5 },
      { x: 15, y: 5 },
      { x: 15, y: 15 },
      { x: 5, y: 15 }
    ],
    getState_PrimitiveLock: () => false
  };

  function createMockApi(zones: any[] = [mockZone1, mockZone2], keepouts: any[] = [mockKeepout1]) {
    return {
      dmt_SelectControl: {
        getCurrentDocumentInfo: vi.fn(async () => pcbDocInfo)
      },
      pcb_PrimitiveCopperArea: {
        getAll: vi.fn(async () => zones),
        create: vi.fn(async (params) => ({
          getState_PrimitiveId: () => "zone-created-1",
          ...params
        })),
        modify: vi.fn(async () => true),
        delete: vi.fn(async () => true),
        rebuildAll: vi.fn(async () => true)
      },
      pcb_PrimitiveKeepout: {
        getAll: vi.fn(async () => keepouts),
        create: vi.fn(async (params) => ({
          getState_PrimitiveId: () => "keepout-created-1",
          ...params
        })),
        modify: vi.fn(async () => true),
        delete: vi.fn(async () => true)
      },
      pcb_Document: {
        rebuildAllCopperArea: vi.fn(async () => true),
        rebuildCopperArea: vi.fn(async () => true)
      }
    };
  }

  describe("normalization", () => {
    it("normalizes copper zone and calculates bounds and vertex count", () => {
      const normalized = normalizeCopperZone(mockZone1);
      expect(normalized).toBeDefined();
      expect(normalized?.primitiveId).toBe("zone-1");
      expect(normalized?.net).toBe("GND");
      expect(normalized?.layer).toBe(1);
      expect(normalized?.clearance).toBe(0.254);
      expect(normalized?.fillType).toBe("solid");
      expect(normalized?.isPoured).toBe(true);
      expect(normalized?.vertexCount).toBe(4);
      expect(normalized?.bounds).toEqual({
        minX: 0,
        minY: 0,
        maxX: 50,
        maxY: 40,
        width: 50,
        height: 40
      });
    });

    it("normalizes keepout area and calculates bounds", () => {
      const normalized = normalizeKeepout(mockKeepout1);
      expect(normalized).toBeDefined();
      expect(normalized?.primitiveId).toBe("keepout-1");
      expect(normalized?.layer).toBe("AllLayers");
      expect(normalized?.keepoutType).toBe("all");
      expect(normalized?.vertexCount).toBe(4);
      expect(normalized?.bounds).toEqual({
        minX: 5,
        minY: 5,
        maxX: 15,
        maxY: 15,
        width: 10,
        height: 10
      });
    });
  });

  describe("fetching", () => {
    it("fetches copper zones with net and layer filter", async () => {
      const api = createMockApi();
      const res = await fetchPcbCopperZones(api as any, { net: "GND" });
      expect(res.total).toBe(2);
      expect(res.count).toBe(1);
      expect(res.zones[0].net).toBe("GND");
      expect(res.zones[0].primitiveId).toBe("zone-1");
    });

    it("fetches keepouts with layer filter", async () => {
      const api = createMockApi();
      const res = await fetchPcbKeepouts(api as any, { layer: "AllLayers" });
      expect(res.total).toBe(1);
      expect(res.count).toBe(1);
      expect(res.keepouts[0].primitiveId).toBe("keepout-1");
    });
  });

  describe("preparation", () => {
    it("prepares copper zone creation mutation", async () => {
      const api = createMockApi();
      const res = await preparePcbCopperKeepoutMutation(() => api as any, {
        entity: "copperZone",
        action: "create",
        net: "GND",
        layer: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 50 },
          { x: 0, y: 50 }
        ]
      });

      expect(res.mutationId).toBeDefined();
      expect(res.confirmation).toContain("CONFIRM pcb:createCopperZone");
      expect(res.preview).toBeDefined();
    });

    it("prepares copper zone creation using rectangular shortcut (x, y, width, height)", async () => {
      const api = createMockApi();
      const res = await preparePcbCopperKeepoutMutation(() => api as any, {
        entity: "copperZone",
        action: "create",
        net: "PWR_5V",
        layer: 2,
        x: 10,
        y: 10,
        width: 40,
        height: 20
      });

      expect(res.mutationId).toBeDefined();
      expect(res.confirmation).toContain("CONFIRM pcb:createCopperZone");
    });

    it("prepares copper zone rebuild mutation", async () => {
      const api = createMockApi();
      const res = await preparePcbCopperKeepoutMutation(() => api as any, {
        entity: "copperZone",
        action: "rebuild"
      });

      expect(res.mutationId).toBeDefined();
      expect(res.confirmation).toContain("CONFIRM pcb:rebuildCopper");
    });

    it("prepares keepout creation mutation", async () => {
      const api = createMockApi();
      const res = await preparePcbCopperKeepoutMutation(() => api as any, {
        entity: "keepout",
        action: "create",
        layer: 1,
        keepoutType: "track",
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 }
        ]
      });

      expect(res.mutationId).toBeDefined();
      expect(res.confirmation).toContain("CONFIRM pcb:createKeepout");
    });
  });

  describe("execution and readback", () => {
    it("executes copper zone creation and verifies readback", async () => {
      const createdZone = {
        getState_PrimitiveId: () => "zone-created-1",
        getState_Net: () => "GND",
        getState_Layer: () => 1,
        getState_Clearance: () => 0.254,
        getState_FillStyle: () => "solid",
        getState_IsPoured: () => true,
        getState_Points: () => [
          { x: 0, y: 0 },
          { x: 30, y: 0 },
          { x: 30, y: 30 },
          { x: 0, y: 30 }
        ]
      };
      const api = createMockApi([createdZone]);

      const res = await executePcbCopperKeepoutMutation(() => api as any, {
        entity: "copperZone",
        action: "create",
        net: "GND",
        layer: 1,
        points: [
          { x: 0, y: 0 },
          { x: 30, y: 0 },
          { x: 30, y: 30 },
          { x: 0, y: 30 }
        ]
      });

      expect(res.executed).toBe(true);
      expect(res.readback.primitiveId).toBe("zone-created-1");
      expect(api.pcb_PrimitiveCopperArea.create).toHaveBeenCalled();
    });

    it("executes copper rebuild across PCB", async () => {
      const api = createMockApi();

      const res = await executePcbCopperKeepoutMutation(() => api as any, {
        entity: "copperZone",
        action: "rebuild"
      });

      expect(res.executed).toBe(true);
      expect(res.readback.rebuilt).toBe(true);
      expect(api.pcb_Document.rebuildAllCopperArea).toHaveBeenCalled();
    });

    it("executes keepout creation and verifies readback", async () => {
      const createdKeepout = {
        getState_PrimitiveId: () => "keepout-created-1",
        getState_Layer: () => "AllLayers",
        getState_KeepoutType: () => "all",
        getState_Points: () => [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ]
      };
      const api = createMockApi([], [createdKeepout]);

      const res = await executePcbCopperKeepoutMutation(() => api as any, {
        entity: "keepout",
        action: "create",
        layer: "AllLayers",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ]
      });

      expect(res.executed).toBe(true);
      expect(res.readback.primitiveId).toBe("keepout-created-1");
      expect(api.pcb_PrimitiveKeepout.create).toHaveBeenCalled();
    });
  });
});
