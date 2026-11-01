import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EditorClient } from "../../editor/EditorClient.js";
import { DefaultTimeoutSchema, DocumentTargetSchema } from "./common.js";
import { fail, ok } from "../toolResult.js";

export function registerSchematicMutationTools(server: McpServer, bridge: EditorClient): void {
  server.registerTool(
    "easyeda_prepare_schematic_component",
    {
      title: "Prepare Schematic Component Mutation",
      description:
        "Prepares a create, move, update, or delete operation on a schematic component with full preview, ID/designator resolution, and exact confirmation phrase. Does not modify the schematic until confirmed via easyeda_confirmed_action.",
      inputSchema: {
        action: z.enum(["create", "move", "update", "delete"]).describe("Component mutation action to perform"),
        component: z
          .string()
          .optional()
          .describe("Primitive ID or designator (e.g. 'R1', 'U2') for move, update, or delete"),
        target: DocumentTargetSchema.optional().describe("Expected active schematic target to guard against drift"),
        device: z
          .union([z.string(), z.record(z.string(), z.unknown())])
          .optional()
          .describe("Device name, LCSC code, or device query to create (e.g. '10k 0603', 'C1523', 'ESP32')"),
        x: z.number().optional().describe("X coordinate for placement or absolute move"),
        y: z.number().optional().describe("Y coordinate for placement or absolute move"),
        dx: z.number().optional().describe("Relative delta X for move"),
        dy: z.number().optional().describe("Relative delta Y for move"),
        properties: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Key-value properties to update (designator, value, footprint, rotation, mirror, etc.)"),
        designator: z.string().optional().describe("Designator to assign or update (e.g. 'R10')"),
        value: z.string().optional().describe("Component value (e.g. '10k', '100nF')"),
        footprint: z.string().optional().describe("Footprint package name (e.g. '0603', 'SOIC-8')"),
        rotation: z.number().optional().describe("Rotation angle in degrees (0, 90, 180, 270)"),
        mirror: z.boolean().optional().describe("Mirror state"),
        subPartName: z.string().optional().describe("Sub-part name for multi-part components"),
        addIntoBom: z.boolean().default(true).describe("Whether to include in BOM"),
        addIntoPcb: z.boolean().default(true).describe("Whether to forward to PCB"),
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
      component,
      target,
      device,
      x,
      y,
      dx,
      dy,
      properties,
      designator,
      value,
      footprint,
      rotation,
      mirror,
      subPartName,
      addIntoBom,
      addIntoPcb,
      timeoutMs
    }) => {
      try {
        const result = (await bridge.call(
          "prepareSchematicComponent",
          {
            action,
            component,
            target,
            device,
            x,
            y,
            dx,
            dy,
            properties,
            designator,
            value,
            footprint,
            rotation,
            mirror,
            subPartName,
            addIntoBom,
            addIntoPcb
          },
          timeoutMs
        )) as Record<string, unknown>;

        const mutationId = String(result.mutationId ?? "");
        const confirmation = String(result.confirmation ?? "");
        const preview = (result.preview as { impact?: string; scope?: string }) ?? {};
        const summary = [
          `Prepared schematic component mutation '${action}':`,
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
    "easyeda_prepare_schematic_wire",
    {
      title: "Prepare Schematic Wire Mutation",
      description:
        "Prepares a wire creation, modification, deletion, or net label placement operation in EasyEDA Pro with preview, coordinate validation, affected connections check, and exact confirmation phrase. Does not write until confirmed.",
      inputSchema: {
        action: z
          .enum(["createWire", "modifyWire", "deleteWire", "addNetLabel"])
          .describe("Wire mutation action to perform"),
        coordinates: z
          .array(z.number())
          .optional()
          .describe("Flat array of polyline coordinates [x1, y1, x2, y2, ...] (minimum 2 points)"),
        wireId: z.string().optional().describe("Target wire ID for modify or delete"),
        net: z.string().optional().describe("Net name for wire or net label"),
        x: z.number().optional().describe("X coordinate for net label"),
        y: z.number().optional().describe("Y coordinate for net label"),
        kind: z.enum(["label", "flag"]).optional().describe("Kind of net label (label or power/ground flag)"),
        flagType: z.string().optional().describe("Flag type for net flag (Power, Ground, NetPort)"),
        rotation: z.number().optional().describe("Rotation angle for net label or flag"),
        color: z.string().optional().describe("Wire color string"),
        lineWidth: z.number().optional().describe("Wire line width"),
        target: DocumentTargetSchema.optional().describe("Expected active schematic target"),
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
      coordinates,
      wireId,
      net,
      x,
      y,
      kind,
      flagType,
      rotation,
      color,
      lineWidth,
      target,
      timeoutMs
    }) => {
      try {
        const result = (await bridge.call(
          "prepareSchematicWire",
          {
            action,
            coordinates,
            wireId,
            net,
            x,
            y,
            kind,
            flagType,
            rotation,
            color,
            lineWidth,
            target
          },
          timeoutMs
        )) as Record<string, unknown>;

        const mutationId = String(result.mutationId ?? "");
        const confirmation = String(result.confirmation ?? "");
        const preview = (result.preview as { impact?: string; scope?: string }) ?? {};
        const summary = [
          `Prepared schematic wire mutation '${action}':`,
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
    "easyeda_prepare_schematic_port",
    {
      title: "Prepare Schematic Port Mutation",
      description:
        "Prepares a create, modify, or delete operation on a schematic net port (hierarchical/sheet connector) with preview, validation, and exact confirmation phrase. Does not write until confirmed via easyeda_confirmed_action.",
      inputSchema: {
        action: z.enum(["createPort", "modifyPort", "deletePort"]).describe("Port action to perform"),
        name: z.string().optional().describe("Net name for the port (e.g. 'TXD', 'CLK')"),
        portType: z
          .enum(["input", "output", "bidirectional", "unspecified"])
          .optional()
          .describe("Port direction / type"),
        x: z.number().optional().describe("X coordinate for port placement"),
        y: z.number().optional().describe("Y coordinate for port placement"),
        rotation: z.number().optional().describe("Rotation angle in degrees (0, 90, 180, 270)"),
        color: z.string().optional().describe("Port color string"),
        portId: z.string().optional().describe("Target port primitiveId for modify or delete"),
        target: DocumentTargetSchema.optional().describe("Expected active schematic target"),
        timeoutMs: DefaultTimeoutSchema.default(30_000)
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async ({ action, name, portType, x, y, rotation, color, portId, target, timeoutMs }) => {
      try {
        const result = (await bridge.call(
          "prepareSchematicPort",
          {
            action,
            name,
            portType,
            x,
            y,
            rotation,
            color,
            portId,
            target
          },
          timeoutMs
        )) as Record<string, unknown>;

        const mutationId = String(result.mutationId ?? "");
        const confirmation = String(result.confirmation ?? "");
        const preview = (result.preview as { impact?: string; scope?: string }) ?? {};
        const summary = [
          `Prepared schematic port mutation '${action}':`,
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
    "easyeda_prepare_schematic_bus",
    {
      title: "Prepare Schematic Bus Mutation",
      description:
        "Prepares a create, modify, or delete operation on schematic multi-bit buses or diagonal bus entries with syntax parsing, coordinate validation, preview, and exact confirmation phrase. Does not write until confirmed via easyeda_confirmed_action.",
      inputSchema: {
        action: z
          .enum(["createBus", "modifyBus", "deleteBus", "createBusEntry", "deleteBusEntry"])
          .describe("Bus or bus entry action to perform"),
        name: z.string().optional().describe("Bus name with syntax, e.g. 'DATA[0..7]' or 'ADDR[15:0]'"),
        coordinates: z
          .array(z.number())
          .optional()
          .describe("Flat array of coordinates [x1, y1, x2, y2, ...] for bus polyline (min 4 numbers / 2 points)"),
        lineWidth: z.number().optional().describe("Bus stroke width"),
        color: z.string().optional().describe("Bus color string"),
        busId: z.string().optional().describe("Target bus primitive ID for modify, delete, or attaching bus entry"),
        entryId: z.string().optional().describe("Target bus entry primitive ID for delete"),
        startX: z.number().optional().describe("Start X for bus entry tap"),
        startY: z.number().optional().describe("Start Y for bus entry tap"),
        endX: z.number().optional().describe("End X for bus entry tap"),
        endY: z.number().optional().describe("End Y for bus entry tap"),
        rotation: z.number().optional().describe("Rotation angle for bus entry"),
        net: z.string().optional().describe("Net name for tapped signal (e.g. 'DATA0')"),
        wireId: z.string().optional().describe("Primitive ID of wire connected by bus entry"),
        target: DocumentTargetSchema.optional().describe("Expected active schematic target"),
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
      name,
      coordinates,
      lineWidth,
      color,
      busId,
      entryId,
      startX,
      startY,
      endX,
      endY,
      rotation,
      net,
      wireId,
      target,
      timeoutMs
    }) => {
      try {
        const result = (await bridge.call(
          "prepareSchematicBus",
          {
            action,
            name,
            coordinates,
            lineWidth,
            color,
            busId,
            entryId,
            startX,
            startY,
            endX,
            endY,
            rotation,
            net,
            wireId,
            target
          },
          timeoutMs
        )) as Record<string, unknown>;

        const mutationId = String(result.mutationId ?? "");
        const confirmation = String(result.confirmation ?? "");
        const preview = (result.preview as { impact?: string; scope?: string }) ?? {};
        const summary = [
          `Prepared schematic bus mutation '${action}':`,
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
    "easyeda_get_mutation_result",
    {
      title: "Get Mutation Result",
      description:
        "Queries the status, readback evidence, and verification of any prepared or applied mutation by mutationId. Safe and read-only; never automatically replays a mutation.",
      inputSchema: {
        mutationId: z.string().min(1).describe("The mutationId returned during preparation"),
        timeoutMs: DefaultTimeoutSchema.default(10_000)
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ mutationId, timeoutMs }) => {
      try {
        const result = (await bridge.call("getMutationResult", { mutationId }, timeoutMs)) as Record<string, unknown>;
        const status = String(result.status ?? "unknown");
        const domain = String(result.domain ?? "");
        const action = String(result.action ?? "");
        const summary = `Mutation ${mutationId} (${domain}:${action}) status: ${status}.`;
        return ok(summary, result);
      } catch (error) {
        return fail(error);
      }
    }
  );
}
