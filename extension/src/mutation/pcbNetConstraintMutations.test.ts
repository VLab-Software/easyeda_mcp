import { beforeEach, describe, expect, it, vi } from "vitest";
import { extensionMutations } from "./mutationManager.js";
import {
  executePcbNetConstraintMutation,
  fetchPcbDifferentialPairs,
  fetchPcbLengthGroups,
  fetchPcbNetClasses,
  preparePcbNetConstraintMutation
} from "./pcbNetConstraintMutations.js";

describe("pcbNetConstraintMutations", () => {
  beforeEach(() => {
    extensionMutations.invalidateAll();
  });

  const pcbDocInfo = {
    uuid: "pcb-doc-1",
    documentType: 3,
    parentProjectUuid: "proj-1",
    name: "Board.PcbDoc"
  };

  const mockNetClass1 = {
    getState_Name: () => "POWER",
    getState_Nets: () => ["VCC", "GND"],
    getState_RoutingWidth: () => 0.5,
    getState_Clearance: () => 0.3,
    getState_ViaDiameter: () => 0.8,
    getState_ViaHoleDiameter: () => 0.4
  };

  const mockDiffPair1 = {
    getState_Name: () => "DIFF_USB",
    getState_PositiveNet: () => "USB_DP",
    getState_NegativeNet: () => "USB_DM",
    getState_TargetImpedance: () => 90,
    getState_TraceWidth: () => 0.15,
    getState_DifferentialGap: () => 0.15,
    getState_Tolerance: () => 0.15
  };

  const mockLengthGroup1 = {
    getState_Name: () => "BUS_DATA",
    getState_Nets: () => ["D0", "D1", "D2", "D3"],
    getState_Tolerance: () => 0.5,
    getState_TargetLength: () => 30.0
  };

  const mockTracks = [
    {
      getState_PrimitiveId: () => "trk-dp",
      getState_Net: () => "USB_DP",
      getState_StartX: () => 0,
      getState_StartY: () => 0,
      getState_EndX: () => 20,
      getState_EndY: () => 0
    },
    {
      getState_PrimitiveId: () => "trk-dm",
      getState_Net: () => "USB_DM",
      getState_StartX: () => 0,
      getState_StartY: () => 0.2,
      getState_EndX: () => 20.05,
      getState_EndY: () => 0.2
    },
    {
      getState_PrimitiveId: () => "trk-d0",
      getState_Net: () => "D0",
      getState_StartX: () => 0,
      getState_StartY: () => 10,
      getState_EndX: () => 29.8,
      getState_EndY: () => 10
    },
    {
      getState_PrimitiveId: () => "trk-d1",
      getState_Net: () => "D1",
      getState_StartX: () => 0,
      getState_StartY: () => 12,
      getState_EndX: () => 30.0,
      getState_EndY: () => 12
    },
    {
      getState_PrimitiveId: () => "trk-d2",
      getState_Net: () => "D2",
      getState_StartX: () => 0,
      getState_StartY: () => 14,
      getState_EndX: () => 29.9,
      getState_EndY: () => 14
    },
    {
      getState_PrimitiveId: () => "trk-d3",
      getState_Net: () => "D3",
      getState_StartX: () => 0,
      getState_StartY: () => 16,
      getState_EndX: () => 30.1,
      getState_EndY: () => 16
    }
  ];

  function createMockApi(overrides: Record<string, any> = {}) {
    return {
      dmt_SelectControl: {
        getCurrentDocumentInfo: vi.fn(async () => pcbDocInfo)
      },
      pcb_NetClass: {
        getAll: vi.fn(async () => [mockNetClass1]),
        create: vi.fn(async () => true),
        modify: vi.fn(async () => true),
        delete: vi.fn(async () => true)
      },
      pcb_DifferentialPair: {
        getAll: vi.fn(async () => [mockDiffPair1]),
        create: vi.fn(async () => true),
        modify: vi.fn(async () => true),
        delete: vi.fn(async () => true)
      },
      pcb_LengthGroup: {
        getAll: vi.fn(async () => [mockLengthGroup1]),
        create: vi.fn(async () => true),
        modify: vi.fn(async () => true),
        delete: vi.fn(async () => true)
      },
      pcb_PrimitiveTrack: {
        getAll: vi.fn(async () => mockTracks)
      },
      pcb_Net: {
        getAllNetsName: vi.fn(async () => ["VCC", "GND", "USB_DP", "USB_DM", "D0", "D1", "CLK_P", "CLK_N"])
      },
      ...overrides
    };
  }

  describe("fetchPcbNetClasses", () => {
    it("fetches net classes from native pcb_NetClass API", async () => {
      const api = createMockApi();
      const res = await fetchPcbNetClasses(api as any);

      expect(res.total).toBe(1);
      expect(res.classes[0].name).toBe("POWER");
      expect(res.classes[0].nets).toEqual(["VCC", "GND"]);
      expect(res.classes[0].routingWidth).toBe(0.5);
      expect(res.classes[0].clearance).toBe(0.3);
      expect(res.classes[0].source).toBe("native_api");
    });

    it("falls back to pcb_Drc.getNetRules when native pcb_NetClass is absent", async () => {
      const api = createMockApi({
        pcb_NetClass: undefined,
        pcb_Drc: {
          getNetRules: vi.fn(async () => [
            {
              name: "SIGNAL_FAST",
              nets: ["SPI_CLK", "SPI_MOSI"],
              trackWidth: 0.2,
              clearance: 0.15
            }
          ])
        }
      });

      const res = await fetchPcbNetClasses(api as any);
      expect(res.total).toBe(1);
      expect(res.classes[0].name).toBe("SIGNAL_FAST");
      expect(res.classes[0].source).toBe("drc_net_rules");
    });
  });

  describe("fetchPcbDifferentialPairs", () => {
    it("fetches differential pairs from native API with physical skew measurement", async () => {
      const api = createMockApi();
      const res = await fetchPcbDifferentialPairs(api as any);

      expect(res.total).toBe(1);
      expect(res.pairs[0].name).toBe("DIFF_USB");
      expect(res.pairs[0].positiveNet).toBe("USB_DP");
      expect(res.pairs[0].negativeNet).toBe("USB_DM");
      expect(res.pairs[0].positiveLengthMm).toBe(20);
      expect(res.pairs[0].negativeLengthMm).toBe(20.05);
      expect(res.pairs[0].skewMm).toBe(0.05);
      expect(res.pairs[0].matched).toBe(true);
      expect(res.pairs[0].source).toBe("native_api");
    });

    it("falls back to heuristic naming when native API returns empty", async () => {
      const api = createMockApi({
        pcb_DifferentialPair: undefined
      });

      const res = await fetchPcbDifferentialPairs(api as any);
      expect(res.total).toBeGreaterThan(0);
      const usb = res.pairs.find((p) => p.positiveNet === "USB_DP" && p.negativeNet === "USB_DM");
      expect(usb).toBeDefined();
      expect(usb?.source).toBe("inferred_naming");
      expect(usb?.skewMm).toBe(0.05);
      expect(usb?.matched).toBe(true);

      const clk = res.pairs.find((p) => p.positiveNet === "CLK_P" && p.negativeNet === "CLK_N");
      expect(clk).toBeDefined();
    });
  });

  describe("fetchPcbLengthGroups", () => {
    it("fetches equal length groups and verifies skew and tolerance compliance", async () => {
      const api = createMockApi();
      const res = await fetchPcbLengthGroups(api as any);

      expect(res.total).toBe(1);
      expect(res.groups[0].name).toBe("BUS_DATA");
      expect(res.groups[0].netCount).toBe(4);
      expect(res.groups[0].maxSkewMm).toBeLessThanOrEqual(0.5);
      expect(res.groups[0].compliant).toBe(true);
      expect(res.groups[0].members).toHaveLength(4);
    });
  });

  describe("preparePcbNetConstraintMutation", () => {
    it("prepares netClass create, modify and delete mutations", async () => {
      const api = createMockApi();

      // Create
      const createRes = await preparePcbNetConstraintMutation(() => api as any, {
        entity: "netClass",
        action: "create",
        name: "ANALOG",
        nets: ["AIN0", "AIN1"],
        clearance: 0.4
      });
      expect(createRes.mutationId).toBeDefined();
      expect(createRes.confirmation).toContain("CONFIRM pcb:createNetClass");

      // Modify
      const modifyRes = await preparePcbNetConstraintMutation(() => api as any, {
        entity: "netClass",
        action: "modify",
        name: "POWER",
        properties: { routingWidth: 0.8 }
      });
      expect(modifyRes.mutationId).toBeDefined();
      expect(modifyRes.confirmation).toContain("CONFIRM pcb:modifyNetClass");

      // Delete
      const deleteRes = await preparePcbNetConstraintMutation(() => api as any, {
        entity: "netClass",
        action: "delete",
        name: "POWER"
      });
      expect(deleteRes.mutationId).toBeDefined();
      expect(deleteRes.confirmation).toContain("CONFIRM pcb:deleteNetClass");
    });

    it("prepares differentialPair create, modify and delete mutations", async () => {
      const api = createMockApi();

      const createRes = await preparePcbNetConstraintMutation(() => api as any, {
        entity: "differentialPair",
        action: "create",
        name: "DIFF_PCIE",
        positiveNet: "PCIE_TXP",
        negativeNet: "PCIE_TXN",
        targetImpedance: 100,
        toleranceMm: 0.1
      });
      expect(createRes.mutationId).toBeDefined();
      expect(createRes.confirmation).toContain("CONFIRM pcb:createDifferentialPair");

      const modifyRes = await preparePcbNetConstraintMutation(() => api as any, {
        entity: "differentialPair",
        action: "modify",
        name: "DIFF_USB",
        properties: { toleranceMm: 0.05 }
      });
      expect(modifyRes.mutationId).toBeDefined();
      expect(modifyRes.confirmation).toContain("CONFIRM pcb:modifyDifferentialPair");
    });

    it("prepares lengthGroup create mutation", async () => {
      const api = createMockApi();

      const createRes = await preparePcbNetConstraintMutation(() => api as any, {
        entity: "lengthGroup",
        action: "create",
        name: "BUS_SDIO",
        nets: ["SD_CLK", "SD_CMD", "SD_D0", "SD_D1"],
        toleranceMm: 0.3
      });
      expect(createRes.mutationId).toBeDefined();
      expect(createRes.confirmation).toContain("CONFIRM pcb:createLengthGroup");
    });

    it("throws error for missing parameters", async () => {
      const api = createMockApi();

      await expect(
        preparePcbNetConstraintMutation(() => api as any, {
          entity: "netClass",
          action: "create",
          name: "INVALID"
          // missing nets
        })
      ).rejects.toThrow("requires at least one net");
    });
  });

  describe("executePcbNetConstraintMutation", () => {
    it("executes NetClass creation and verifies readback", async () => {
      const createdClass = {
        getState_Name: () => "ANALOG",
        getState_Nets: () => ["AIN0", "AIN1"],
        getState_RoutingWidth: () => 0.3,
        getState_Clearance: () => 0.4
      };
      const api = createMockApi({
        pcb_NetClass: {
          getAll: vi.fn(async () => [mockNetClass1, createdClass]),
          create: vi.fn(async () => true)
        }
      });

      const res = await executePcbNetConstraintMutation(() => api as any, {
        entity: "netClass",
        action: "create",
        name: "ANALOG",
        nets: ["AIN0", "AIN1"],
        routingWidth: 0.3,
        clearance: 0.4
      });

      expect(res.executed).toBe(true);
      expect(res.readback.name).toBe("ANALOG");
      expect(api.pcb_NetClass.create).toHaveBeenCalled();
    });

    it("throws api_unavailable when required native API is missing during execution", async () => {
      const api = createMockApi({
        pcb_DifferentialPair: undefined
      });

      await expect(
        executePcbNetConstraintMutation(() => api as any, {
          entity: "differentialPair",
          action: "create",
          name: "DIFF_PCIE",
          positiveNet: "TXP",
          negativeNet: "TXN"
        })
      ).rejects.toThrow("pcb_DifferentialPair.create is unavailable");
    });

    it("executes DifferentialPair creation and verifies readback", async () => {
      const createdPair = {
        getState_Name: () => "DIFF_PCIE",
        getState_PositiveNet: () => "PCIE_P",
        getState_NegativeNet: () => "PCIE_N",
        getState_TargetImpedance: () => 100,
        getState_Tolerance: () => 0.1
      };

      const api = createMockApi({
        pcb_DifferentialPair: {
          getAll: vi.fn(async () => [mockDiffPair1, createdPair]),
          create: vi.fn(async () => true)
        }
      });

      const res = await executePcbNetConstraintMutation(() => api as any, {
        entity: "differentialPair",
        action: "create",
        name: "DIFF_PCIE",
        positiveNet: "PCIE_P",
        negativeNet: "PCIE_N",
        targetImpedance: 100,
        toleranceMm: 0.1
      });

      expect(res.executed).toBe(true);
      expect(res.readback.name).toBe("DIFF_PCIE");
      expect(api.pcb_DifferentialPair.create).toHaveBeenCalled();
    });
  });
});
