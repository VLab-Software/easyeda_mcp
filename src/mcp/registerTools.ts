import * as z from "zod/v4";
import type { EasyEdaBridge } from "../bridge/EasyEdaBridge.js";
import { ok, fail } from "./toolResult.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const DefaultTimeoutSchema = z.number().int().positive().max(120_000).default(10_000);
const EndpointRefSchema = z.union([
  z.object({
    component: z.string().min(1),
    pin: z.string().min(1).optional(),
    pinName: z.string().min(1).optional()
  }),
  z.object({
    net: z.string().min(1)
  })
]);
const PassiveConstraintSchema = z.object({
  kind: z.enum(["resistor", "capacitor", "inductor", "diode", "led", "passive"]).optional(),
  component: z.string().min(1).optional(),
  value: z.string().min(1).optional()
});
const ConnectionCheckSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1).optional(),
    type: z.literal("pin_connected"),
    component: z.string().min(1),
    pin: z.string().min(1).optional(),
    pinName: z.string().min(1).optional()
  }),
  z.object({
    id: z.string().min(1).optional(),
    type: z.literal("pin_on_net"),
    component: z.string().min(1),
    pin: z.string().min(1).optional(),
    pinName: z.string().min(1).optional(),
    net: z.string().min(1)
  }),
  z.object({
    id: z.string().min(1).optional(),
    type: z.literal("same_node"),
    left: EndpointRefSchema,
    right: EndpointRefSchema
  }),
  z.object({
    id: z.string().min(1).optional(),
    type: z.literal("path_exists"),
    from: EndpointRefSchema,
    to: EndpointRefSchema,
    through: PassiveConstraintSchema.optional(),
    maxHops: z.number().int().positive().max(20).optional()
  }),
  z.object({
    id: z.string().min(1).optional(),
    type: z.literal("path_absent"),
    from: EndpointRefSchema,
    to: EndpointRefSchema,
    through: PassiveConstraintSchema.optional(),
    maxHops: z.number().int().positive().max(20).optional()
  }),
  z.object({
    id: z.string().min(1).optional(),
    type: z.literal("pull_to_net"),
    signal: EndpointRefSchema,
    net: z.string().min(1),
    through: PassiveConstraintSchema,
    maxHops: z.number().int().positive().max(20).optional()
  }),
  z.object({
    id: z.string().min(1).optional(),
    type: z.literal("decoupled_to_net"),
    power: EndpointRefSchema,
    referenceNet: z.string().min(1),
    capacitorValue: z.string().min(1).optional(),
    maxHops: z.number().int().positive().max(20).optional()
  })
]);

const mutatingConfirmationRegex = /\bconfirma\b|\bconfirmo\b|\bconfirmed\b|\bi confirm\b/i;

export function hasExplicitMutationConfirmation(confirmation: string): boolean {
  return mutatingConfirmationRegex.test(confirmation);
}

