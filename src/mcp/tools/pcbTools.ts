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
      "Executes the native EasyEDA Pro PCB Design Rule Check (DRC) on the active board and reports detailed violations, categorized counts, evidence, document target, and execution comparison.",
    method: "runDrc",
    inputSchema: {
      strict: z.boolean().default(true).describe("Enforce strict design rule checking."),
      severity: z
        .enum(["all", "error", "warning"])
        .optional()
        .describe("Filter reported violations by severity level ('all', 'error', or 'warning')."),
      rule: z
        .string()
        .min(1)
        .optional()
        .describe("Optional rule name or code filter (e.g. Clearance, ShortCircuit, UnroutedNet)."),
      limit: z
        .number()
        .int()
        .positive()
        .max(500)
        .optional()
        .describe("Maximum number of detailed violation records to return."),
      compareWithEditor: z
        .boolean()
        .optional()
        .describe("Compare execution results against editor-side DRC error state if available."),
      target: DocumentTargetSchema.optional().describe(
        "Expected document target to assert execution on the intended PCB document."
      ),
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

  server.registerTool(
    "easyeda_prepare_pcb_routing",
    {
      title: "Prepare PCB Auto-routing or Unrouting",
      description:
        "Prepares native auto-routing or destructive unrouting of tracks/vias on the active PCB canvas with explicit nets scope, safety preview, and exact confirmation phrase. Does not modify the PCB until confirmed.",
      inputSchema: {
        action: z
          .enum(["autoroute", "unroute"])
          .describe("Routing operation: autoroute to route traces, or unroute to destructively clear tracks/vias."),
        nets: z
          .array(z.string())
          .optional()
          .describe("Explicit array of net names to target (e.g. ['GND', 'VCC']). If omitted, targets all nets."),
        ignoreNets: z.array(z.string()).optional().describe("Array of net names to exclude from autorouting."),
        keepExistingRoutes: z
          .boolean()
          .default(true)
          .describe("Whether to preserve existing tracks during autorouting."),
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
    async ({ action, nets, ignoreNets, keepExistingRoutes, target, timeoutMs }) => {
      try {
        const result = (await bridge.call(
          "preparePcbRouting",
          { action, nets, ignoreNets, keepExistingRoutes, target },
          timeoutMs
        )) as Record<string, unknown>;

        const mutationId = String(result.mutationId ?? "");
        const confirmation = String(result.confirmation ?? "");
        const preview = (result.preview as { impact?: string; scope?: string }) ?? {};
        const summary = [
          `Prepared PCB routing mutation '${action}':`,
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

  server.registerTool(
    "easyeda_prepare_pcb_layout",
    {
      title: "Prepare PCB Auto-layout",
      description:
        "Prepares native component auto-placement/auto-layout on the active PCB canvas within the board outline with safety preview and exact confirmation phrase. Does not modify the PCB until confirmed.",
      inputSchema: {
        action: z.literal("autolayout").default("autolayout").describe("Layout operation to perform."),
        components: z
          .array(z.string())
          .optional()
          .describe(
            "Explicit array of component designators to arrange (e.g. ['U1', 'R1']). If omitted, arranges all unlocked components."
          ),
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
    async ({ action, components, target, timeoutMs }) => {
      try {
        const result = (await bridge.call("preparePcbLayout", { action, components, target }, timeoutMs)) as Record<
          string,
          unknown
        >;

        const mutationId = String(result.mutationId ?? "");
        const confirmation = String(result.confirmation ?? "");
        const preview = (result.preview as { impact?: string; scope?: string }) ?? {};
        const summary = [
          `Prepared PCB auto-layout mutation:`,
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
    name: "easyeda_get_pcb_tracks",
    title: "Get PCB tracks",
    description:
      "Lists and inspects copper tracks and traces on the active PCB layout with net, layer, geometry coordinates, width, and calculated length.",
    method: "getPcbTracks",
    inputSchema: {
      net: z.string().min(1).optional().describe("Optional filter by net name (e.g. 'GND', 'VCC')."),
      layer: z
        .union([z.string(), z.number()])
        .optional()
        .describe("Optional filter by layer name or layer ID (e.g. 1, 'TopLayer', 2, 'BottomLayer')."),
      primitiveId: z.string().min(1).optional().describe("Optional filter by track primitive ID."),
      limit: z.number().int().positive().max(500).default(100).describe("Maximum number of tracks to return."),
      includeRaw: z.boolean().default(false).describe("Include raw underlying primitive data."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched EasyEDA Pro PCB tracks."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_pcb_vias",
    title: "Get PCB vias",
    description:
      "Lists and inspects vias on the active PCB layout with net, center coordinates (x, y in mm), outer diameter, hole/drill diameter, and layers.",
    method: "getPcbVias",
    inputSchema: {
      net: z.string().min(1).optional().describe("Optional filter by net name (e.g. 'GND', 'VCC')."),
      primitiveId: z.string().min(1).optional().describe("Optional filter by via primitive ID."),
      limit: z.number().int().positive().max(500).default(100).describe("Maximum number of vias to return."),
      includeRaw: z.boolean().default(false).describe("Include raw underlying primitive data."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched EasyEDA Pro PCB vias."
  });

  server.registerTool(
    "easyeda_prepare_pcb_track_via",
    {
      title: "Prepare PCB track or via mutation",
      description:
        "Prepares creating, modifying, or destructively deleting copper tracks and vias on the active PCB canvas with safety preview and exact confirmation phrase. Does not modify the PCB until confirmed.",
      inputSchema: {
        entity: z.enum(["track", "via"]).describe("Entity type to mutate: 'track' or 'via'."),
        action: z.enum(["create", "modify", "delete"]).describe("Action: 'create', 'modify', or 'delete'."),
        trackId: z.string().min(1).optional().describe("Primitive ID of track to modify or delete."),
        viaId: z.string().min(1).optional().describe("Primitive ID of via to modify or delete."),
        net: z.string().min(1).optional().describe("Net name for created track or via (e.g. 'GND', 'VCC')."),
        layer: z
          .union([z.string(), z.number()])
          .optional()
          .describe("Placement layer for created track (default: 1 / TopLayer)."),
        startX: z.number().optional().describe("Start X coordinate in mm (for track creation)."),
        startY: z.number().optional().describe("Start Y coordinate in mm (for track creation)."),
        endX: z.number().optional().describe("End X coordinate in mm (for track creation)."),
        endY: z.number().optional().describe("End Y coordinate in mm (for track creation)."),
        lineWidth: z.number().positive().optional().describe("Track line width in mm (default: 0.254)."),
        x: z.number().optional().describe("Center X coordinate in mm (for via creation)."),
        y: z.number().optional().describe("Center Y coordinate in mm (for via creation)."),
        diameter: z.number().positive().optional().describe("Via outer diameter in mm (default: 0.6)."),
        holeDiameter: z.number().positive().optional().describe("Via drill hole diameter in mm (default: 0.3)."),
        properties: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Property modifications dictionary (for track/via modification)."),
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
    async (params) => {
      try {
        const timeoutMs = params.timeoutMs ?? 30_000;
        const result = (await bridge.call("preparePcbTrackVia", params, timeoutMs)) as Record<string, unknown>;

        const mutationId = String(result.mutationId ?? "");
        const confirmation = String(result.confirmation ?? "");
        const preview = (result.preview as { impact?: string; scope?: string }) ?? {};
        const summary = [
          `Prepared PCB ${params.entity} ${params.action} mutation:`,
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

  registerReadTool(server, bridge, {
    name: "easyeda_get_copper_zones",
    title: "Get PCB copper zones",
    description:
      "Lists and inspects copper zones (copper pours/areas) on the active PCB layout with net, layer, clearance, fillType, vertices, and bounding box.",
    method: "getCopperZones",
    inputSchema: {
      net: z.string().min(1).optional().describe("Optional filter by net name (e.g. 'GND', 'VCC')."),
      layer: z
        .union([z.string(), z.number()])
        .optional()
        .describe("Optional filter by layer name or layer ID (e.g. 1, 'TopLayer', 2, 'BottomLayer')."),
      primitiveId: z.string().min(1).optional().describe("Optional filter by copper zone primitive ID."),
      limit: z.number().int().positive().max(500).default(100).describe("Maximum number of copper zones to return."),
      includeRaw: z.boolean().default(false).describe("Include raw underlying primitive data."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched EasyEDA Pro PCB copper zones."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_keepouts",
    title: "Get PCB keepouts",
    description:
      "Lists and inspects keepout areas on the active PCB layout with layer, keepoutType, vertices, and bounding box.",
    method: "getKeepouts",
    inputSchema: {
      layer: z
        .union([z.string(), z.number()])
        .optional()
        .describe("Optional filter by layer name or layer ID (e.g. 1, 'TopLayer', 2, 'BottomLayer', or 'AllLayers')."),
      primitiveId: z.string().min(1).optional().describe("Optional filter by keepout primitive ID."),
      limit: z.number().int().positive().max(500).default(100).describe("Maximum number of keepouts to return."),
      includeRaw: z.boolean().default(false).describe("Include raw underlying primitive data."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched EasyEDA Pro PCB keepout areas."
  });

  server.registerTool(
    "easyeda_prepare_copper_keepout",
    {
      title: "Prepare PCB copper zone or keepout mutation",
      description:
        "Prepares creating, modifying, deleting, or recalculating/rebuilding copper zones and keepouts on the active PCB canvas with safety preview and exact confirmation phrase. Does not modify the PCB until confirmed.",
      inputSchema: {
        entity: z.enum(["copperZone", "keepout"]).describe("Entity type to mutate: 'copperZone' or 'keepout'."),
        action: z
          .enum(["create", "modify", "delete", "rebuild"])
          .describe("Action: 'create', 'modify', 'delete', or 'rebuild' (rebuild applies to copperZone)."),
        zoneId: z.string().min(1).optional().describe("Primitive ID of copper zone to modify, delete, or rebuild."),
        keepoutId: z.string().min(1).optional().describe("Primitive ID of keepout to modify or delete."),
        net: z.string().min(1).optional().describe("Net name for copper zone creation (e.g. 'GND', 'VCC')."),
        layer: z.union([z.string(), z.number()]).optional().describe("Placement layer (default: 1 / TopLayer)."),
        points: z
          .array(z.object({ x: z.number(), y: z.number() }))
          .optional()
          .describe("Array of boundary vertices ({ x, y } in mm). Minimum 3 vertices."),
        x: z.number().optional().describe("Shortcut start X coordinate in mm for rectangular area."),
        y: z.number().optional().describe("Shortcut start Y coordinate in mm for rectangular area."),
        width: z.number().positive().optional().describe("Shortcut width in mm for rectangular area."),
        height: z.number().positive().optional().describe("Shortcut height in mm for rectangular area."),
        clearance: z.number().positive().optional().describe("Clearance spacing in mm (for copper zones)."),
        fillType: z.string().optional().describe("Fill style for copper zones: 'solid', 'grid', or 'none'."),
        keepoutType: z.string().optional().describe("Keepout restriction type: 'all', 'track', 'via', 'copper', etc."),
        properties: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Property modifications dictionary (for modify action)."),
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
    async (params) => {
      try {
        const timeoutMs = params.timeoutMs ?? 30_000;
        const result = (await bridge.call("prepareCopperKeepout", params, timeoutMs)) as Record<string, unknown>;

        const mutationId = String(result.mutationId ?? "");
        const confirmation = String(result.confirmation ?? "");
        const preview = (result.preview as { impact?: string; scope?: string }) ?? {};
        const summary = [
          `Prepared PCB ${params.entity} ${params.action} mutation:`,
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
    name: "easyeda_get_pcb_airwires",
    title: "Get PCB airwires and ratsnest connections",
    description:
      "Inspects unrouted ratsnest airwire lines on the active PCB layout with endpoints, coordinates, lengths, and inference method/tolerances.",
    method: "getPcbAirwires",
    inputSchema: {
      net: z.string().min(1).optional().describe("Optional filter by net name (e.g. 'GND', 'VCC')."),
      limit: z.number().int().positive().max(500).default(200).describe("Maximum number of airwires to return."),
      padSnapTolerance: z.number().positive().optional().describe("Pad snap tolerance in mm (default: 0.1)."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched EasyEDA Pro PCB airwires report."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_pcb_placement_report",
    title: "Get PCB component placement and collision report",
    description:
      "Generates a comprehensive component placement report including density, bounding boxes, layer distribution, and collision/clearance warnings.",
    method: "getPcbPlacementReport",
    inputSchema: {
      collisionTolerance: z
        .number()
        .positive()
        .optional()
        .describe("Clearance margin in mm to flag tight spacing or collision warnings (default: 0.2)."),
      boardMarginTolerance: z
        .number()
        .positive()
        .optional()
        .describe("Tolerance in mm beyond board outline before considering component unplaced (default: 1.0)."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Generated EasyEDA Pro PCB placement report."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_pcb_net_report",
    title: "Get PCB net and routing completion report",
    description:
      "Generates detailed physical metrics for nets on the active PCB (pad counts, track length, via count, copper zone coverage, and completion percentage).",
    method: "getPcbNetReport",
    inputSchema: {
      net: z.string().min(1).optional().describe("Optional filter by specific net name."),
      category: z.enum(["all", "power", "ground", "signal"]).optional().describe("Filter nets by electrical category."),
      status: z
        .enum(["all", "routed", "partially_routed", "unrouted"])
        .optional()
        .describe("Filter nets by routing status."),
      limit: z.number().int().positive().max(500).default(200).describe("Maximum number of nets to return."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Generated EasyEDA Pro PCB net and routing report."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_pcb_net_classes",
    title: "Get PCB net classes",
    description:
      "Lists net classes and their member net assignments, routing rules (trace width, clearance, via size) on the active PCB.",
    method: "getPcbNetClasses",
    inputSchema: {
      name: z.string().min(1).optional().describe("Optional filter by specific net class name."),
      includeRaw: z.boolean().default(false).describe("Include raw underlying primitive data."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched EasyEDA Pro PCB net classes."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_pcb_differential_pairs",
    title: "Get PCB differential pairs",
    description:
      "Lists differential pairs with positive and negative net assignments, target impedance, trace width, gap, actual routed track lengths, and skew tolerance compliance.",
    method: "getPcbDifferentialPairs",
    inputSchema: {
      name: z.string().min(1).optional().describe("Optional filter by specific differential pair name."),
      toleranceMm: z.number().positive().optional().describe("Length matching skew tolerance in mm (default: 0.15)."),
      includeRaw: z.boolean().default(false).describe("Include raw underlying primitive data."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched EasyEDA Pro PCB differential pairs."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_pcb_length_groups",
    title: "Get PCB equal length groups",
    description:
      "Lists equal length matching groups with member net lengths, reference length, max skew, and tolerance compliance.",
    method: "getPcbLengthGroups",
    inputSchema: {
      name: z.string().min(1).optional().describe("Optional filter by specific length group name."),
      toleranceMm: z.number().positive().optional().describe("Length matching tolerance in mm (default: 0.5)."),
      includeRaw: z.boolean().default(false).describe("Include raw underlying primitive data."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched EasyEDA Pro PCB equal length groups."
  });

  server.registerTool(
    "easyeda_prepare_pcb_net_constraint",
    {
      title: "Prepare PCB net constraint mutation",
      description:
        "Prepares creating, modifying, or deleting net classes, differential pairs, or equal length groups with safety preview, API capability check, and exact confirmation phrase. Does not modify the PCB until confirmed.",
      inputSchema: {
        entity: z
          .enum(["netClass", "differentialPair", "lengthGroup"])
          .describe("Entity type to mutate: 'netClass', 'differentialPair', or 'lengthGroup'."),
        action: z.enum(["create", "modify", "delete"]).describe("Action: 'create', 'modify', or 'delete'."),
        name: z.string().min(1).describe("Name of the net class, differential pair, or length group."),
        nets: z.array(z.string().min(1)).optional().describe("Member net names (for netClass or lengthGroup)."),
        positiveNet: z.string().min(1).optional().describe("Positive net name for differential pair."),
        negativeNet: z.string().min(1).optional().describe("Negative net name for differential pair."),
        targetImpedance: z
          .number()
          .positive()
          .optional()
          .describe("Target differential impedance in Ohms (e.g. 90, 100)."),
        traceWidth: z.number().positive().optional().describe("Trace width in mm."),
        differentialGap: z.number().positive().optional().describe("Differential pair spacing/gap in mm."),
        clearance: z.number().positive().optional().describe("Isolation clearance in mm (for netClass)."),
        viaDiameter: z.number().positive().optional().describe("Via outer diameter in mm (for netClass)."),
        viaHoleDiameter: z.number().positive().optional().describe("Via drill hole diameter in mm (for netClass)."),
        toleranceMm: z.number().positive().optional().describe("Length matching skew tolerance in mm."),
        targetLengthMm: z.number().positive().optional().describe("Target length in mm for length group."),
        properties: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Property modifications dictionary (for modify action)."),
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
    async (params) => {
      try {
        const timeoutMs = params.timeoutMs ?? 30_000;
        const result = (await bridge.call("prepareNetConstraint", params, timeoutMs)) as Record<string, unknown>;

        const mutationId = String(result.mutationId ?? "");
        const confirmation = String(result.confirmation ?? "");
        const preview = (result.preview as { impact?: string; scope?: string }) ?? {};
        const summary = [
          `Prepared PCB ${params.entity} ${params.action} mutation:`,
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
}
