import { describe, expect, it } from "vitest";
import {
  estimateComponentHeight,
  classifyMissingModelCriticality,
  inspectPcb3d,
  fetchPcb3dView
} from "./pcb3dInspection.js";

describe("pcb3dInspection", () => {
  describe("estimateComponentHeight", () => {
    it("estimates realistic heights for connectors, ICs, passives and power packages", () => {
      expect(estimateComponentHeight("USB-C-16P", "J1")).toBe(3.2);
      expect(estimateComponentHeight("HDR-1X4", "J2")).toBe(8.5);
      expect(estimateComponentHeight("SOIC-8", "U1")).toBe(1.75);
      expect(estimateComponentHeight("LQFP-48", "U2")).toBe(1.6);
      expect(estimateComponentHeight("QFN-32", "U3")).toBe(0.9);
      expect(estimateComponentHeight("TO-220", "Q1")).toBe(15.0);
      expect(estimateComponentHeight("C_0805", "C1")).toBe(0.6);
      expect(estimateComponentHeight("R_0603", "R1")).toBe(0.45);
      expect(estimateComponentHeight("CAP-ELEC-D8", "C2")).toBe(11.0);
    });
  });

  describe("classifyMissingModelCriticality", () => {
    it("assigns HIGH criticality to connectors, switches, transformers and electrolytics", () => {
      expect(classifyMissingModelCriticality("J1", "CONN_HEADER")).toBe("HIGH");
      expect(classifyMissingModelCriticality("SW1", "TACTILE_SWITCH")).toBe("HIGH");
      expect(classifyMissingModelCriticality("C1", "CAP-ALUM-CAN")).toBe("HIGH");
    });

    it("assigns MEDIUM criticality to ICs and packages", () => {
      expect(classifyMissingModelCriticality("U1", "LQFP-64")).toBe("MEDIUM");
      expect(classifyMissingModelCriticality("U2", "SOIC-16")).toBe("MEDIUM");
    });

    it("assigns LOW criticality to small chip passives", () => {
      expect(classifyMissingModelCriticality("R1", "0805")).toBe("LOW");
      expect(classifyMissingModelCriticality("C2", "0603")).toBe("LOW");
    });
  });

  describe("inspectPcb3d", () => {
    const mockPcbDoc = {
      documentType: 3,
      uuid: "pcb-doc-3d",
      parentProjectUuid: "project-3d"
    };

    const mockComponents = [
      {
        primitiveId: "u1",
        designator: "U1",
        footprint: "SOIC-8",
        layer: 1, // Top
        x: 10,
        y: 10,
        rotation: 0,
        "3dModel": {
          title: "Microcontroller SOIC-8",
          type: "STEP",
          height: 1.75,
          z: 0
        }
      },
      {
        primitiveId: "j1",
        designator: "J1",
        footprint: "USB-C",
        layer: 1, // Top
        x: 10,
        y: 11, // Overlaps with U1 in X and Y!
        rotation: 0,
        "3dModel": {
          title: "USB-C Receptacle",
          type: "STEP",
          height: 3.2,
          z: 0
        }
      },
      {
        primitiveId: "r1",
        designator: "R1",
        footprint: "0805",
        layer: 2, // Bottom
        x: 30,
        y: 30,
        rotation: 0
        // No 3D model => missing model!
      }
    ];

    it("evaluates board envelope, missing models, height violations, and 3D interference", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: async () => mockPcbDoc
        },
        pcb_Layer: {
          getAllLayers: async () => [{ totalThickness: 1.6 }]
        },
        pcb_PrimitiveComponent: {
          getAll: async () => mockComponents
        }
      });

      const res = await inspectPcb3d(api, {
        maxHeightMm: 3.0,
        enclosureHeightMm: 10.0,
        checkInterference: true
      });

      const envelope = res.envelope as any;
      expect(envelope.boardThicknessMm).toBe(1.6);
      expect(envelope.maxHeightTopMm).toBe(3.2); // J1 is 3.2mm
      expect(envelope.maxHeightBottomMm).toBe(0.6); // R1 is estimated 0.6mm
      expect(envelope.totalEnvelopeHeightMm).toBe(5.4); // 1.6 + 3.2 + 0.6 = 5.4mm
      expect(envelope.enclosureClearanceMm).toBe(4.6); // 10.0 - 5.4 = 4.6mm
      expect(envelope.enclosureStatus).toBe("FIT");

      // Check missing 3D models: R1 should be missing
      const missing = res.missing3dModels as any[];
      expect(missing).toHaveLength(1);
      expect(missing[0].designator).toBe("R1");

      // Check height violations: J1 is 3.2mm > maxHeightMm 3.0mm
      const violations = res.heightViolations as any[];
      expect(violations).toHaveLength(1);
      expect(violations[0].designator).toBe("J1");
      expect(violations[0].exceededByMm).toBe(0.2);

      // Check 3D interference collisions: U1 and J1 collide at (10, 10) on Top layer
      const collisions = res.interferenceCollisions as any[];
      expect(collisions.length).toBeGreaterThanOrEqual(1);
      expect(collisions[0].componentA).toBe("U1");
      expect(collisions[0].componentB).toBe("J1");
    });

    it("rejects non-PCB document targets", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: async () => ({
            documentType: 1, // Schematic
            uuid: "sch-1"
          })
        }
      });

      await expect(inspectPcb3d(api)).rejects.toThrow("3D PCB inspection requires an active PCB document.");
    });
  });

  describe("fetchPcb3dView", () => {
    it("returns camera coordinates for isometric and orthographic view presets", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: async () => ({ documentType: 3, uuid: "pcb-1" })
        }
      });

      const resIso = (await fetchPcb3dView(api, { viewAngle: "isometric_ne" })) as any;
      expect(resIso.viewAngle).toBe("isometric_ne");
      expect(resIso.camera.pitch).toBe(45);
      expect(resIso.camera.yaw).toBe(45);
      expect(resIso.renderingLayers.component3dModels).toBe(true);

      const resTop = (await fetchPcb3dView(api, { viewAngle: "top" })) as any;
      expect(resTop.viewAngle).toBe("top");
      expect(resTop.camera.pitch).toBe(90);
    });
  });
});
