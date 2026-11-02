import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EditorClient } from "../../editor/EditorClient.js";
import { DefaultTimeoutSchema, DocumentTargetSchema, registerReadTool } from "./common.js";

export const EndpointRefSchema = z.union([
  z.object({
    component: z.string().min(1),
    pin: z.string().min(1).optional(),
    pinName: z.string().min(1).optional()
  }),
  z.object({
    net: z.string().min(1)
  })
]);

export const PassiveConstraintSchema = z.object({
  kind: z.enum(["resistor", "capacitor", "inductor", "diode", "led", "passive"]).optional(),
  component: z.string().min(1).optional(),
  value: z.string().min(1).optional()
});

export const ConnectionCheckSchema = z.discriminatedUnion("type", [
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

export function registerSchematicTools(server: McpServer, bridge: EditorClient): void {
  registerReadTool(server, bridge, {
    name: "easyeda_find_component",
    title: "Find EasyEDA Pro component",
    description:
      "Finds a component by designator, name, value, footprint, or property in the active EasyEDA Pro project.",
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
    description:
      "Returns components, pins, nets, wires, labels and provenance. Single-page reads attempt native Protel2 netlist membership and explicitly report geometric fallback.",
    method: "schematicSnapshot",
    inputSchema: {
      includeRaw: z
        .boolean()
        .default(false)
        .describe(
          "Include compact raw EasyEDA API data for fallback reasoning. Defaults to false to minimize token consumption."
        ),
      allPages: z.boolean().default(true).describe("Collect all schematic pages when EasyEDA Pro exposes them."),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched EasyEDA Pro schematic snapshot."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_schematic_nets",
    title: "Get Schematic Native Nets",
    description:
      "Queries native schematic nets from EasyEDA Pro per-sheet or project-wide. Distinguishes native net connectivity from geometric inferences.",
    method: "getSchematicNets",
    inputSchema: {
      pageId: z.string().optional().describe("Filter by schematic sheet/page ID."),
      pageIndex: z.number().int().optional().describe("Filter by schematic sheet/page index."),
      allPages: z.boolean().default(true).describe("Query across all schematic sheets."),
      includeRaw: z.boolean().default(false).describe("Include raw EasyEDA net data in the result."),
      target: DocumentTargetSchema.optional().describe("Expected active schematic target."),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched EasyEDA Pro schematic native nets."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_list_schematic_components",
    title: "List schematic components",
    description:
      "Lists normalized schematic components with designator, value/name, footprint, position, and key properties.",
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
    description:
      "Returns all known pins for a schematic component, including pin number, pin name, position, and net when available.",
    method: "getComponentPins",
    inputSchema: {
      query: z
        .string()
        .min(1)
        .describe("Component designator or text query, such as U1, USB1, or regulator part number."),
      includeRaw: z.boolean().default(true),
      allPages: z.boolean().default(true),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Fetched schematic component pins."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_trace_net",
    title: "Trace EasyEDA Pro net",
    description:
      "Traces net topology, connected pins, wire primitive counts, and connectivity evidence across schematic sheets.",
    method: "traceNet",
    inputSchema: {
      net: z.string().min(1).describe("Net name to trace (e.g. GND, VCC, +3V3, NET_1)."),
      includeRaw: z.boolean().default(false),
      allPages: z.boolean().default(true),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Traced EasyEDA Pro net."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_trace_component",
    title: "Trace EasyEDA Pro component connections",
    description:
      "Traces component pins, connected nets, adjacent components, and confidence ratings for schematic debugging.",
    method: "traceComponent",
    inputSchema: {
      query: z.string().min(1).describe("Component designator or search query to trace (e.g. U1, R1, C3)."),
      includeRaw: z.boolean().default(false),
      allPages: z.boolean().default(true),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Traced EasyEDA Pro component."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_find_unconnected_pins",
    title: "Find unconnected pins",
    description:
      "Scans active schematic sheets for unconnected component pins, reporting potential schematic omissions or dangling inputs.",
    method: "findUnconnectedPins",
    inputSchema: {
      query: z.string().min(1).optional().describe("Optional component designator filter."),
      limit: z.number().int().positive().max(500).default(100),
      includeRaw: z.boolean().default(false),
      allPages: z.boolean().default(true),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Listed unconnected EasyEDA Pro pins."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_run_schematic_erc",
    title: "Run Schematic Electrical Rules Check (ERC)",
    description:
      "Executes native EasyEDA Pro schematic Electrical Rules Check (ERC) on the active document, reporting rule violations, unconnected pins, and design errors.",
    method: "runSchematicErc",
    inputSchema: {
      strict: z.boolean().default(true).describe("Enforce strict electrical rule checking."),
      target: DocumentTargetSchema.optional().describe("Expected active schematic target."),
      timeoutMs: DefaultTimeoutSchema.default(60_000)
    },
    summary: "Executed EasyEDA Pro schematic ERC check."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_validate_schematic_area",
    title: "Validate schematic area",
    description:
      "Evaluates essential circuit patterns around a focus component or region, including power, ground, decoupling, pull-ups, and floating pin rules.",
    method: "validateSchematicArea",
    inputSchema: {
      focusComponent: z.string().min(1).describe("Center component designator (e.g. U1, ESP32, STM32)."),
      expectedPowerNets: z
        .array(z.string().min(1))
        .optional()
        .describe("Allowed power net names (defaults to common VCC/VDD nets)."),
      expectedGroundNets: z
        .array(z.string().min(1))
        .optional()
        .describe("Allowed ground net names (defaults to GND/VSS nets)."),
      includeRaw: z.boolean().default(false),
      allPages: z.boolean().default(true),
      maxHops: z.number().int().positive().max(20).default(4),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Validated EasyEDA Pro schematic area."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_verify_connections",
    title: "Verify schematic connections",
    description:
      "Runs generic read-only connection assertions against the active schematic, including pin/net checks and passive paths through resistors, capacitors, inductors, diodes, or LEDs.",
    method: "verifyConnections",
    inputSchema: {
      checks: z
        .array(ConnectionCheckSchema)
        .min(1)
        .max(50)
        .describe("Structured connection assertions to verify against the active schematic."),
      includeRaw: z.boolean().default(false),
      allPages: z.boolean().default(true),
      maxHops: z.number().int().positive().max(20).default(4),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Verified EasyEDA Pro schematic connections."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_get_schematic_ports_buses",
    title: "Get schematic ports and buses",
    description:
      "Inspects net ports (hierarchical/global sheet connectors), multi-bit buses, and bus entry taps in the active schematic with connection validation and signal range diagnostics.",
    method: "getSchematicPortsBuses",
    inputSchema: {
      target: DocumentTargetSchema.optional().describe(
        "Expected active schematic target to guard against document drift"
      ),
      includePorts: z.boolean().default(true).describe("Whether to include net ports"),
      includeBuses: z.boolean().default(true).describe("Whether to include multi-bit buses"),
      includeBusEntries: z.boolean().default(true).describe("Whether to include bus entry taps"),
      includeRaw: z.boolean().default(false).describe("Whether to include raw primitive records from the editor"),
      timeoutMs: DefaultTimeoutSchema.default(15_000)
    },
    summary: "Fetched EasyEDA Pro schematic net ports and buses."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_compare_schematic_pcb",
    title: "Compare schematic and PCB",
    description:
      "Performs cross-domain discrepancy analysis between Schematic and PCB in EasyEDA Pro. Detects unplaced components, untracked PCB parts, footprint mismatches, pin/pad count discrepancies, unrouted nets, and overall synchronicity score.",
    method: "compareSchematicPcb",
    inputSchema: {
      schematicTarget: DocumentTargetSchema.optional().describe("Expected schematic document target"),
      pcbTarget: DocumentTargetSchema.optional().describe("Expected PCB document target"),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Compared EasyEDA Pro schematic and PCB synchronicity."
  });
}
