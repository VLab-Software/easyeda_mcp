import { describe, expect, it } from "vitest";
import {
  classifyDrcRule,
  extractViolationCoordinates,
  extractViolationEvidence,
  extractViolationNets,
  extractViolationPrimitiveIds,
  filterAndLimitViolations,
  normalizeDrcViolation,
  summarizeDrcViolations
} from "./pcbDrcNormalizer.js";

describe("pcbDrcNormalizer", () => {
  describe("classifyDrcRule", () => {
    it("classifies clearance violations", () => {
      expect(classifyDrcRule("TrackClearance", "Track to pad clearance")).toEqual({
        rule: "TrackClearance",
        category: "Clearance"
      });
      expect(classifyDrcRule(undefined, "Clearance violation between nets GND and VCC")).toEqual({
        rule: "Clearance",
        category: "Clearance"
      });
      expect(classifyDrcRule(undefined, "Hole to track clearance distance error")).toEqual({
        rule: "HoleClearance",
        category: "Hole"
      });
      expect(classifyDrcRule(undefined, "Silk to copper clearance violation")).toEqual({
        rule: "SilkClearance",
        category: "Silkscreen"
      });
    });

    it("classifies short circuit violations", () => {
      expect(classifyDrcRule("ShortCircuit", "Short between Track and Pad")).toEqual({
        rule: "ShortCircuit",
        category: "ShortCircuit"
      });
      expect(classifyDrcRule(undefined, "Curto-circuito entre trilha e plano")).toEqual({
        rule: "ShortCircuit",
        category: "ShortCircuit"
      });
    });

    it("classifies unrouted nets", () => {
      expect(classifyDrcRule(undefined, "Unrouted net connection on Net CLK")).toEqual({
        rule: "UnroutedNet",
        category: "Unrouted"
      });
      expect(classifyDrcRule(undefined, "Ratsnest airwire incomplete for Net RESET")).toEqual({
        rule: "UnroutedNet",
        category: "Unrouted"
      });
    });

    it("classifies track width and hole size violations", () => {
      expect(classifyDrcRule(undefined, "Track width is 0.15mm, required minimum is 0.25mm")).toEqual({
        rule: "TrackWidth",
        category: "Geometry"
      });
      expect(classifyDrcRule(undefined, "Via hole diameter 0.2mm is too small")).toEqual({
        rule: "HoleSize",
        category: "Hole"
      });
      expect(classifyDrcRule("ViaDimension", "Via outer diameter violation")).toEqual({
        rule: "ViaDimension",
        category: "Hole"
      });
    });

    it("classifies keepout and component violations", () => {
      expect(classifyDrcRule(undefined, "Keepout violation on top copper")).toEqual({
        rule: "KeepoutViolation",
        category: "Keepout"
      });
      expect(classifyDrcRule(undefined, "Component courtyard overlap between U1 and U2")).toEqual({
        rule: "ComponentClearance",
        category: "Component"
      });
    });

    it("falls back to General for unspecified messages", () => {
      expect(classifyDrcRule(undefined, "Unspecified PCB anomaly")).toEqual({
        rule: "General",
        category: "General"
      });
    });
  });

  describe("extractViolationCoordinates", () => {
    it("extracts from direct record fields", () => {
      expect(extractViolationCoordinates({ x: 100, y: 200, x2: 150, y2: 250 }, "")).toEqual({
        x: 100,
        y: 200,
        x2: 150,
        y2: 250
      });
      expect(extractViolationCoordinates({ coordX: 50, coordY: 75 }, "")).toEqual({
        x: 50,
        y: 75
      });
    });

    it("extracts from message pattern (x, y)", () => {
      expect(extractViolationCoordinates({}, "Violation at (12.34, 56.78) on TopLayer")).toEqual({
        x: 12.34,
        y: 56.78
      });
    });

    it("returns undefined when no coordinates present", () => {
      expect(extractViolationCoordinates({}, "General error without coords")).toBeUndefined();
    });
  });

  describe("extractViolationNets", () => {
    it("extracts nets from arrays and single properties", () => {
      expect(extractViolationNets({ nets: ["GND", "VCC"] }, "")).toEqual(["GND", "VCC"]);
      expect(extractViolationNets({ net: "RESET" }, "")).toEqual(["RESET"]);
    });

    it("extracts nets mentioned in message string", () => {
      expect(extractViolationNets({}, "Clearance between Net GND and Net +3V3 at (10, 20)")).toEqual(["GND", "+3V3"]);
    });
  });

  describe("extractViolationPrimitiveIds", () => {
    it("extracts primitive IDs from record arrays and single properties", () => {
      expect(extractViolationPrimitiveIds({ primitiveIds: ["trk-1", "pad-2"] }, "")).toEqual(["trk-1", "pad-2"]);
      expect(extractViolationPrimitiveIds({ primitiveId: "via-99" }, "")).toEqual(["via-99"]);
    });

    it("extracts bracketed IDs from message", () => {
      expect(extractViolationPrimitiveIds({}, "Collision between [track-101] and [pad-202]")).toEqual([
        "track-101",
        "pad-202"
      ]);
    });
  });

  describe("extractViolationEvidence", () => {
    it("extracts numeric evidence with difference calculation", () => {
      const evidence = extractViolationEvidence({ actual: 0.12, expected: 0.2 }, "");
      expect(evidence).toBeDefined();
      expect(evidence?.actual).toBe(0.12);
      expect(evidence?.expected).toBe(0.2);
      expect(evidence?.difference).toBe(-0.08);
      expect(evidence?.description).toContain("deviates from expected rule");
    });

    it("parses actual and required from message string", () => {
      const evidence = extractViolationEvidence({}, "Clearance error: actual 0.15mm, required 0.25mm");
      expect(evidence).toBeDefined();
      expect(evidence?.actual).toBe(0.15);
      expect(evidence?.expected).toBe(0.25);
      expect(evidence?.difference).toBe(-0.1);
    });

    it("returns undefined when no evidence fields present", () => {
      expect(extractViolationEvidence({}, "Plain error message")).toBeUndefined();
    });
  });

  describe("normalizeDrcViolation", () => {
    it("normalizes string violation", () => {
      const violation = normalizeDrcViolation(
        "Clearance violation between Net GND and Net VCC: actual 0.12mm, required 0.20mm at (15.5, 20.0)",
        0
      );
      expect(violation.id).toBe("violation-1");
      expect(violation.rule).toBe("Clearance");
      expect(violation.category).toBe("Clearance");
      expect(violation.severity).toBe("error");
      expect(violation.nets).toContain("GND");
      expect(violation.nets).toContain("VCC");
      expect(violation.coordinates).toEqual({ x: 15.5, y: 20 });
      expect(violation.evidence?.difference).toBe(-0.08);
      expect(violation.raw).toBe(
        "Clearance violation between Net GND and Net VCC: actual 0.12mm, required 0.20mm at (15.5, 20.0)"
      );
    });

    it("normalizes rich record violation", () => {
      const raw = {
        id: "drc-err-42",
        rule: "TrackWidth",
        desc: "Track [trk-5] width 0.15mm is less than min 0.25mm on TopLayer",
        level: "warning",
        primitiveIds: ["trk-5"],
        layer: "TopLayer",
        net: "SIG_A",
        x: 100,
        y: 200,
        actual: 0.15,
        required: 0.25
      };
      const violation = normalizeDrcViolation(raw, 5);

      expect(violation.id).toBe("drc-err-42");
      expect(violation.rule).toBe("TrackWidth");
      expect(violation.category).toBe("Geometry");
      expect(violation.severity).toBe("warning");
      expect(violation.primitiveIds).toEqual(["trk-5"]);
      expect(violation.layer).toBe("TopLayer");
      expect(violation.nets).toEqual(["SIG_A"]);
      expect(violation.coordinates).toEqual({ x: 100, y: 200 });
      expect(violation.evidence?.difference).toBe(-0.1);
    });
  });

  describe("summarizeDrcViolations", () => {
    it("summarizes by rule, category, severity, and layer", () => {
      const violations = [
        normalizeDrcViolation({ rule: "Clearance", severity: "error", layer: "Top" }, 0),
        normalizeDrcViolation({ rule: "Clearance", severity: "error", layer: "Top" }, 1),
        normalizeDrcViolation({ rule: "TrackWidth", severity: "warning", layer: "Bottom" }, 2),
        normalizeDrcViolation({ rule: "ShortCircuit", severity: "error", layer: "Top" }, 3)
      ];

      const summary = summarizeDrcViolations(violations);
      expect(summary.totalViolations).toBe(4);
      expect(summary.errors).toBe(3);
      expect(summary.warnings).toBe(1);
      expect(summary.bySeverity).toEqual({ error: 3, warning: 1 });
      expect(summary.byRule).toEqual({
        Clearance: 2,
        TrackWidth: 1,
        ShortCircuit: 1
      });
      expect(summary.byLayer).toEqual({
        Top: 3,
        Bottom: 1
      });
      expect(summary.topViolatedRules[0]).toEqual({ rule: "Clearance", count: 2 });
    });
  });

  describe("filterAndLimitViolations", () => {
    const violations = [
      normalizeDrcViolation({ rule: "Clearance", severity: "error" }, 0),
      normalizeDrcViolation({ rule: "Clearance", severity: "warning" }, 1),
      normalizeDrcViolation({ rule: "TrackWidth", severity: "error" }, 2),
      normalizeDrcViolation({ rule: "ShortCircuit", severity: "error" }, 3)
    ];

    it("filters by severity", () => {
      const { filtered, totalMatches } = filterAndLimitViolations(violations, { severity: "warning" });
      expect(totalMatches).toBe(1);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].rule).toBe("Clearance");
      expect(filtered[0].severity).toBe("warning");
    });

    it("filters by rule", () => {
      const { filtered, totalMatches } = filterAndLimitViolations(violations, { rule: "Clearance" });
      expect(totalMatches).toBe(2);
      expect(filtered).toHaveLength(2);
    });

    it("truncates with limit and reports warning", () => {
      const { filtered, totalMatches, warnings } = filterAndLimitViolations(violations, { limit: 2 });
      expect(totalMatches).toBe(4);
      expect(filtered).toHaveLength(2);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("truncated to 2 items");
    });
  });
});
