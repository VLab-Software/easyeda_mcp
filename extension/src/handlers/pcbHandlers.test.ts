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
      },
      pcb_Drc: {
        check: vi.fn(async (): Promise<any> => []),
        getDrcErrors: vi.fn(async (): Promise<any> => []),
        getCurrentRuleConfiguration: vi.fn(async (): Promise<any> => ({ name: "DefaultRules" }))
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

  describe("runDrc", () => {
    it("executes DRC returning zero violations and passed=true", async () => {
      const mockApi = makeMockApi();
      const handlers = createPcbHandlers(() => mockApi);

      const result = (await handlers.runDrc({ strict: true })) as any;

      expect(result.passed).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.violationsCount).toBe(0);
      expect(result.errorsCount).toBe(0);
      expect(result.warningsCount).toBe(0);
      expect(result.violations).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.executionId).toMatch(/^drc_\d+_/);
      expect(result.executedAt).toBeDefined();
      expect(result.target.documentId).toBe("doc-pcb-123");
      expect(result.editorComparison.matched).toBe(true);
      expect(result.editorComparison.ruleConfigName).toBe("DefaultRules");
    });

    it("executes DRC with array of violation records and normalizes evidence", async () => {
      const mockApi = makeMockApi();
      mockApi.pcb_Drc.check = vi.fn(async () => [
        {
          id: "err-clearance-1",
          rule: "TrackClearance",
          desc: "Clearance error between Net GND and Net VCC: actual 0.12mm, required 0.20mm at (10, 20)",
          severity: "error",
          primitiveIds: ["trk-1", "pad-1"],
          layer: "TopLayer",
          actual: 0.12,
          expected: 0.2
        },
        {
          id: "err-width-1",
          rule: "TrackWidth",
          desc: "Track width is 0.15mm, required minimum is 0.25mm",
          severity: "warning",
          primitiveIds: ["trk-2"],
          layer: "BottomLayer"
        }
      ]);
      mockApi.pcb_Drc.getDrcErrors = vi.fn(async () => [{ id: "err-clearance-1" }]);

      const handlers = createPcbHandlers(() => mockApi);
      const result = (await handlers.runDrc({ strict: true })) as any;

      expect(result.passed).toBe(false);
      expect(result.status).toBe("violations_found");
      expect(result.violationsCount).toBe(2);
      expect(result.errorsCount).toBe(1);
      expect(result.warningsCount).toBe(1);
      expect(result.violations).toHaveLength(2);

      const clearance = result.violations.find((v: any) => v.id === "err-clearance-1");
      expect(clearance).toBeDefined();
      expect(clearance.category).toBe("Clearance");
      expect(clearance.severity).toBe("error");
      expect(clearance.nets).toContain("GND");
      expect(clearance.nets).toContain("VCC");
      expect(clearance.evidence?.difference).toBe(-0.08);

      expect(result.summary.bySeverity).toEqual({ error: 1, warning: 1 });
      expect(result.summary.byCategory).toEqual({ Clearance: 1, Geometry: 1 });
      expect(result.editorComparison.matched).toBe(true);
    });

    it("executes DRC with object containing errors, warnings, and passed flag", async () => {
      const mockApi = makeMockApi();
      mockApi.pcb_Drc.check = vi.fn(async () => ({
        passed: false,
        errors: [
          {
            rule: "ShortCircuit",
            message: "Short circuit between Net GND and Net +5V",
            severity: "error"
          }
        ],
        warnings: [
          {
            rule: "SilkClearance",
            message: "Silkscreen over pad",
            severity: "warning"
          }
        ]
      }));
      mockApi.pcb_Drc.getDrcErrors = vi.fn(async () => ["short"]);

      const handlers = createPcbHandlers(() => mockApi);
      const result = (await handlers.runDrc({})) as any;

      expect(result.passed).toBe(false);
      expect(result.violationsCount).toBe(2);
      expect(result.errorsCount).toBe(1);
      expect(result.warningsCount).toBe(1);
      expect(result.summary.byCategory.ShortCircuit).toBe(1);
      expect(result.summary.byCategory.Silkscreen).toBe(1);
    });

    it("handles boolean false result with fallback error violation", async () => {
      const mockApi = makeMockApi();
      mockApi.pcb_Drc.check = vi.fn(async () => false);

      const handlers = createPcbHandlers(() => mockApi);
      const result = (await handlers.runDrc({})) as any;

      expect(result.passed).toBe(false);
      expect(result.errorsCount).toBe(1);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].message).toContain("Native PCB DRC check failed");
    });

    it("filters violations by severity and rule code", async () => {
      const mockApi = makeMockApi();
      mockApi.pcb_Drc.check = vi.fn(async () => [
        { rule: "Clearance", severity: "error", desc: "Clearance 1" },
        { rule: "Clearance", severity: "warning", desc: "Clearance 2" },
        { rule: "ShortCircuit", severity: "error", desc: "Short 1" }
      ]);

      const handlers = createPcbHandlers(() => mockApi);

      const warningResult = (await handlers.runDrc({ severity: "warning" })) as any;
      expect(warningResult.violationsReturned).toBe(1);
      expect(warningResult.violations[0].severity).toBe("warning");

      const shortResult = (await handlers.runDrc({ rule: "ShortCircuit" })) as any;
      expect(shortResult.violationsReturned).toBe(1);
      expect(shortResult.violations[0].rule).toBe("ShortCircuit");
    });

    it("truncates violations according to limit", async () => {
      const mockApi = makeMockApi();
      mockApi.pcb_Drc.check = vi.fn(async () => [
        { rule: "Clearance", desc: "Err 1" },
        { rule: "Clearance", desc: "Err 2" },
        { rule: "Clearance", desc: "Err 3" }
      ]);

      const handlers = createPcbHandlers(() => mockApi);
      const result = (await handlers.runDrc({ limit: 2 })) as any;

      expect(result.violationsCount).toBe(3);
      expect(result.violationsReturned).toBe(2);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("truncated to 2 items");
    });

    it("reports discrepancy when editor error count differs from check errors", async () => {
      const mockApi = makeMockApi();
      mockApi.pcb_Drc.check = vi.fn(async () => [
        { rule: "Clearance", desc: "Err 1" },
        { rule: "Clearance", desc: "Err 2" }
      ]);
      mockApi.pcb_Drc.getDrcErrors = vi.fn(async () => [{ id: "only-one-error" }]);

      const handlers = createPcbHandlers(() => mockApi);
      const result = (await handlers.runDrc({})) as any;

      expect(result.editorComparison.matched).toBe(false);
      expect(result.editorComparison.editorErrorCount).toBe(1);
      expect(result.editorComparison.checkErrorCount).toBe(2);
      expect(result.editorComparison.note).toContain("Discrepancy");
    });

    it("rejects when active document is not a PCB document", async () => {
      const mockApi = makeMockApi({
        uuid: "doc-sch-1",
        documentType: 1 // Schematic
      });
      const handlers = createPcbHandlers(() => mockApi);

      await expect(handlers.runDrc({})).rejects.toThrow("Open a PCB document");
    });

    it("asserts expectedTarget match", async () => {
      const mockApi = makeMockApi();
      const handlers = createPcbHandlers(() => mockApi);

      await expect(
        handlers.runDrc({
          expectedTarget: { documentId: "wrong-uuid" }
        })
      ).rejects.toThrow("Active document");
    });
  });
});
