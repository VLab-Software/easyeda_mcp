import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EasyEdaBridge } from "../bridge/EasyEdaBridge.js";

const BooleanArgSchema = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((val) => (typeof val === "boolean" ? val : val === "true"))
  .optional();

export function registerEasyEdaPrompts(server: McpServer, bridge: EasyEdaBridge): void {
  // 1. review_schematic
  server.registerPrompt(
    "review_schematic",
    {
      title: "Schematic Electrical Rule & Best Practices Review",
      description: "Structured electrical checklist reviewing power decoupling, floating digital inputs, open-drain pull-ups, and protection circuits on the open schematic.",
      argsSchema: {
        scope: z.enum(["all", "power", "signals"]).optional().describe("Audit focus scope (all, power rails, or signal lines)"),
        strict: BooleanArgSchema.describe("Flag subtle warnings such as missing testpoints or reference annotations")
      }
    },
    async ({ scope, strict }) => {
      const selectedScope = scope ?? "all";
      const isStrict = strict ?? false;
      const status = bridge.getStatus();

      const instructions = [
        "You are an expert hardware and PCB design engineer conducting a systematic schematic electrical review.",
        "",
        `Target Project: "${status.projectName ?? "Unknown"}" | Active Document: "${status.documentName ?? "Unknown"}"`,
        `Review Scope: ${selectedScope.toUpperCase()} | Strict Mode: ${isStrict ? "ENABLED" : "DISABLED"}`,
        "",
        "### Verification Workflow:",
        "1. Check the active schematic via resource `easyeda://schematic/active` or call `easyeda_schematic_snapshot`.",
        "2. Inspect Power & Decoupling:",
        "   - Verify that every digital/analog IC has decoupling capacitors (typically 100nF ceramic) placed close to its VCC/VDD pins.",
        "   - Verify that high-current or switching regulators have bulk decoupling (10µF+ tantalum/electrolytic).",
        "   - Use `easyeda_verify_connections` with `type: \"decoupled_to_net\"` to assert decoupling on critical power pins.",
        "3. Inspect Inputs & Control Lines:",
        "   - Check for floating inputs on CMOS logic or MCU GPIOs.",
        "   - Verify pull-up resistors on open-drain buses (e.g., I2C SDA/SCL: 2.2k-4.7kΩ) and active-low lines (RESET, EN).",
        "4. Inspect Protection & Interfaces:",
        "   - Check for reverse-polarity protection (diodes/FETs) and TVS/ESD diodes on external connectors (USB, power jacks).",
        "5. Check Net Naming & Connectivity:",
        "   - Call `easyeda_find_unconnected_pins` to catch accidental open nets or dangling pin stubs.",
        "   - Verify that power labels (`GND`, `+3V3`, `+5V`) are not accidentally tied together.",
        "",
        "Summarize findings in a clean table: [Severity (Critical / Warning / Info), Component / Net, Issue, Recommendation]."
      ].join("\n");

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: instructions
            }
          }
        ]
      };
    }
  );

  // 2. audit_pcb_drc
  server.registerPrompt(
    "audit_pcb_drc",
    {
      title: "PCB Design Rule & Layout Audit",
      description: "Automated PCB verification workflow checking native DRC violations, unrouted airwires, track clearances, and layer stackup.",
      argsSchema: {
        focus: z.enum(["all", "clearance", "routing"]).optional().describe("Audit focus: all, clearance violations, or routing status")
      }
    },
    async ({ focus }) => {
      const selectedFocus = focus ?? "all";
      const status = bridge.getStatus();

      const instructions = [
        "You are an expert PCB design and layout engineer performing a physical layout and DRC audit.",
        "",
        `Target Project: "${status.projectName ?? "Unknown"}" | Active Document: "${status.documentName ?? "Unknown"}"`,
        `Audit Focus: ${selectedFocus.toUpperCase()}`,
        "",
        "### Audit Workflow:",
        "1. Read active design constraints via resource `easyeda://pcb/drc-rules` (or tool `easyeda_get_drc_rules`).",
        "2. Execute native PCB DRC check using `easyeda_run_drc` with `strict: true`.",
        "3. Inspect routing completion rate using resource `easyeda://pcb/active` or tool `easyeda_get_routing_status`:",
        "   - List all unrouted nets with remaining ratlines/airwires.",
        "   - For critical nets (GND, power, high-speed signals), check trace lengths and continuity.",
        "4. Inspect layer stackup using resource `easyeda://pcb/layers` or tool `easyeda_get_pcb_layers`:",
        "   - Verify continuous reference ground planes adjacent to high-speed signal layers.",
        "5. Check component placement density via `easyeda_list_pcb_components`.",
        "",
        "Provide a concrete remediation plan for any DRC errors or unrouted tracks detected."
      ].join("\n");

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: instructions
            }
          }
        ]
      };
    }
  );

  // 3. prepare_manufacturing
  server.registerPrompt(
    "prepare_manufacturing",
    {
      title: "Manufacturing Pre-Flight Checklist",
      description: "Pre-flight validation checklist for JLCPCB or SMT assembly: verifies DRC clean, BOM parts availability, and CPL centroid data.",
      argsSchema: {
        manufacturer: z.string().optional().describe("Target fabrication house (default: jlcpcb)")
      }
    },
    async ({ manufacturer }) => {
      const mfr = (manufacturer ?? "jlcpcb").toUpperCase();
      const status = bridge.getStatus();

      const instructions = [
        `You are preparing production manufacturing files for ${mfr} fabrication and SMT assembly.`,
        "",
        `Target Project: "${status.projectName ?? "Unknown"}" | Active Document: "${status.documentName ?? "Unknown"}"`,
        "",
        "### Pre-Flight Checklist:",
        "1. Run `easyeda_run_drc` to guarantee ZERO physical DRC violations before generating outputs.",
        "2. Export and verify the Bill of Materials (BOM) via `easyeda_export_bom`:",
        "   - Ensure all SMT components have valid LCSC part numbers or manufacturer identifiers.",
        "   - Flag missing designators, unassigned footprints, or obsolete parts.",
        "3. Export Pick-and-Place (CPL) centroid data via `easyeda_export_cpl`:",
        "   - Verify that rotation and coordinate origin match the component footprint centroid.",
        "4. Export Gerber production archives via `easyeda_export_gerber`.",
        "5. Export assembly PDF documentation via `easyeda_export_pdf`.",
        "",
        `Verify that all generated files comply with standard ${mfr} manufacturing tolerances.`
      ].join("\n");

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: instructions
            }
          }
        ]
      };
    }
  );

  // 4. trace_circuit_path
  server.registerPrompt(
    "trace_circuit_path",
    {
      title: "Trace Circuit Signal or Power Path",
      description: "Focused signal tracing from source to load across nets and components without loading full schematic data.",
      argsSchema: {
        startNet: z.string().describe("Starting net or power rail name (e.g. VBUS, 3V3, SPI_MOSI)"),
        targetComponent: z.string().optional().describe("Optional destination component designator (e.g. U1, D2)")
      }
    },
    async ({ startNet, targetComponent }) => {
      const instructions = [
        `You are tracing a circuit electrical path starting from net "${startNet}"${targetComponent ? ` towards component "${targetComponent}"` : ""}.`,
        "",
        "### Investigation Steps:",
        `1. Query net details using \`easyeda_trace_net\` for "${startNet}".`,
        "2. Identify all connected components and series elements (resistors, ferrite beads, diodes, switches).",
        "3. For each intermediate series component, trace the opposing pin using `easyeda_trace_component`.",
        "4. Map the complete path and report:",
        "   - Node connections in sequence from origin to load.",
        "   - Estimated impedance or voltage drop through series components.",
        "   - Any potential hazards (missing protection, excessive current on thin traces, floating terminations)."
      ].join("\n");

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: instructions
            }
          }
        ]
      };
    }
  );
}
