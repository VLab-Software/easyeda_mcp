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
