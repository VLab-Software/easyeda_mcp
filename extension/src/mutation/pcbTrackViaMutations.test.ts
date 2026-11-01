import { beforeEach, describe, expect, it, vi } from "vitest";
import { extensionMutations } from "./mutationManager.js";
import {
  executePcbTrackViaMutation,
  fetchPcbTracks,
  fetchPcbVias,
  normalizePcbTrack,
  normalizePcbVia,
  preparePcbTrackViaMutation
} from "./pcbTrackViaMutations.js";

describe("pcbTrackViaMutations", () => {
  beforeEach(() => {
    extensionMutations.invalidateAll();
  });

  const pcbDocInfo = {
    uuid: "pcb-doc-1",
    documentType: 3,
    parentProjectUuid: "proj-1",
    name: "Board.PcbDoc"
  };

  const mockTrack1 = {
    getState_PrimitiveId: () => "trk-1",
    getState_Net: () => "GND",
    getState_Layer: () => 1,
    getState_LineWidth: () => 0.254,
    getState_StartX: () => 10,
    getState_StartY: () => 10,
    getState_EndX: () => 30,
    getState_EndY: () => 10,
    getState_PrimitiveLock: () => false
  };

  const mockTrack2 = {
    getState_PrimitiveId: () => "trk-2",
    getState_Net: () => "VCC",
    getState_Layer: () => 2,
    getState_LineWidth: () => 0.5,
    getState_StartX: () => 5,
    getState_StartY: () => 5,
    getState_EndX: () => 5,
    getState_EndY: () => 25,
    getState_PrimitiveLock: () => false
  };

  const mockVia1 = {
    getState_PrimitiveId: () => "via-1",
    getState_Net: () => "GND",
    getState_X: () => 20,
    getState_Y: () => 20,
    getState_Diameter: () => 0.6,
    getState_HoleDiameter: () => 0.3,
    getState_StartLayer: () => 1,
    getState_EndLayer: () => 2,
    getState_PrimitiveLock: () => false
  };

  function createMockApi(tracks: any[] = [mockTrack1, mockTrack2], vias: any[] = [mockVia1]) {
    return {
      dmt_SelectControl: {
        getCurrentDocumentInfo: vi.fn(async () => pcbDocInfo)
      },
      pcb_PrimitiveTrack: {
        getAll: vi.fn(async () => tracks),
        create: vi.fn(async (params) => ({
          getState_PrimitiveId: () => "trk-created-1",
          ...params
        })),
        modify: vi.fn(async () => true),
        delete: vi.fn(async () => true)
      },
      pcb_PrimitiveVia: {
        getAll: vi.fn(async () => vias),
        create: vi.fn(async (params) => ({
          getState_PrimitiveId: () => "via-created-1",
          ...params
        })),
        modify: vi.fn(async () => true),
        delete: vi.fn(async () => true)
      }
    };
  }

  describe("normalization", () => {
    it("normalizes track and calculates euclidean length", () => {
      const normalized = normalizePcbTrack(mockTrack1);
      expect(normalized).toBeDefined();
      expect(normalized?.primitiveId).toBe("trk-1");
      expect(normalized?.net).toBe("GND");
      expect(normalized?.layer).toBe(1);
      expect(normalized?.lineWidth).toBe(0.254);
      expect(normalized?.length).toBe(20);
    });

    it("normalizes via with coordinates and drill diameter", () => {
      const normalized = normalizePcbVia(mockVia1);
      expect(normalized).toBeDefined();
      expect(normalized?.primitiveId).toBe("via-1");
      expect(normalized?.net).toBe("GND");
      expect(normalized?.x).toBe(20);
      expect(normalized?.y).toBe(20);
      expect(normalized?.diameter).toBe(0.6);
      expect(normalized?.holeDiameter).toBe(0.3);
    });
  });

  describe("fetchPcbTracks & fetchPcbVias", () => {
    it("filters tracks by net and layer", async () => {
      const api = createMockApi();
      const result = await fetchPcbTracks(api, { net: "GND" });
      expect(result.total).toBe(2);
      expect(result.count).toBe(1);
      expect(result.tracks[0].primitiveId).toBe("trk-1");

      const layer2Result = await fetchPcbTracks(api, { layer: 2 });
      expect(layer2Result.count).toBe(1);
      expect(layer2Result.tracks[0].primitiveId).toBe("trk-2");
    });

    it("filters vias by net", async () => {
      const api = createMockApi();
      const result = await fetchPcbVias(api, { net: "GND" });
      expect(result.total).toBe(1);
      expect(result.count).toBe(1);
      expect(result.vias[0].primitiveId).toBe("via-1");
    });
  });

  describe("preparePcbTrackViaMutation", () => {
    it("prepares track creation mutation", async () => {
      const api = createMockApi();
      const result = (await preparePcbTrackViaMutation(() => api, {
        entity: "track",
        action: "create",
        net: "GND",
        layer: 1,
        startX: 0,
        startY: 0,
        endX: 10,
        endY: 0,
        lineWidth: 0.3
      })) as any;

      expect(result.mutationId).toBeDefined();
      expect(result.confirmation).toBe(`CONFIRM pcb:createTrack ${result.mutationId}`);
      expect(result.preview.impact).toContain("Creates PCB track on layer 1");
    });

    it("prepares track modification mutation with before snapshot", async () => {
      const api = createMockApi();
      const result = (await preparePcbTrackViaMutation(() => api, {
        entity: "track",
        action: "modify",
        trackId: "trk-1",
        properties: { lineWidth: 0.4 }
      })) as any;

      expect(result.mutationId).toBeDefined();
      expect(result.confirmation).toBe(`CONFIRM pcb:modifyTrack ${result.mutationId}`);
      expect(result.preview.before.lineWidth).toBe(0.254);
    });

    it("prepares track deletion mutation with destructive preview", async () => {
      const api = createMockApi();
      const result = (await preparePcbTrackViaMutation(() => api, {
        entity: "track",
        action: "delete",
        trackId: "trk-1"
      })) as any;

      expect(result.mutationId).toBeDefined();
      expect(result.confirmation).toBe(`CONFIRM pcb:deleteTrack ${result.mutationId}`);
      expect(result.preview.impact).toContain("Destructively deletes PCB track trk-1");
    });

    it("prepares via creation mutation", async () => {
      const api = createMockApi();
      const result = (await preparePcbTrackViaMutation(() => api, {
        entity: "via",
        action: "create",
        net: "VCC",
        x: 50,
        y: 60,
        diameter: 0.8,
        holeDiameter: 0.4
      })) as any;

      expect(result.mutationId).toBeDefined();
      expect(result.confirmation).toBe(`CONFIRM pcb:createVia ${result.mutationId}`);
      expect(result.preview.impact).toContain("Creates PCB via at (50, 60)");
    });

    it("prepares via modification and deletion mutations", async () => {
      const api = createMockApi();
      const modResult = (await preparePcbTrackViaMutation(() => api, {
        entity: "via",
        action: "modify",
        viaId: "via-1",
        properties: { diameter: 0.7 }
      })) as any;
      expect(modResult.confirmation).toBe(`CONFIRM pcb:modifyVia ${modResult.mutationId}`);

      const delResult = (await preparePcbTrackViaMutation(() => api, {
        entity: "via",
        action: "delete",
        viaId: "via-1"
      })) as any;
      expect(delResult.confirmation).toBe(`CONFIRM pcb:deleteVia ${delResult.mutationId}`);
    });

    it("rejects when document is not a PCB", async () => {
      const api = createMockApi();
      api.dmt_SelectControl.getCurrentDocumentInfo = vi.fn(async () => ({ documentType: 1 })); // Schematic
      await expect(
        preparePcbTrackViaMutation(() => api, {
          entity: "track",
          action: "create",
          net: "GND",
          startX: 0,
          startY: 0,
          endX: 1,
          endY: 1
        })
      ).rejects.toThrow("active PCB document");
    });

    it("asserts target match", async () => {
      const api = createMockApi();
      await expect(
        preparePcbTrackViaMutation(() => api, {
          entity: "track",
          action: "create",
          net: "GND",
          startX: 0,
          startY: 0,
          endX: 1,
          endY: 1,
          target: { documentId: "wrong-id" }
        })
      ).rejects.toThrow("Active document");
    });
  });

  describe("executePcbTrackViaMutation", () => {
    it("executes track create and verifies readback", async () => {
      const createdTrack = {
        getState_PrimitiveId: () => "trk-created-1",
        getState_Net: () => "GND",
        getState_Layer: () => 1,
        getState_LineWidth: () => 0.254,
        getState_StartX: () => 0,
        getState_StartY: () => 0,
        getState_EndX: () => 10,
        getState_EndY: () => 0
      };
      const api = createMockApi([mockTrack1, mockTrack2, createdTrack]);

      const res = await executePcbTrackViaMutation(() => api, {
        entity: "track",
        action: "create",
        net: "GND",
        layer: 1,
        startX: 0,
        startY: 0,
        endX: 10,
        endY: 0,
        lineWidth: 0.254
      });

      expect(res.executed).toBe(true);
      expect(res.readback.primitiveId).toBe("trk-created-1");
    });

    it("executes track modify and verifies readback", async () => {
      const modifiedTrack = {
        getState_PrimitiveId: () => "trk-1",
        getState_Net: () => "GND",
        getState_Layer: () => 1,
        getState_LineWidth: () => 0.5,
        getState_StartX: () => 10,
        getState_StartY: () => 10,
        getState_EndX: () => 30,
        getState_EndY: () => 10
      };
      const api = createMockApi([modifiedTrack, mockTrack2]);

      const res = await executePcbTrackViaMutation(() => api, {
        entity: "track",
        action: "modify",
        trackId: "trk-1",
        properties: { lineWidth: 0.5 }
      });

      expect(res.executed).toBe(true);
      expect((res.readback.track as any).lineWidth).toBe(0.5);
    });

    it("executes track delete and verifies removal on readback", async () => {
      // api returning only mockTrack2 (mockTrack1 deleted)
      const api = createMockApi([mockTrack2]);

      const res = await executePcbTrackViaMutation(() => api, {
        entity: "track",
        action: "delete",
        trackId: "trk-1"
      });

      expect(res.executed).toBe(true);
      expect(res.readback.deleted).toBe(true);
    });

    it("executes via create, modify and delete with readback", async () => {
      const createdVia = {
        getState_PrimitiveId: () => "via-created-1",
        getState_Net: () => "VCC",
        getState_X: () => 50,
        getState_Y: () => 50,
        getState_Diameter: () => 0.8,
        getState_HoleDiameter: () => 0.4
      };
      const api = createMockApi([], [createdVia]);

      const createRes = await executePcbTrackViaMutation(() => api, {
        entity: "via",
        action: "create",
        net: "VCC",
        x: 50,
        y: 50,
        diameter: 0.8,
        holeDiameter: 0.4
      });
      expect(createRes.executed).toBe(true);
      expect(createRes.readback.primitiveId).toBe("via-created-1");

      // Delete via
      const emptyApi = createMockApi([], []);
      const delRes = await executePcbTrackViaMutation(() => emptyApi, {
        entity: "via",
        action: "delete",
        viaId: "via-created-1"
      });
      expect(delRes.executed).toBe(true);
      expect(delRes.readback.deleted).toBe(true);
    });
  });
});
