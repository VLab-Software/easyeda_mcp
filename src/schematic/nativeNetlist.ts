import type { SchematicPin } from "./types.js";
import { netNodeId } from "./normalization.js";

export type NativeNetlistData = {
  status: "available" | "unavailable" | "unsupported" | "error";
  format: "Protel2";
  text?: string;
  reason?: string;
  ambiguousDesignators?: string[];
};

// Protel2 uses [component records] and (net name, reference-pin records).
// Reject unknown syntax rather than treating an unparsed file as an empty circuit.
export function parseProtel2(text: string): Map<string, string[]> {
  if (text.length > 2_000_000) throw new Error("Native netlist exceeds 2 MB");
  const result = new Map<string, string[]>();
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let mode: "component" | "net" | undefined;
  let name: string | undefined;
  let records = 0;
  for (const line of lines) {
    if (!mode) {
      if (line === "[") mode = "component";
      else if (line === "(") {
        mode = "net";
        name = undefined;
      } else throw new Error("Unsupported Protel2 record");
    } else if ((mode === "component" && line === "]") || (mode === "net" && line === ")")) {
      if (mode === "net" && !name) throw new Error("Empty net record");
      mode = undefined;
      records++;
    } else if (["[", "]", "(", ")"].includes(line)) {
      throw new Error("Malformed Protel2 nesting");
    } else if (mode === "net") {
      if (!name) {
        name = line;
        if (!result.has(name)) result.set(name, []);
      } else {
        if (!line.includes("-")) throw new Error("Unsupported net member");
        result.get(name)!.push(line);
      }
    }
  }
  if (mode || !records) throw new Error("Incomplete or unrecognized Protel2 netlist");
  return result;
}

export function applyNativeNetlist(pins: SchematicPin[], data?: NativeNetlistData) {
  const report = {
    status: data?.status ?? "unavailable",
    format: "Protel2" as const,
    matchedPins: 0,
    conflicts: 0,
    reason: data?.reason
  };
  const warnings: string[] = [];
  if (!data || data.status !== "available" || data.text === undefined) {
    warnings.push(`Native netlist unavailable: ${data?.reason ?? "not collected"}. Connectivity may be inferred.`);
    return { pins, report, warnings };
  }
  let nets: Map<string, string[]>;
  try {
    nets = parseProtel2(data.text);
  } catch (error) {
    report.status = "unsupported";
    report.reason = error instanceof Error ? error.message : String(error);
    warnings.push(`Native netlist was not used: ${report.reason}.`);
    return { pins, report, warnings };
  }
  const byMember = new Map<string, Set<string>>();
  for (const [net, members] of nets)
    for (const member of members) {
      const names = byMember.get(member) ?? new Set<string>();
      names.add(net);
      byMember.set(member, names);
    }
  const ambiguous = new Set(data.ambiguousDesignators);
  const mapped = pins.map((pin) => {
    if (!pin.componentDesignator || !pin.pinNumber || ambiguous.has(pin.componentDesignator)) return pin;
    const names = byMember.get(`${pin.componentDesignator}-${pin.pinNumber}`);
    if (!names?.size) return pin; // Absence does not prove a pin is disconnected.
    if (names.size !== 1) {
      report.conflicts++;
      warnings.push(
        `Native netlist has multiple nets for ${pin.componentDesignator}#${pin.pinNumber}; mapping skipped.`
      );
      return {
        ...pin,
        net: undefined,
        nodeId: undefined,
        connected: undefined,
        netSource: "unknown" as const,
        connectivityEvidence: {
          source: "unknown" as const,
          confidence: "low" as const,
          reason: "Conflicting native net membership"
        }
      };
    }
    const net = [...names][0];
    report.matchedPins++;
    if (pin.net && pin.net !== net) {
      report.conflicts++;
      warnings.push(
        `Native/geometry disagreement for ${pin.componentDesignator}#${pin.pinNumber}: native=${net}, inferred=${pin.net}. Native membership used.`
      );
    }
    return {
      ...pin,
      net,
      nodeId: netNodeId(net),
      connected: true,
      netSource: "native_netlist" as const,
      connectivityEvidence: {
        source: "native_netlist" as const,
        confidence: "high" as const,
        net,
        nodeId: netNodeId(net),
        reason: "Exact unique designator and pin match in native Protel2 netlist"
      }
    };
  });
  if (ambiguous.size) warnings.push("Native mapping skipped for duplicate project designators.");
  if (!report.matchedPins)
    warnings.push(
      "Native netlist contains no unambiguous matches for the collected pins; geometry remains a fallback."
    );
  return { pins: mapped, report, warnings };
}
