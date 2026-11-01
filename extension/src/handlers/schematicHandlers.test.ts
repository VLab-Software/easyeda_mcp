import { describe, expect, it, vi } from "vitest";
import { createSchematicHandlers } from "./schematicHandlers.js";

describe("Extension Schematic Handlers - Native Nets and ERC", () => {
  const baseDocInfo = {
    uuid: "doc-sch-1",
    name: "MainSheet.SchDoc",
    documentType: 1, // schematic
    parentProjectUuid: "proj-123",
    projectName: "TestProject",
    tabId: "tab-sch-1",
    activePageId: "sheet-page-1",
    activePageIndex: 0
  };

  describe("getSchematicNets", () => {
    it("returns native nets when sch_Net.getAllNetsName is available", async () => {
      const mockApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => baseDocInfo)
        },
        sch_Net: {
          getAllNetsName: vi.fn(async () => ["GND", "VCC", "RESET", "+3V3"])
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [{ primitiveId: "c1" }])
        }
      };

      const handlers = createSchematicHandlers(() => mockApi);
      const result = (await handlers.getSchematicNets({ allPages: true })) as any;

      expect(result.available).toBe(true);
      expect(result.status).toBe("complete");
      expect(result.confidence).toBe("high");
      expect(result.totalNets).toBe(4);
      expect(result.nets).toEqual(["+3V3", "GND", "RESET", "VCC"]);
      expect(mockApi.sch_Net.getAllNetsName).toHaveBeenCalledWith(undefined, true);
    });

    it("supports pageId filtering for native nets", async () => {
      const mockApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => baseDocInfo)
        },
        sch_Net: {
          getAllNetsName: vi.fn(async () => ["GND", "PAGE2_SIG"])
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [])
        }
      };

      const handlers = createSchematicHandlers(() => mockApi);
      const result = (await handlers.getSchematicNets({ pageId: "page-2", allPages: false })) as any;

      expect(result.available).toBe(true);
      expect(result.nets).toEqual(["GND", "PAGE2_SIG"]);
      expect(mockApi.sch_Net.getAllNetsName).toHaveBeenCalledWith("page-2", false);
    });

    it("falls back to sch_Net.getAllNetName or getAllNets with object records", async () => {
      const mockApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => baseDocInfo)
        },
        sch_Net: {
          getAllNets: vi.fn(async () => [{ name: "NET_A" }, { netName: "NET_B" }, "NET_C"])
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [])
        }
      };

      const handlers = createSchematicHandlers(() => mockApi);
      const result = (await handlers.getSchematicNets({})) as any;

      expect(result.available).toBe(true);
      expect(result.nets).toEqual(["NET_A", "NET_B", "NET_C"]);
    });

    it("reports unavailable when sch_Net API is absent", async () => {
      const mockApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => baseDocInfo)
        }
      };

      const handlers = createSchematicHandlers(() => mockApi);
      const result = (await handlers.getSchematicNets({})) as any;

      expect(result.available).toBe(false);
      expect(result.status).toBe("unavailable");
      expect(result.reason).toContain("sch_Net.getAllNetsName");
      expect(result.totalNets).toBe(0);
      expect(result.nets).toEqual([]);
    });

    it("marks status as inconclusive when native nets return 0 but components exist", async () => {
      const mockApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => baseDocInfo)
        },
        sch_Net: {
          getAllNetsName: vi.fn(async () => [])
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [{ primitiveId: "U1" }, { primitiveId: "R1" }])
        }
      };

      const handlers = createSchematicHandlers(() => mockApi);
      const result = (await handlers.getSchematicNets({})) as any;

      expect(result.available).toBe(true);
      expect(result.status).toBe("inconclusive");
      expect(result.confidence).toBe("low");
      expect(result.warnings[0]).toContain("2 components exist");
    });

    it("rejects execution if active document is not schematic", async () => {
      const mockApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            ...baseDocInfo,
            documentType: 3 // PCB
          }))
        }
      };

      const handlers = createSchematicHandlers(() => mockApi);
      await expect(handlers.getSchematicNets({})).rejects.toThrow("active schematic document");
    });

    it("asserts expectedTarget match if specified", async () => {
      const mockApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => baseDocInfo)
        },
        sch_Net: {
          getAllNetsName: vi.fn(async () => ["GND"])
        }
      };

      const handlers = createSchematicHandlers(() => mockApi);
      await expect(
        handlers.getSchematicNets({
          expectedTarget: { documentId: "wrong-doc-uuid" }
        })
      ).rejects.toThrow("Active document");
    });
  });

  describe("runSchematicErc", () => {
    it("reports clean pass when sch_Drc.check returns no violations", async () => {
      const mockApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => baseDocInfo)
        },
        sch_Drc: {
          check: vi.fn(async () => [])
        }
      };

      const handlers = createSchematicHandlers(() => mockApi);
      const result = (await handlers.runSchematicErc({ strict: true })) as any;

      expect(result.available).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.violationsCount).toBe(0);
      expect(result.violations).toEqual([]);
      expect(mockApi.sch_Drc.check).toHaveBeenCalledWith(true, false, true);
    });

    it("normalizes array of ERC violations when issues are detected", async () => {
      const mockApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => baseDocInfo)
        },
        sch_Drc: {
          check: vi.fn(async () => [
            {
              rule: "floating_pin",
              message: "Pin U1.5 is floating without connection",
              level: "error",
              primitiveId: "prim-u1"
            },
            {
              rule: "power_net_conflict",
              message: "VCC and 3V3 driven together",
              level: "warning",
              pageId: "sheet-page-1"
            }
          ])
        }
      };

      const handlers = createSchematicHandlers(() => mockApi);
      const result = (await handlers.runSchematicErc({ strict: true })) as any;

      expect(result.available).toBe(true);
      expect(result.passed).toBe(false);
      expect(result.status).toBe("violations_found");
      expect(result.violationsCount).toBe(2);
      expect(result.violations[0]).toMatchObject({
        rule: "floating_pin",
        message: "Pin U1.5 is floating without connection",
        severity: "error",
        primitiveIds: ["prim-u1"]
      });
      expect(result.violations[1]).toMatchObject({
        rule: "power_net_conflict",
        severity: "warning",
        pageId: "sheet-page-1"
      });
    });

    it("handles { errors, warnings } object output from sch_Drc.check", async () => {
      const mockApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => baseDocInfo)
        },
        sch_Drc: {
          check: vi.fn(async () => ({
            passed: false,
            errors: [{ message: "Duplicate designator R1", code: "dup_des" }],
            warnings: ["Net VCC has single pin"]
          }))
        }
      };

      const handlers = createSchematicHandlers(() => mockApi);
      const result = (await handlers.runSchematicErc({})) as any;

      expect(result.passed).toBe(false);
      expect(result.errorsCount).toBe(1);
      expect(result.warningsCount).toBe(1);
      expect(result.violationsCount).toBe(2);
      expect(result.violations[0].rule).toBe("dup_des");
      expect(result.violations[1].message).toBe("Net VCC has single pin");
    });

    it("handles boolean false response from sch_Drc.check", async () => {
      const mockApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => baseDocInfo)
        },
        sch_Drc: {
          check: vi.fn(async () => false)
        }
      };

      const handlers = createSchematicHandlers(() => mockApi);
      const result = (await handlers.runSchematicErc({})) as any;

      expect(result.passed).toBe(false);
      expect(result.status).toBe("violations_found");
      expect(result.violationsCount).toBe(1);
    });

    it("reports unavailable when sch_Drc.check API is missing", async () => {
      const mockApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => baseDocInfo)
        }
      };

      const handlers = createSchematicHandlers(() => mockApi);
      const result = (await handlers.runSchematicErc({})) as any;

      expect(result.available).toBe(false);
      expect(result.status).toBe("unavailable");
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("sch_Drc.check");
    });

    it("rejects ERC if active document is not schematic", async () => {
      const mockApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            ...baseDocInfo,
            documentType: "pcb"
          }))
        }
      };

      const handlers = createSchematicHandlers(() => mockApi);
      await expect(handlers.runSchematicErc({})).rejects.toThrow("active schematic document");
    });
  });

  describe("findNet", () => {
    it("returns native schematic nets tagged with source", async () => {
      const mockApi = {
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => baseDocInfo)
        },
        sch_Net: {
          getAllNetsName: vi.fn(async () => ["GND", "VCC_3V3", "RESET"])
        },
        pcb_Net: {
          getAllNetsName: vi.fn(async () => ["GND", "VCC_5V"])
        }
      };

      const handlers = createSchematicHandlers(() => mockApi);
      const result = (await handlers.findNet({ query: "vcc" })) as any;

      expect(result.count).toBe(2);
      expect(result.nets).toEqual([
        {
          name: "VCC_3V3",
          source: "native_schematic",
          detail: "VCC_3V3"
        },
        {
          name: "VCC_5V",
          source: "native_pcb",
          detail: undefined,
          length: undefined
        }
      ]);
    });
  });
});
