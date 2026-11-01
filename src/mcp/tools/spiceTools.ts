import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EditorClient } from "../../editor/EditorClient.js";
import { DefaultTimeoutSchema, DocumentTargetSchema, registerReadTool } from "./common.js";

export function registerSpiceTools(server: McpServer, bridge: EditorClient): void {
  registerReadTool(server, bridge, {
    name: "easyeda_evaluate_spice_support",
    title: "Evaluate SPICE simulation feasibility and readiness",
    description:
      "Performs feasibility evaluation of analog SPICE simulation on the active schematic: audits component SPICE model availability, verifies Node 0 / GND reference, checks stimulus sources, and documents engine limits and platform boundaries.",
    method: "evaluateSpiceFeasibility",
    inputSchema: {
      groundNet: z.string().default("GND").describe("Net name expected as ground datum (mapped to SPICE node 0)."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Evaluated SPICE simulation feasibility and readiness."
  });

  registerReadTool(server, bridge, {
    name: "easyeda_generate_spice_netlist",
    title: "Generate standard SPICE netlist",
    description:
      "Generates a syntactically valid SPICE circuit netlist (.cir / .sp) with ground-to-0 normalization, primitive RLC elements, semiconductor models, and configurable analysis directives (.op, .tran, .ac, .dc) for simulation in ngspice, LTspice, or Xyce.",
    method: "generateSpiceNetlist",
    inputSchema: {
      analysisType: z
        .enum(["op", "tran", "ac", "dc"])
        .default("op")
        .describe("Simulation analysis type (.op, .tran, .ac, .dc)."),
      analysisParams: z
        .string()
        .optional()
        .describe("Custom analysis directive arguments (e.g. '1u 10m' for .tran, or '10 1 1Meg' for .ac)."),
      groundNet: z.string().default("GND").describe("Net name to map to SPICE datum node 0."),
      includeSubcircuits: z.boolean().default(true).describe("Whether to include X subcircuit cards for ICs."),
      includeDefaultModels: z.boolean().default(true).describe("Include built-in generic diode and BJT .model cards."),
      fileName: z.string().min(1).optional().describe("Optional output file name without extension."),
      destinationPath: z.string().min(1).optional().describe("Optional destination directory / target path."),
      target: DocumentTargetSchema.optional(),
      timeoutMs: DefaultTimeoutSchema.default(30_000)
    },
    summary: "Generated SPICE circuit netlist."
  });
}
