import { describe, expect, it, vi } from "vitest";
import {
  export3dModel,
  exportDxf,
  exportImage,
  exportProjectArchive,
  validateExportContent,
  validateExportDestination
} from "./exportEnhancements.js";

describe("exportEnhancements", () => {
  describe("validateExportDestination", () => {
    it("accepts valid filenames and resolves destination path", () => {
      const res = validateExportDestination("board-layer.png", "/path/to/project/exports");
      expect(res.valid).toBe(true);
      expect(res.resolvedFileName).toBe("board-layer.png");
      expect(res.resolvedPath).toBe("/path/to/project/exports/board-layer.png");
    });

    it("rejects empty or whitespace filename", () => {
      const res = validateExportDestination("   ");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("cannot be empty");
    });

    it("rejects filenames containing illegal characters", () => {
      const res = validateExportDestination("bad:name?.svg");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("illegal characters");
    });

    it("rejects unsafe relative directory traversal in destinationPath", () => {
      const res = validateExportDestination("safe.dxf", "../../etc/secrets");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("unsafe relative path traversal");
    });
  });

  describe("validateExportContent", () => {
    it("validates SVG XML content structure", () => {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';
      const val = validateExportContent("svg", svg, "test.svg");
      expect(val.valid).toBe(true);
      expect(val.format).toBe("svg");
      expect(val.fileSizeBytes).toBeGreaterThan(50);
      expect(val.checks.some((c) => c.check === "svg_structure" && c.passed)).toBe(true);
    });

    it("validates PNG image header signature", () => {
      const pngDataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const val = validateExportContent("png", pngDataUrl, "test.png");
      expect(val.valid).toBe(true);
      expect(val.format).toBe("png");
      expect(val.checks.some((c) => c.check === "png_signature" && c.passed)).toBe(true);
    });

    it("validates STEP CAD ISO-10303-21 header", () => {
      const stepData = "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('STEP Model'),'2;1');\nENDSEC;\nEND-ISO-10303-21;\n";
      const val = validateExportContent("step", stepData, "model.step");
      expect(val.valid).toBe(true);
      expect(val.format).toBe("step");
      expect(val.checks.some((c) => c.check === "step_iso_header" && c.passed)).toBe(true);
    });

    it("validates OBJ 3D mesh tokens", () => {
      const objData = "# Wavefront OBJ\nv 1.0 2.0 3.0\nv 4.0 5.0 6.0\nf 1 2\n";
      const val = validateExportContent("obj", objData, "mesh.obj");
      expect(val.valid).toBe(true);
      expect(val.checks.some((c) => c.check === "obj_tokens" && c.passed)).toBe(true);
    });

    it("validates DXF section headers", () => {
      const dxfData = "0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n";
      const val = validateExportContent("dxf", dxfData, "layout.dxf");
      expect(val.valid).toBe(true);
      expect(val.format).toBe("dxf");
      expect(val.checks.some((c) => c.check === "dxf_structure" && c.passed)).toBe(true);
    });

    it("flags empty / 0-byte content", () => {
      const val = validateExportContent("svg", "", "empty.svg");
      expect(val.valid).toBe(false);
      expect(val.checks.some((c) => c.check === "file_size" && !c.passed)).toBe(true);
    });
  });

  describe("exportImage", () => {
    it("exports SVG schematic image and runs validation", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: () => ({ documentType: 1, title: "SensorBoard.Schematic" })
        },
        sch_Document: {
          exportSvg: vi.fn(async () => '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="400"><rect/></svg>')
        }
      });
      const saveFile = vi.fn(async (_file, name) => ({ saved: true, fileName: name }));

      const res = await exportImage(api as any, saveFile, {
        fileName: "sheet-1",
        format: "svg",
        scope: "schematic"
      });

      expect(res.saved).toBe(true);
      expect(res.fileName).toBe("sheet-1.svg");
      expect(res.format).toBe("svg");
      expect(res.scope).toBe("schematic");
      expect(res.validation).toMatchObject({ valid: true, format: "svg" });
      expect(saveFile).toHaveBeenCalledWith(expect.anything(), "sheet-1.svg");
    });

    it("exports PNG PCB image using fallback when native renderer returns data", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: () => ({ documentType: 2, title: "MainBoard.PCB" })
        }
      });
      const saveFile = vi.fn(async (_file, name) => ({ saved: true, fileName: name }));

      const res = await exportImage(api as any, saveFile, {
        fileName: "pcb-layout",
        format: "png",
        scope: "pcb",
        transparentBackground: true,
        dpi: 600
      });

      expect(res.saved).toBe(true);
      expect(res.fileName).toBe("pcb-layout.png");
      expect(res.format).toBe("png");
      expect(res.resolutionDpi).toBe(600);
      expect(res.transparentBackground).toBe(true);
      expect(res.validation).toMatchObject({ valid: true });
    });
  });

  describe("export3dModel", () => {
    it("exports STEP CAD geometry with components and copper flags", async () => {
      const api = () => ({
        pcb_Document: {
          exportStep: vi.fn(
            async () => "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('STEP Model'),'2;1');\nENDSEC;\nEND-ISO-10303-21;\n"
          )
        }
      });
      const saveFile = vi.fn(async (_file, name) => ({ saved: true, fileName: name }));

      const res = await export3dModel(api as any, saveFile, {
        fileName: "pcb-3d",
        format: "step",
        includeComponents3D: true,
        includeCopper: true,
        quality: "high"
      });

      expect(res.saved).toBe(true);
      expect(res.fileName).toBe("pcb-3d.step");
      expect(res.format).toBe("step");
      expect(res.includeComponents3D).toBe(true);
      expect(res.validation).toMatchObject({ valid: true });
    });
  });

  describe("exportProjectArchive", () => {
    it("compiles project bundle and validates archive structure", async () => {
      const api = () => ({
        dmt_Project: {
          getCurrentProjectInfo: () => ({ title: "IoT Gateway", uuid: "proj-999" }),
          getProjectData: () => [
            { id: "doc-1", title: "MCU.Schematic", type: "schematic" },
            { id: "doc-2", title: "Board.PCB", type: "pcb" }
          ]
        }
      });
      const saveFile = vi.fn(async (_file, name) => ({ saved: true, fileName: name }));

      const res = await exportProjectArchive(api as any, saveFile, {
        fileName: "iot-gateway",
        format: "epro",
        includeLibraries: true
      });

      expect(res.saved).toBe(true);
      expect(res.fileName).toBe("iot-gateway.epro");
      expect(res.projectName).toBe("IoT Gateway");
      expect(res.documentCount).toBe(2);
      expect(res.validation).toMatchObject({ valid: true });
    });
  });

  describe("exportDxf", () => {
    it("exports 2D CAD DXF drawing with PCB units and layer specifications", async () => {
      const api = () => ({
        pcb_ManufactureData: {
          getDxfFile: vi.fn(async () => "0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n")
        }
      });
      const saveFile = vi.fn(async (_file, name) => ({ saved: true, fileName: name }));

      const res = await exportDxf(api as any, saveFile, {
        fileName: "board-mechanics",
        scope: "pcb",
        layers: ["Outline", "TopLayer"],
        unit: "mm",
        dxfVersion: "2004"
      });

      expect(res.saved).toBe(true);
      expect(res.fileName).toBe("board-mechanics.dxf");
      expect(res.format).toBe("dxf");
      expect(res.unit).toBe("mm");
      expect(res.dxfVersion).toBe("2004");
      expect(res.layerCount).toBe(2);
      expect(res.validation).toMatchObject({ valid: true });
    });
  });
});
