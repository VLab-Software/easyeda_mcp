import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  areFootprintsCompatible,
  compareSchematicPcb,
  normalizeFootprintName,
  prepareSchematicPcbSyncMutation
} from "./schematicPcbSyncMutations.js";
import { extensionMutations } from "./mutationManager.js";
import { createActionHandlers } from "../handlers/actionHandlers.js";
import type { EasyEdaApi } from "../types.js";

describe("schematicPcbSyncMutations", () => {
  beforeEach(() => {
    extensionMutations.invalidateAll();
  });

  describe("footprint normalization and compatibility", () => {
    it("normalizes footprint names by stripping component prefixes and non-alphanumerics", () => {
      expect(normalizeFootprintName("R_0603")).toBe("0603");
      expect(normalizeFootprintName("CAP-0805")).toBe("0805");
      expect(normalizeFootprintName("SOIC-8_150mil")).toBe("soic8150mil");
    });

    it("evaluates compatibility between schematic and PCB footprints", () => {
      expect(areFootprintsCompatible("R_0603", "0603")).toBe(true);
      expect(areFootprintsCompatible("SOIC-8_150MIL", "SOIC-8")).toBe(true);
      expect(areFootprintsCompatible("0603", "0805")).toBe(false);
      expect(areFootprintsCompatible("SOT-23", "SOIC-8")).toBe(false);
      expect(areFootprintsCompatible(undefined, "0603")).toBe(true);
    });
  });

  describe("compareSchematicPcb", () => {
    it("reports in_sync when schematic and PCB match completely", async () => {
      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "schematic",
            uuid: "doc-sch-1",
            title: "Main.json"
          }))
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [
            { primitiveId: "sch-r1", designator: "R1", value: "10k", footprint: "0603" },
            { primitiveId: "sch-c1", designator: "C1", value: "100nF", footprint: "0402" }
          ])
        },
        sch_Net: {
          getAllNetsName: vi.fn(async () => ["GND", "VCC", "SIG"])
        },
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => [
            { primitiveId: "pcb-r1", designator: "R1", footprint: "R_0603", layer: 1 },
            { primitiveId: "pcb-c1", designator: "C1", footprint: "0402", layer: 1 }
          ])
        },
        pcb_Net: {
          getAllNetsName: vi.fn(async () => ["GND", "VCC", "SIG"])
        }
      };

      const report = await compareSchematicPcb(() => mockApi);
      expect(report.syncStatus).toBe("in_sync");
      expect(report.syncScore).toBe(100);
      expect(report.summary.totalDiscrepancies).toBe(0);
      expect(report.summary.matchedComponentCount).toBe(2);
      expect(report.summary.matchedNetCount).toBe(3);
      expect(report.components).toHaveLength(2);
      expect(report.components.every((c) => c.status === "matched")).toBe(true);
    });

    it("detects unplaced components and unrouted nets", async () => {
      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "schematic",
            uuid: "doc-sch-1",
            title: "Main.json"
          }))
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [
            { primitiveId: "sch-r1", designator: "R1", value: "10k", footprint: "0603" },
            { primitiveId: "sch-r2", designator: "R2", value: "4.7k", footprint: "0603" }
          ])
        },
        sch_Net: {
          getAllNetsName: vi.fn(async () => ["GND", "NET_CLK"])
        },
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => [{ primitiveId: "pcb-r1", designator: "R1", footprint: "0603", layer: 1 }])
        },
        pcb_Net: {
          getAllNetsName: vi.fn(async () => ["GND"])
        }
      };

      const report = await compareSchematicPcb(() => mockApi);
      expect(report.summary.unplacedComponentCount).toBe(1);
      expect(report.summary.unroutedSchematicNetCount).toBe(1);
      expect(report.summary.matchedComponentCount).toBe(1);
      expect(report.summary.matchedNetCount).toBe(1);

      const r2 = report.components.find((c) => c.designator === "R2");
      expect(r2?.status).toBe("schematic_only");
      expect(r2?.discrepancies[0]).toContain("not placed on the PCB");

      const clkNet = report.nets.find((n) => n.name === "NET_CLK");
      expect(clkNet?.status).toBe("schematic_only");
    });

    it("detects untracked PCB components and footprint mismatches", async () => {
      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "pcb",
            uuid: "doc-pcb-1",
            title: "Board.pcb"
          }))
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [{ primitiveId: "sch-u1", designator: "U1", footprint: "SOIC-8" }])
        },
        sch_Net: {
          getAllNetsName: vi.fn(async () => ["VCC"])
        },
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => [
            { primitiveId: "pcb-u1", designator: "U1", footprint: "QFN-32", layer: 1 },
            { primitiveId: "pcb-tp1", designator: "TP1", footprint: "TEST_POINT", layer: 1 }
          ])
        },
        pcb_Net: {
          getAllNetsName: vi.fn(async () => ["VCC", "5V_EXT"])
        }
      };

      const report = await compareSchematicPcb(() => mockApi);
      expect(report.summary.mismatchedComponentCount).toBe(1);
      expect(report.summary.untrackedComponentCount).toBe(1);
      expect(report.summary.extraPcbNetCount).toBe(1);

      const u1 = report.components.find((c) => c.designator === "U1");
      expect(u1?.status).toBe("footprint_mismatch");
      expect(u1?.discrepancies[0]).toContain("Footprint mismatch");

      const tp1 = report.components.find((c) => c.designator === "TP1");
      expect(tp1?.status).toBe("pcb_only");
    });

    it("reports no_pcb when no PCB components or nets exist", async () => {
      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "schematic",
            uuid: "doc-sch-1",
            title: "Main.json"
          }))
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [{ primitiveId: "sch-r1", designator: "R1", value: "10k", footprint: "0603" }])
        },
        sch_Net: {
          getAllNetsName: vi.fn(async () => ["GND"])
        },
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => [])
        },
        pcb_Net: {
          getAllNetsName: vi.fn(async () => [])
        }
      };

      const report = await compareSchematicPcb(() => mockApi);
      expect(report.syncStatus).toBe("no_pcb");
      expect(report.syncScore).toBe(0);
      expect(report.recommendations[0]).toContain("createPcbFromSchematic");
    });
  });

  describe("prepareSchematicPcbSyncMutation & confirmed execution", () => {
    it("prepares and executes syncToPcb mutation", async () => {
      let importedChanges = false;
      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "schematic",
            uuid: "doc-sch-1",
            title: "Main.json"
          }))
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [{ primitiveId: "sch-r1", designator: "R1", value: "10k", footprint: "0603" }])
        },
        sch_Net: {
          getAllNetsName: vi.fn(async () => ["GND", "VCC"])
        },
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () =>
            importedChanges ? [{ primitiveId: "pcb-r1", designator: "R1", footprint: "0603" }] : []
          )
        },
        pcb_Net: {
          getAllNetsName: vi.fn(async () => (importedChanges ? ["GND", "VCC"] : []))
        },
        pcb_Document: {
          importChanges: vi.fn(async () => {
            importedChanges = true;
            return { success: true };
          })
        }
      };

      const prep = await prepareSchematicPcbSyncMutation(() => mockApi, {
        action: "syncToPcb"
      });

      expect(typeof prep.mutationId).toBe("string");
      expect(prep.confirmation).toContain("CONFIRM sync:syncToPcb");
      expect((prep.preview as any).impact).toContain("Synchronizes schematic to PCB");

      const actionHandlers = createActionHandlers(() => mockApi, {} as any, extensionMutations);
      const res = (await actionHandlers.confirmedAction({
        action: "mutation",
        params: { mutationId: prep.mutationId },
        confirmation: prep.confirmation
      })) as any;

      expect(res.status).toBe("applied");
      expect(res.after.action).toBe("syncToPcb");
      expect(res.after.verified).toBe(true);
      expect(mockApi.pcb_Document.importChanges).toHaveBeenCalled();
    });

    it("prepares and executes createPcbFromSchematic mutation", async () => {
      let boardCreated = false;
      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "schematic",
            uuid: "doc-sch-1",
            title: "Main.json"
          }))
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [{ primitiveId: "sch-u1", designator: "U1", value: "STM32", footprint: "LQFP-48" }])
        },
        sch_Net: {
          getAllNetsName: vi.fn(async () => ["GND", "3V3"])
        },
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () =>
            boardCreated ? [{ primitiveId: "pcb-u1", designator: "U1", footprint: "LQFP-48" }] : []
          )
        },
        pcb_Net: {
          getAllNetsName: vi.fn(async () => (boardCreated ? ["GND", "3V3"] : []))
        },
        pcb_Document: {
          create: vi.fn(async (params) => {
            boardCreated = true;
            return { uuid: "new-board-uuid", ...params };
          })
        }
      };

      const prep = await prepareSchematicPcbSyncMutation(() => mockApi, {
        action: "createPcbFromSchematic",
        boardName: "SensorNode_PCB",
        layerCount: 4,
        width: 120,
        height: 80
      });

      expect(typeof prep.mutationId).toBe("string");
      expect(prep.confirmation).toContain("CONFIRM sync:createPcbFromSchematic");
      expect((prep.preview as any).impact).toContain("SensorNode_PCB");
      expect((prep.preview as any).impact).toContain("4 copper layers");

      const actionHandlers = createActionHandlers(() => mockApi, {} as any, extensionMutations);
      const res = (await actionHandlers.confirmedAction({
        action: "mutation",
        params: { mutationId: prep.mutationId },
        confirmation: prep.confirmation
      })) as any;

      expect(res.status).toBe("applied");
      expect(res.after.action).toBe("createPcbFromSchematic");
      expect(res.after.boardName).toBe("SensorNode_PCB");
      expect(res.after.layerCount).toBe(4);
      expect(res.after.verified).toBe(true);
      expect(mockApi.pcb_Document.create).toHaveBeenCalledWith({
        name: "SensorNode_PCB",
        layerCount: 4,
        width: 120,
        height: 80
      });
    });

    it("prepares and executes syncToSchematic back-annotation mutation", async () => {
      let backAnnotated = false;
      const mockApi: EasyEdaApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            documentType: "pcb",
            uuid: "doc-pcb-1",
            title: "Board.pcb"
          }))
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [{ primitiveId: "sch-r1", designator: "R1" }])
        },
        sch_Net: {
          getAllNetsName: vi.fn(async () => ["GND"])
        },
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => [{ primitiveId: "pcb-r1", designator: "R1" }])
        },
        pcb_Net: {
          getAllNetsName: vi.fn(async () => ["GND"])
        },
        pcb_Document: {
          updateSchematic: vi.fn(async () => {
            backAnnotated = true;
            return { success: true };
          })
        }
      };

      const prep = await prepareSchematicPcbSyncMutation(() => mockApi, {
        action: "syncToSchematic"
      });

      expect(typeof prep.mutationId).toBe("string");
      expect(prep.confirmation).toContain("CONFIRM sync:syncToSchematic");

      const actionHandlers = createActionHandlers(() => mockApi, {} as any, extensionMutations);
      const res = (await actionHandlers.confirmedAction({
        action: "mutation",
        params: { mutationId: prep.mutationId },
        confirmation: prep.confirmation
      })) as any;

      expect(res.status).toBe("applied");
      expect(res.after.action).toBe("syncToSchematic");
      expect(mockApi.pcb_Document.updateSchematic).toHaveBeenCalled();
      expect(backAnnotated).toBe(true);
    });
  });
});
