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
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Requested EasyEDA Pro CPL / Pick and Place export."
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
