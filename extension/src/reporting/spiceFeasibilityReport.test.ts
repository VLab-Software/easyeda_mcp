import { describe, expect, it, vi } from "vitest";
import { classifyComponentForSpice, evaluateSpiceFeasibility, generateSpiceNetlist } from "./spiceFeasibilityReport.js";

describe("spiceFeasibilityReport", () => {
  describe("classifyComponentForSpice", () => {
    it("classifies passive resistors, capacitors and inductors as intrinsic primitives", () => {
      const res = classifyComponentForSpice({ designator: "R1", value: "10k" }, [{ net: "VCC" }, { net: "NET1" }]);
      expect(res.spiceCategory).toBe("primitive_r");
      expect(res.hasModel).toBe(true);
      expect(res.modelSource).toBe("intrinsic");
      expect(res.parameters.value).toBe("10k");

      const cap = classifyComponentForSpice({ designator: "C2", value: "100n" }, [{ net: "NET1" }, { net: "GND" }]);
      expect(cap.spiceCategory).toBe("primitive_c");
      expect(cap.hasModel).toBe(true);

      const ind = classifyComponentForSpice({ designator: "L1", value: "22u" }, [{ net: "VIN" }, { net: "SW" }]);
      expect(ind.spiceCategory).toBe("primitive_l");
      expect(ind.hasModel).toBe(true);
    });

    it("classifies diodes, transistors and voltage sources", () => {
      const diode = classifyComponentForSpice({ designator: "D1", value: "1N4148" }, [{ net: "IN" }, { net: "OUT" }]);
      expect(diode.spiceCategory).toBe("primitive_diode");
      expect(diode.hasModel).toBe(true);

      const bjt = classifyComponentForSpice({ designator: "Q1", value: "2N2222" }, [
        { net: "C" },
        { net: "B" },
        { net: "E" }
      ]);
      expect(bjt.spiceCategory).toBe("primitive_transistor");
      expect(bjt.hasModel).toBe(true);

      const vsrc = classifyComponentForSpice({ designator: "V1", value: "5V" }, [{ net: "VCC" }, { net: "GND" }]);
      expect(vsrc.spiceCategory).toBe("source_voltage");
      expect(vsrc.hasModel).toBe(true);
      expect(vsrc.parameters.dc).toBe("5V");
    });

    it("flags ICs without models as needs_model and connectors as non_electrical", () => {
      const ic = classifyComponentForSpice({ designator: "U1", title: "STM32F103" }, []);
      expect(ic.spiceCategory).toBe("subcircuit");
      expect(ic.hasModel).toBe(false);
      expect(ic.modelSource).toBe("missing");
      expect(ic.warnings.length).toBeGreaterThan(0);

      const conn = classifyComponentForSpice({ designator: "J1", title: "Header_1x4" }, []);
      expect(conn.spiceCategory).toBe("non_electrical");
      expect(conn.hasModel).toBe(false);
      expect(conn.modelSource).toBe("none");
    });
  });

  describe("evaluateSpiceFeasibility", () => {
    it("reports simulation_ready for a complete circuit with passives, source and GND", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: () => ({ title: "RC_Filter.Schematic", documentType: 1 })
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [
            { primitiveId: "p1", designator: "V1", value: "5V" },
            { primitiveId: "p2", designator: "R1", value: "1k" },
            { primitiveId: "p3", designator: "C1", value: "100n" }
          ]),
          getAllPinsByPrimitiveId: vi.fn(async (id: string) => {
            if (id === "p1") return [{ net: "VIN" }, { net: "GND" }];
            if (id === "p2") return [{ net: "VIN" }, { net: "VOUT" }];
            return [{ net: "VOUT" }, { net: "GND" }];
          })
        },
        sch_Net: {
          getAllNetsName: vi.fn(async () => ["VIN", "VOUT", "GND"])
        }
      });

      const report = await evaluateSpiceFeasibility(api as any);
      expect(report.feasibilityScorePercent).toBe(100);
      expect(report.isSimulatable).toBe(true);
      expect(report.verdict).toBe("simulation_ready");
      expect(report.groundReference.detected).toBe(true);
      expect(report.groundReference.netName).toBe("GND");
      expect(report.stimulusSources.hasStimulus).toBe(true);
      expect(report.stimulusSources.count).toBe(1);
      expect(report.platformLimitations.length).toBeGreaterThan(0);
    });

    it("penalizes score and warns when ground reference is missing", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: () => ({ title: "NoGround.Schematic", documentType: 1 })
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [
            { primitiveId: "p1", designator: "V1", value: "5V" },
            { primitiveId: "p2", designator: "R1", value: "1k" }
          ]),
          getAllPinsByPrimitiveId: vi.fn(async (id: string) => {
            if (id === "p1") return [{ net: "NET1" }, { net: "NET2" }];
            return [{ net: "NET1" }, { net: "NET2" }];
          })
        },
        sch_Net: {
          getAllNetsName: vi.fn(async () => ["NET1", "NET2"])
        }
      });

      const report = await evaluateSpiceFeasibility(api as any);
      expect(report.groundReference.detected).toBe(false);
      expect(report.feasibilityScorePercent).toBeLessThan(80);
      expect(report.recommendations.some((r) => r.includes("CRITICAL: Add a ground reference"))).toBe(true);
    });
  });

  describe("generateSpiceNetlist", () => {
    it("generates valid SPICE netlist syntax with .tran analysis and ground mapped to node 0", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: () => ({ title: "VoltageDivider.Schematic" })
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [
            { primitiveId: "c1", designator: "V1", value: "12V" },
            { primitiveId: "c2", designator: "R1", value: "10k" },
            { primitiveId: "c3", designator: "R2", value: "2.2k" },
            { primitiveId: "c4", designator: "D1", value: "1N4148" }
          ]),
          getAllPinsByPrimitiveId: vi.fn(async (id: string) => {
            if (id === "c1") return [{ net: "VCC" }, { net: "GND" }];
            if (id === "c2") return [{ net: "VCC" }, { net: "MID" }];
            if (id === "c3") return [{ net: "MID" }, { net: "GND" }];
            return [{ net: "MID" }, { net: "GND" }];
          })
        }
      });

      const res = await generateSpiceNetlist(api as any, undefined, {
        analysisType: "tran",
        analysisParams: "10u 5ms",
        groundNet: "GND"
      });

      expect(res.analysisType).toBe("tran");
      expect(res.directive).toBe(".tran 10u 5ms");
      expect(res.elementsCount).toBe(4);
      expect(res.nodes).toContain("0");
      expect(res.netlist).toContain("V1 VCC 0 DC 12V");
      expect(res.netlist).toContain("R1 VCC MID 10k");
      expect(res.netlist).toContain("R2 MID 0 2.2k");
      expect(res.netlist).toContain("D1 MID 0 D_1N4148");
      expect(res.netlist).toContain(".model D_GENERIC");
      expect(res.netlist).toContain(".end");
      expect(res.validation).toMatchObject({ valid: true });
    });
  });
});
