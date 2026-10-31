import { describe, expect, it } from "vitest";
import { projectCompactPcb, projectCompactSchematic } from "./tokenOptimization.js";
import type { SchematicSnapshot } from "../schematic/analysis.js";

describe("tokenOptimization", () => {
  describe("projectCompactSchematic", () => {
    it("projects a high-density, token-optimized summary of schematic components and nets", () => {
      const mockSnapshot: Partial<SchematicSnapshot> = {
        documentName: "Sheet_1.esys",
        components: [
          {
            designator: "R1",
            value: "10k",
            name: "RESISTOR",
            footprint: "0603",
            position: { x: 100, y: 200 }
          },
          {
            designator: "C1",
            value: "100nF",
            name: "CAPACITOR",
            footprint: { name: "0402" },
            position: { x: 300, y: 400 }
          },
          {
            designator: "U1",
            value: "ESP32-WROOM-32",
            name: "MICROCONTROLLER",
            footprint: "MODULE",
            position: { x: 500, y: 600 }
          }
        ],
        pins: [
          { componentDesignator: "R1", pinNumber: "1", net: "+3V3", position: { x: 0, y: 0 } },
          { componentDesignator: "R1", pinNumber: "2", net: "EN", position: { x: 0, y: 0 } },
          { componentDesignator: "C1", pinNumber: "1", net: "EN", position: { x: 0, y: 0 } },
          { componentDesignator: "C1", pinNumber: "2", net: "GND", position: { x: 0, y: 0 } },
          { componentDesignator: "U1", pinNumber: "3", net: "EN", position: { x: 0, y: 0 } },
          { componentDesignator: "U1", pinNumber: "1", net: "GND", position: { x: 0, y: 0 } }
        ],
        nets: [{ name: "+3V3" }, { name: "EN" }, { name: "GND" }]
      };

      const compact = projectCompactSchematic(mockSnapshot);

      expect(compact.sheetName).toBe("Sheet_1.esys");
      expect(compact.totalComponents).toBe(3);
      expect(compact.totalNets).toBe(3);
      expect(compact.componentsByType).toEqual({ R: 1, C: 1, U: 1 });

      expect(compact.components).toHaveLength(3);
      expect(compact.components[0]).toEqual({
        ref: "R1",
        val: "10k",
        name: "RESISTOR",
        pkg: "0603",
        pinsCount: 2
      });

      const enNet = compact.nets.find((n) => n.name === "EN");
      expect(enNet).toBeDefined();
      expect(enNet?.pinsCount).toBe(3);
      expect(enNet?.connections).toContain("R1.2");
      expect(enNet?.connections).toContain("C1.1");
      expect(enNet?.connections).toContain("U1.3");
    });

    it("handles empty snapshots gracefully", () => {
      const compact = projectCompactSchematic({});
      expect(compact.totalComponents).toBe(0);
      expect(compact.totalNets).toBe(0);
      expect(compact.components).toEqual([]);
      expect(compact.nets).toEqual([]);
    });
  });

  describe("projectCompactPcb", () => {
    it("projects a high-density, token-optimized summary of PCB layout and routing", () => {
      const compact = projectCompactPcb({
        documentName: "MainBoard_PCB.epcb",
        routingStatus: {
          totalNets: 36,
          unroutedNets: 2,
          routedNets: 34,
          completionRate: "94%",
          unroutedNetDetails: [{ net: "SDA" }, { net: "SCL" }]
        },
        components: [
          { designator: "U1", layer: "top", footprint: "QFN-32" },
          { designator: "C1", layerId: 1, footprint: "0402" },
          { designator: "R1", layerId: 2, footprint: "0603" }
        ]
      });

      expect(compact.documentName).toBe("MainBoard_PCB.epcb");
      expect(compact.totalComponents).toBe(3);
      expect(compact.totalNets).toBe(36);
      expect(compact.unroutedNets).toBe(2);
      expect(compact.routedNets).toBe(34);
      expect(compact.completionRate).toBe("94%");
      expect(compact.unroutedNetNames).toEqual(["SDA", "SCL"]);
      expect(compact.components[1].layer).toBe("top");
      expect(compact.components[2].layer).toBe("bottom");
    });
  });
});
