import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EditorClient } from "../../editor/EditorClient.js";
import { DefaultTimeoutSchema, DocumentTargetSchema, registerReadTool } from "./common.js";

export function registerPcbTools(server: McpServer, bridge: EditorClient): void {
  registerReadTool(server, bridge, {
    name: "easyeda_run_drc",
    title: "Run PCB Design Rule Check (DRC)",
    description:
      "Executes the native EasyEDA Pro PCB Design Rule Check (DRC) on the active board and reports rule violations, clearings, and errors.",
    method: "runDrc",
    inputSchema: {
      strict: z.boolean().default(true).describe("Enforce strict design rule checking."),
      timeoutMs: DefaultTimeoutSchema.default(60_000)
    },
    summary: "Executed EasyEDA Pro PCB DRC check."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_pcb_layers",
    title: "Get PCB Layer Stackup",
    description:
      "Returns the layer stackup and configuration of the active EasyEDA Pro PCB, including signal/copper layers, mechanical layers, colors, and visibility.",
    method: "getPcbLayers",
    inputSchema: {
      timeoutMs: DefaultTimeoutSchema
    },
    summary: "Fetched EasyEDA Pro PCB layer configuration."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_routing_status",
    title: "Get PCB Routing Status",
    description:
      "Analyzes the PCB routing status, total nets, completion percentage, unrouted net connections (ratsnest), and optional net lengths.",
    method: "getRoutingStatus",
    inputSchema: {
      includeNetLengths: z.boolean().default(false).describe("Include calculated track length for each net."),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched EasyEDA Pro PCB routing status."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_list_pcb_components",
    title: "List PCB components",
    description:
      "Lists normalized PCB components with designator, footprint, placement layer, coordinates, and rotation angle.",
    method: "listPcbComponents",
    inputSchema: {
      query: z
        .string()
        .min(1)
        .optional()
        .describe("Optional text filter against component designator, footprint, or value."),
      layer: z.enum(["all", "top", "bottom"]).default("all").describe("Filter components by placement layer."),
      limit: z.number().int().positive().max(500).default(100),
      includePads: z.boolean().optional().describe("Include normalized pad details for each component."),
      includeProperties: z.boolean().optional().describe("Include custom properties and attributes."),
      includeRaw: z.boolean().default(false),
      target: DocumentTargetSchema.optional().describe("Expected active PCB target."),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Listed EasyEDA Pro PCB components."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_pcb_pads",
    title: "Get PCB pads and pin connections",
    description:
      "Inspects PCB pads (both component footprint pins and free pads) with net connections, layers, drill sizes, shapes, and coordinates.",
    method: "getPcbPads",
    inputSchema: {
      component: z
        .string()
        .min(1)
        .optional()
        .describe("Filter pads by parent component designator (e.g. 'U1') or primitive ID."),
      net: z.string().min(1).optional().describe("Filter pads by assigned net name (e.g. 'GND', 'VCC')."),
      layer: z
        .enum(["all", "top", "bottom", "multi"])
        .default("all")
        .describe("Filter pads by layer or multi-layer through-hole."),
      padNumber: z.string().min(1).optional().describe("Filter pads by specific pin/pad number (e.g. '1', 'A1')."),
      includeComponentPads: z.boolean().default(true).describe("Include pads belonging to footprint components."),
      includeStandalonePads: z.boolean().default(true).describe("Include standalone / free canvas pads."),
      limit: z.number().int().positive().max(1000).default(200),
      includeRaw: z.boolean().default(false),
      target: DocumentTargetSchema.optional().describe("Expected active PCB target."),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched EasyEDA Pro PCB pads."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_highlight_net",
    title: "Highlight or clear PCB net",
    description: "Visually highlights a specified net on the EasyEDA Pro PCB canvas, or clears all highlighted nets.",
    method: "highlightNet",
    inputSchema: {
      net: z.string().min(1).optional().describe("Net name to highlight (e.g., 'GND', 'VCC_5V')."),
      clear: z.boolean().default(false).describe("When true, unhighlights all nets."),
      timeoutMs: DefaultTimeoutSchema
    },
    summary: "Updated EasyEDA Pro PCB net highlighting."
  });
}
