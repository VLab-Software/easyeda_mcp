import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EditorClient } from "../../editor/EditorClient.js";
import { ok, fail } from "../toolResult.js";
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

  server.registerTool(
    "easyeda_prepare_pcb_component",
    {
      title: "Prepare PCB Component Transform",
      description:
        "Prepares a component transformation on the PCB (move, rotate, flip, or delete) with preview, scope, expected coordinates, and exact confirmation phrase. Does not modify the PCB until confirmed.",
      inputSchema: {
        action: z.enum(["move", "rotate", "flip", "delete"]).describe("PCB component transform action to perform"),
        component: z.string().min(1).describe("Target component designator (e.g. 'U1', 'R3') or primitive ID"),
        x: z.number().optional().describe("Absolute X target coordinate in mm (for move)"),
        y: z.number().optional().describe("Absolute Y target coordinate in mm (for move)"),
        dx: z.number().optional().describe("Relative X delta offset in mm (for move)"),
        dy: z.number().optional().describe("Relative Y delta offset in mm (for move)"),
        rotation: z.number().optional().describe("Absolute rotation angle in degrees (for rotate)"),
        dRotation: z.number().optional().describe("Relative rotation angle increment in degrees (for rotate)"),
        layer: z.enum(["top", "bottom"]).optional().describe("Explicit target layer/side for flip"),
        target: DocumentTargetSchema.optional().describe("Expected active PCB target"),
        timeoutMs: DefaultTimeoutSchema.default(30_000)
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async ({ action, component, x, y, dx, dy, rotation, dRotation, layer, target, timeoutMs }) => {
      try {
        const result = (await bridge.call(
          "preparePcbComponent",
          { action, component, x, y, dx, dy, rotation, dRotation, layer, target },
          timeoutMs
        )) as Record<string, unknown>;

        const mutationId = String(result.mutationId ?? "");
        const confirmation = String(result.confirmation ?? "");
        const preview = (result.preview as { impact?: string; scope?: string }) ?? {};
        const summary = [
          `Prepared PCB component transformation '${action}':`,
          `Impact: ${preview.impact ?? "none"}`,
          `Scope: ${preview.scope ?? "active document"}`,
          `Confirmation phrase required: "${confirmation}"`,
          `Review the preview and run easyeda_confirmed_action with action="mutation", params={ mutationId: "${mutationId}" }, and the exact confirmation string.`
        ].join("\n");

        return ok(summary, result);
      } catch (error) {
        return fail(error);
      }
    }
  );

  registerReadTool(server, bridge, {
    name: "easyeda_get_board_outline",
    title: "Inspect PCB Board Outline",
    description:
      "Inspects the board outline boundary, bounding box (minX, minY, maxX, maxY, width, height), perimeter, estimated area, loop closure status, and segments on the active PCB.",
    method: "getBoardOutline",
    inputSchema: {
      includeSegments: z.boolean().default(true).describe("Include individual segment coordinates and primitives."),
      includeRaw: z.boolean().default(false).describe("Include raw primitive payloads."),
      target: DocumentTargetSchema.optional().describe("Expected active PCB target."),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Inspected EasyEDA Pro PCB board outline."
  });

  server.registerTool(
    "easyeda_prepare_board_outline",
    {
      title: "Prepare Board Outline Mutation",
      description:
        "Prepares creation, rectangular/polygonal sizing, clearing, or segment modification of the board outline on the active PCB. Returns a mutationId and exact confirmation phrase required for execution via easyeda_confirmed_action.",
      inputSchema: {
        action: z
          .enum(["set_rectangle", "create", "set_polygon", "clear", "modify_segment"])
          .default("set_rectangle")
          .describe("Board outline mutation action to perform."),
        x: z.number().default(0).describe("Origin X coordinate in mm (for set_rectangle / create)."),
        y: z.number().default(0).describe("Origin Y coordinate in mm (for set_rectangle / create)."),
        width: z.number().positive().optional().describe("Board width in mm (for set_rectangle / create)."),
        height: z.number().positive().optional().describe("Board height in mm (for set_rectangle / create)."),
        points: z
          .array(z.object({ x: z.number(), y: z.number() }))
          .min(3)
          .optional()
          .describe("Array of vertex coordinates in mm for polygonal outline (for set_polygon)."),
        lineWidth: z.number().positive().default(0.2).describe("Outline track line width in mm (default: 0.2)."),
        clearExisting: z
          .boolean()
          .default(true)
          .describe("Whether to delete existing board outline primitives before creating new ones."),
        primitiveId: z.string().optional().describe("Target segment primitive ID (for modify_segment)."),
        startX: z.number().optional().describe("New start X coordinate in mm (for modify_segment)."),
        startY: z.number().optional().describe("New start Y coordinate in mm (for modify_segment)."),
        endX: z.number().optional().describe("New end X coordinate in mm (for modify_segment)."),
        endY: z.number().optional().describe("New end Y coordinate in mm (for modify_segment)."),
        target: DocumentTargetSchema.optional().describe("Expected active PCB target."),
        timeoutMs: DefaultTimeoutSchema.default(30_000)
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async ({
      action,
      x,
      y,
      width,
      height,
      points,
      lineWidth,
      clearExisting,
      primitiveId,
      startX,
      startY,
      endX,
      endY,
      target,
      timeoutMs
    }) => {
      try {
        const result = (await bridge.call(
          "prepareBoardOutline",
          {
            action,
            x,
            y,
            width,
            height,
            points,
            lineWidth,
            clearExisting,
            primitiveId,
            startX,
            startY,
            endX,
            endY,
            target
          },
          timeoutMs
        )) as Record<string, unknown>;

        const mutationId = String(result.mutationId ?? "");
        const confirmation = String(result.confirmation ?? "");
        const preview = (result.preview as { impact?: string; scope?: string }) ?? {};
        const summary = [
          `Prepared PCB board outline mutation '${action}':`,
          `Impact: ${preview.impact ?? "none"}`,
          `Scope: ${preview.scope ?? "active document"}`,
          `Confirmation phrase required: "${confirmation}"`,
          `Review the preview and run easyeda_confirmed_action with action="mutation", params={ mutationId: "${mutationId}" }, and the exact confirmation string.`
        ].join("\n");

        return ok(summary, result);
      } catch (error) {
        return fail(error);
      }
    }
  );

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