export function registerEasyEdaTools(server: McpServer, bridge: EasyEdaBridge): void {
  server.registerTool(
    "easyeda_live_status",
    {
      title: "EasyEDA Pro live status",
      description: "Checks whether the EasyEDA Pro extension is connected and reports active document/capability information.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => {
      const status = bridge.getStatus();
      return ok(status.connected ? "EasyEDA Pro extension is connected." : "EasyEDA Pro extension is not connected.", {
        status,
        bridgeEndpoint: bridge.endpoint
      });
    }
  );

  registerReadTool(server, bridge, {
    name: "easyeda_get_context",
    title: "Get EasyEDA Pro editor context",
    description: "Summarizes active project, active document, selection, and editor context from the open EasyEDA Pro instance.",
    method: "getContext",
    inputSchema: {
      timeoutMs: DefaultTimeoutSchema
    },
    summary: "Fetched EasyEDA Pro context."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_find_component",
    title: "Find EasyEDA Pro component",
    description: "Finds a component by designator, name, value, footprint, or property in the active EasyEDA Pro project.",
    method: "findComponent",
    inputSchema: {
      query: z.string().min(1).describe("Designator, value, name, footprint, or property text to search for."),
      limit: z.number().int().positive().max(100).default(20),
      timeoutMs: DefaultTimeoutSchema
    },
    summary: "Searched EasyEDA Pro components."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_find_net",
    title: "Find EasyEDA Pro net",
    description: "Finds a net by name and returns available connections or metadata from the active project.",
    method: "findNet",
    inputSchema: {
      query: z.string().min(1).describe("Net name or partial net name to search for."),
      limit: z.number().int().positive().max(100).default(20),
      timeoutMs: DefaultTimeoutSchema
    },
    summary: "Searched EasyEDA Pro nets."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_schematic_snapshot",
    title: "Get EasyEDA Pro schematic snapshot",
    description: "Returns a structured snapshot of the active schematic: components, pins, nets, wires, labels, and confidence metadata.",
    method: "schematicSnapshot",
    inputSchema: {
      includeRaw: z.boolean().default(true).describe("Include compact raw EasyEDA API data for fallback reasoning."),
      allPages: z.boolean().default(true).describe("Collect all schematic pages when EasyEDA Pro exposes them."),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched EasyEDA Pro schematic snapshot."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_list_schematic_components",
    title: "List schematic components",
    description: "Lists normalized schematic components with designator, value/name, footprint, position, and key properties.",
    method: "listSchematicComponents",
    inputSchema: {
      query: z.string().min(1).optional().describe("Optional text filter against component fields."),
      limit: z.number().int().positive().max(500).default(100),
      includeRaw: z.boolean().default(false),
      allPages: z.boolean().default(true),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Listed EasyEDA Pro schematic components."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_component_pins",
    title: "Get schematic component pins",
    description: "Returns all known pins for a schematic component, including pin number, pin name, position, and net when available.",
    method: "getComponentPins",
    inputSchema: {
      query: z.string().min(1).describe("Component designator or text query, such as U1, USB1, or regulator part number."),
      includeRaw: z.boolean().default(true),
      allPages: z.boolean().default(true),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched schematic component pins."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_trace_net",
    title: "Trace schematic net",
    description: "Shows the pins, components, wires, labels, and ports associated with a schematic net.",
    method: "traceNet",
    inputSchema: {
      query: z.string().min(1).describe("Net name or partial net name, such as GND, VCC_5V, or SDA."),
      includeRaw: z.boolean().default(true),
      allPages: z.boolean().default(true),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Traced schematic net."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_trace_component",
    title: "Trace schematic component",
    description: "Groups a schematic component's connections by pin and net, with evidence for each connection.",
    method: "traceComponent",
    inputSchema: {
      query: z.string().min(1).describe("Component designator or text query, such as U1 or USB1."),
      includeRaw: z.boolean().default(true),
      allPages: z.boolean().default(true),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Traced schematic component."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_find_unconnected_pins",
    title: "Find unconnected schematic pins",
    description: "Identifies schematic pins without a confirmed net in the normalized EasyEDA Pro data.",
    method: "findUnconnectedPins",
    inputSchema: {
      includePowerPins: z.boolean().default(true).describe("When false, suppress pins whose names look like power pins."),
      limit: z.number().int().positive().max(500).default(100),
      includeRaw: z.boolean().default(true),
      allPages: z.boolean().default(true),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Found schematic pins without confirmed nets."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_validate_schematic_area",
    title: "Validate schematic area",
    description: "Runs generic read-only schematic checks against selected components/nets or the whole schematic.",
    method: "validateSchematicArea",
    inputSchema: {
      components: z.array(z.string().min(1)).optional().describe("Optional component designators or queries to focus on."),
      nets: z.array(z.string().min(1)).optional().describe("Optional net names or queries to focus on."),
      includeGlobalChecks: z.boolean().default(true),
      includeRaw: z.boolean().default(false),
      allPages: z.boolean().default(true),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Validated EasyEDA Pro schematic area."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_verify_connections",
    title: "Verify schematic connections",
    description: "Runs generic read-only connection assertions against the active schematic, including pin/net checks and passive paths through resistors, capacitors, inductors, diodes, or LEDs.",
    method: "verifyConnections",
    inputSchema: {
      checks: z.array(ConnectionCheckSchema).min(1).max(50).describe("Structured connection assertions to verify against the active schematic."),
      includeRaw: z.boolean().default(false),
      allPages: z.boolean().default(true),
      maxHops: z.number().int().positive().max(20).default(4),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Verified EasyEDA Pro schematic connections."
  });

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

  server.registerTool(
    "easyeda_confirmed_action",
    {
      title: "Confirmed EasyEDA Pro action",
      description: "Runs a mutating EasyEDA Pro action only when the confirmation text explicitly confirms the action.",
      inputSchema: {
        action: z.enum(["save", "importChanges", "autoroute", "autolayout"]),
        confirmation: z.string().describe("Must include an explicit confirmation phrase such as 'confirma salvar'."),
        params: z.record(z.string(), z.unknown()).optional(),
        timeoutMs: DefaultTimeoutSchema.default(60_000)
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async ({ action, confirmation, params, timeoutMs }) => {
      try {
        if (!hasExplicitMutationConfirmation(confirmation)) {
          return fail(new Error(`Action "${action}" was blocked. The confirmation text must explicitly include a confirmation phrase such as "confirma salvar".`));
        }
        const result = await bridge.call("confirmedAction", { action, confirmation, params }, timeoutMs);
        return ok(`Executed confirmed EasyEDA Pro action: ${action}.`, {
          action,
          result
        });
      } catch (error) {
        return fail(error);
      }
    }
  );
}

type ReadToolConfig = {
  name: string;
  title: string;
  description: string;
  method: string;
  inputSchema: z.ZodRawShape;
  summary: string;
};

function registerReadTool(
  server: McpServer,
  bridge: EasyEdaBridge,
  config: ReadToolConfig
): void {
  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      inputSchema: config.inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    } as never,
    async (args: Record<string, unknown>) => {
      try {
        const { timeoutMs, ...params } = args as Record<string, unknown> & { timeoutMs?: number };
        const result = await bridge.call(config.method, params, timeoutMs);
        return ok(config.summary, {
          result
        });
      } catch (error) {
        return fail(error);
      }
    }
  );
}
