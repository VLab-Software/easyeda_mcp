import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EditorClient } from "../../editor/EditorClient.js";
import { DefaultTimeoutSchema, DocumentTargetSchema, registerReadTool } from "./common.js";

export function registerExportTools(server: McpServer, bridge: EditorClient): void {
  registerReadTool(server, bridge, {
    name: "easyeda_navigate_component",
    title: "Navigate to EasyEDA Pro component",
    description: "Navigates/highlights a component in the EasyEDA Pro editor when the extension can locate it.",
    method: "navigateComponent",
    inputSchema: {
      query: z.string().min(1).describe("Component designator or search query."),
      timeoutMs: DefaultTimeoutSchema
    },
    summary: "Requested EasyEDA Pro component navigation."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_navigate_region",
    title: "Navigate to EasyEDA Pro region",
    description: "Navigates to coordinates or a rectangular region in the active EasyEDA Pro PCB/document.",
    method: "navigateRegion",
    inputSchema: {
      x: z.number().optional(),
      y: z.number().optional(),
      left: z.number().optional(),
      top: z.number().optional(),
      right: z.number().optional(),
      bottom: z.number().optional(),
      timeoutMs: DefaultTimeoutSchema
    },
    summary: "Requested EasyEDA Pro region navigation."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_zoom_board",
    title: "Zoom EasyEDA Pro board outline",
    description: "Zooms the active PCB editor to the board outline.",
    method: "zoomBoard",
    inputSchema: {
      timeoutMs: DefaultTimeoutSchema
    },
    summary: "Requested EasyEDA Pro board zoom."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_export_bom",
    title: "Export EasyEDA Pro BOM",
    description: "Exports a BOM from the active EasyEDA Pro project through the extension.",
    method: "exportBom",
    inputSchema: {
      fileName: z.string().min(1).optional(),
      format: z.enum(["csv", "xlsx", "json"]).default("csv"),
      scope: z.enum(["pcb", "schematic", "auto"]).default("auto"),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Requested EasyEDA Pro BOM export."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_export_netlist",
    title: "Export EasyEDA Pro netlist",
    description: "Exports a netlist from the active EasyEDA Pro schematic or PCB through the extension.",
    method: "exportNetlist",
    inputSchema: {
      fileName: z.string().min(1).optional(),
      scope: z.enum(["pcb", "schematic", "auto"]).default("auto"),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Requested EasyEDA Pro netlist export."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_export_gerber",
    title: "Export EasyEDA Pro Gerber",
    description: "Exports Gerber fabrication files from the active EasyEDA Pro PCB through the extension.",
    method: "exportGerber",
    inputSchema: {
      fileName: z.string().min(1).optional(),
      timeoutMs: DefaultTimeoutSchema.default(60_000)
    },
    summary: "Requested EasyEDA Pro Gerber export."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_export_pdf",
    title: "Export EasyEDA Pro PDF",
    description: "Exports a PDF from the active EasyEDA Pro document through the extension.",
    method: "exportPdf",
    inputSchema: {
      fileName: z.string().min(1).optional(),
      scope: z.enum(["pcb", "schematic", "auto"]).default("auto"),
      timeoutMs: DefaultTimeoutSchema.default(60_000)
    },
    summary: "Requested EasyEDA Pro PDF export."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_export_cpl",
    title: "Export PCB Component Pick and Place (CPL)",
    description:
      "Exports the Pick and Place / Centroid (CPL) file from the active EasyEDA Pro PCB for SMT assembly (e.g. JLCPCB).",
    method: "exportCpl",
    inputSchema: {
      fileName: z.string().min(1).optional().describe("Optional output file name without extension."),
      format: z.enum(["csv", "xlsx", "txt"]).default("csv").describe("File format for the pick and place report."),
      unit: z.enum(["mm", "mil"]).default("mm").describe("Coordinate unit for component positions."),
      destinationPath: z.string().min(1).optional().describe("Optional destination directory / target path."),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Requested EasyEDA Pro CPL / Pick and Place export."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_export_image",
    title: "Export schematic or PCB canvas image",
    description:
      "Exports a high-resolution visual rendering or vector graphic (PNG, SVG, JPG) of the active schematic sheet or PCB layer stack with transparent background, resolution scaling, and layer visibility options.",
    method: "exportImage",
    inputSchema: {
      fileName: z.string().min(1).optional().describe("Optional output file name without extension."),
      format: z.enum(["png", "svg", "jpg"]).default("png").describe("Image format (png, svg, jpg)."),
      scope: z.enum(["pcb", "schematic", "auto"]).default("auto").describe("Scope of document to export."),
      theme: z.enum(["light", "dark", "default"]).default("default").describe("Visual theme for rendering."),
      transparentBackground: z.boolean().default(false).describe("Whether to use transparent background."),
      dpi: z.number().int().positive().max(1200).default(300).describe("Resolution in dots-per-inch (raster formats)."),
      layers: z
        .array(z.string())
        .optional()
        .describe("Specific PCB layers to include (e.g. ['TopLayer', 'TopSilkLayer'])."),
      destinationPath: z.string().min(1).optional().describe("Optional destination directory / target path."),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Requested EasyEDA Pro canvas image export."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_export_3d_model",
    title: "Export PCB 3D mechanical CAD model",
    description:
      "Exports 3D mechanical CAD geometry (STEP, OBJ, STL, WRL) of the board and mounted component bodies for MCAD integration, 3D printing, and thermal/clearance analysis.",
    method: "export3dModel",
    inputSchema: {
      fileName: z.string().min(1).optional().describe("Optional output file name without extension."),
      format: z
        .enum(["step", "obj", "stl", "wrl"])
        .default("step")
        .describe("3D CAD geometry format (step, obj, stl, wrl)."),
      includeComponents3D: z.boolean().default(true).describe("Include 3D component body models."),
      includeCopper: z.boolean().default(true).describe("Include copper layers in 3D geometry."),
      includeSilkscreen: z.boolean().default(true).describe("Include silkscreen legends in 3D geometry."),
      quality: z.enum(["low", "medium", "high"]).default("high").describe("Tessellation/mesh export quality."),
      destinationPath: z.string().min(1).optional().describe("Optional destination directory / target path."),
      timeoutMs: DefaultTimeoutSchema.default(60_000)
    },
    summary: "Requested EasyEDA Pro 3D mechanical CAD export."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_export_project_archive",
    title: "Export complete EasyEDA Pro project archive",
    description:
      "Exports the entire EasyEDA Pro project archive (epro, zip, json) containing all schematic sheets, PCB layout, layer configurations, netlists, and project metadata with integrity validation.",
    method: "exportProjectArchive",
    inputSchema: {
      fileName: z.string().min(1).optional().describe("Optional output file name without extension."),
      format: z.enum(["epro", "zip", "json"]).default("epro").describe("Archive bundle format (epro, zip, json)."),
      includeLibraries: z.boolean().default(true).describe("Bundle custom library symbols and footprints."),
      includeHistory: z.boolean().default(false).describe("Include revision and change history."),
      destinationPath: z.string().min(1).optional().describe("Optional destination directory / target path."),
      timeoutMs: DefaultTimeoutSchema.default(60_000)
    },
    summary: "Requested EasyEDA Pro project archive export."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_export_dxf",
    title: "Export 2D CAD DXF drawing",
    description:
      "Exports 2D CAD DXF drawings of PCB outlines, copper traces, drilling holes, or schematic drawings for mechanical enclosures, CNC routing, laser cutting, and AutoCAD integration.",
    method: "exportDxf",
    inputSchema: {
      fileName: z.string().min(1).optional().describe("Optional output file name without extension."),
      scope: z.enum(["pcb", "schematic", "auto"]).default("pcb").describe("Export scope (pcb or schematic)."),
      layers: z.array(z.string()).optional().describe("Specific layers to include in DXF export."),
      unit: z.enum(["mm", "mil", "inch"]).default("mm").describe("CAD drawing unit."),
      dxfVersion: z
        .enum(["R12", "R14", "2000", "2004", "2007", "2018"])
        .default("2004")
        .describe("AutoCAD DXF format version."),
      destinationPath: z.string().min(1).optional().describe("Optional destination directory / target path."),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Requested EasyEDA Pro 2D CAD DXF export."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_search_library",
    title: "Search component library",
    description:
      "Searches the EasyEDA / LCSC component catalog by keyword, LCSC part number (e.g. C1523), or manufacturer part number.",
    method: "searchLibrary",
    inputSchema: {
      query: z
        .string()
        .min(1)
        .describe("Keyword, part number, or LCSC part code (e.g., 'C1523', 'ESP32', '0402 10k')."),
      limit: z.number().int().positive().max(100).default(20),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Searched EasyEDA Pro component library."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_device_details",
    title: "Get device, symbol, and footprint details",
    description:
      "Fetches complete device definition, schematic symbol pinout, PCB footprint pad geometry, and pin-to-pad correspondence mapping by device UUID, LCSC part code (e.g. C1523), or placed component designator (e.g. U1).",
    method: "getDeviceDetails",
    inputSchema: {
      deviceUuid: z.string().min(1).optional().describe("Library device UUID."),
      designator: z
        .string()
        .min(1)
        .optional()
        .describe("Placed component designator in active schematic/PCB (e.g. 'U1', 'R2')."),
      lcscCode: z.string().min(1).optional().describe("LCSC component code (e.g. 'C1523')."),
      includePinPadMap: z.boolean().default(true).describe("Whether to include the pin-to-pad correspondence mapping."),
      includeRaw: z.boolean().default(false).describe("Include raw underlying primitive data."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched EasyEDA Pro device, symbol, and footprint details."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_compare_devices",
    title: "Compare two devices for pinout and footprint compatibility",
    description:
      "Compares two component devices (by UUID, LCSC code, or designator) evaluating pinout matching, footprint geometry, JLCPCB stock availability, and drop-in replacement feasibility.",
    method: "compareDevices",
    inputSchema: {
      deviceA: z
        .string()
        .min(1)
        .describe("First device UUID, LCSC part number (e.g. 'C1523'), or component designator (e.g. 'U1')."),
      deviceB: z
        .string()
        .min(1)
        .describe("Second device UUID, LCSC part number (e.g. 'C2040'), or component designator (e.g. 'U2')."),
      strictPinout: z
        .boolean()
        .default(true)
        .describe("Strictly compare pin electrical types in addition to pin names."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Compared two EasyEDA Pro component devices for compatibility."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_verify_pin_pad_mapping",
    title: "Verify symbol pin to footprint pad correspondence",
    description:
      "Validates 1-to-1 correspondence between schematic symbol pins and PCB footprint pads across all components on active canvas or for a specific component. Identifies unmapped pins, unmapped pads, and potential netlist connectivity breaks.",
    method: "verifyPinPadMapping",
    inputSchema: {
      designator: z
        .string()
        .min(1)
        .optional()
        .describe(
          "Optional component designator to inspect (e.g. 'U1'). If omitted, verifies all components on active canvas."
        ),
      deviceUuid: z.string().min(1).optional().describe("Optional library device UUID to verify."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Verified symbol pin to footprint pad correspondence."
  });
}
