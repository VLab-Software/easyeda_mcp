import { isRecord, numeric, pickString, sanitize, stringOrUndefined } from "../helpers.js";

export interface DrcEvidence {
  actual?: string | number;
  expected?: string | number;
  difference?: number;
  description?: string;
  [key: string]: unknown;
}

export interface NormalizedDrcViolation {
  id: string;
  rule: string;
  category: string;
  message: string;
  severity: "error" | "warning";
  primitiveIds: string[];
  layer?: string;
  nets: string[];
  coordinates?: {
    x?: number;
    y?: number;
    x2?: number;
    y2?: number;
  };
  evidence?: DrcEvidence;
  raw: Record<string, unknown> | string;
}

export interface DrcSummary {
  totalViolations: number;
  errors: number;
  warnings: number;
  byRule: Record<string, number>;
  byCategory: Record<string, number>;
  bySeverity: {
    error: number;
    warning: number;
  };
  byLayer: Record<string, number>;
  topViolatedRules: Array<{ rule: string; count: number }>;
}

export interface EditorDrcComparison {
  editorApiQueried: boolean;
  editorErrorCount?: number;
  checkErrorCount: number;
  matched: boolean | null;
  ruleConfigName?: string;
  note: string;
}

/**
 * Classifies rule name and category from rule code, type, or human-readable message.
 */
export function classifyDrcRule(rawRule: string | undefined, message: string): { rule: string; category: string } {
  const combined = `${rawRule ?? ""} ${message}`.toLowerCase();

  if (/clearance|distancia|clear/i.test(combined)) {
    if (/hole|drill|pad/i.test(combined) && /hole/i.test(combined)) {
      return { rule: "HoleClearance", category: "Hole" };
    }
    if (/silk/i.test(combined)) {
      return { rule: "SilkClearance", category: "Silkscreen" };
    }
    return { rule: rawRule && !/general|error/i.test(rawRule) ? rawRule : "Clearance", category: "Clearance" };
  }

  if (/short|curto/i.test(combined)) {
    return { rule: rawRule && !/general|error/i.test(rawRule) ? rawRule : "ShortCircuit", category: "ShortCircuit" };
  }

  if (/unroute|ratsnest|incomplete|open net|desconectad/i.test(combined)) {
    return { rule: rawRule && !/general|error/i.test(rawRule) ? rawRule : "UnroutedNet", category: "Unrouted" };
  }

  if (/width|largura/i.test(combined)) {
    return { rule: rawRule && !/general|error/i.test(rawRule) ? rawRule : "TrackWidth", category: "Geometry" };
  }

  if (/hole|drill|furacao|furo/i.test(combined)) {
    return { rule: rawRule && !/general|error/i.test(rawRule) ? rawRule : "HoleSize", category: "Hole" };
  }

  if (/via/i.test(combined)) {
    return { rule: rawRule && !/general|error/i.test(rawRule) ? rawRule : "ViaDimension", category: "Hole" };
  }

  if (/keepout|restricao/i.test(combined)) {
    return { rule: rawRule && !/general|error/i.test(rawRule) ? rawRule : "KeepoutViolation", category: "Keepout" };
  }

  if (/silk|silkscreen|legenda/i.test(combined)) {
    return { rule: rawRule && !/general|error/i.test(rawRule) ? rawRule : "SilkClearance", category: "Silkscreen" };
  }

  if (/component|courtyard|overlap|colis/i.test(combined)) {
    return { rule: rawRule && !/general|error/i.test(rawRule) ? rawRule : "ComponentClearance", category: "Component" };
  }

  if (/diff|differential/i.test(combined)) {
    return { rule: rawRule && !/general|error/i.test(rawRule) ? rawRule : "DifferentialPair", category: "Geometry" };
  }

  return {
    rule: rawRule && !/general|error/i.test(rawRule) ? rawRule : "General",
    category: "General"
  };
}

/**
 * Extracts coordinates from record fields or embeds inside the message string.
 */
export function extractViolationCoordinates(
  rec: Record<string, unknown>,
  message: string
): { x?: number; y?: number; x2?: number; y2?: number } | undefined {
  const directX = numeric(rec.x ?? rec.coordX ?? rec.x1);
  const directY = numeric(rec.y ?? rec.coordY ?? rec.y1);
  const directX2 = numeric(rec.x2);
  const directY2 = numeric(rec.y2);

  if (directX !== undefined || directY !== undefined) {
    const coords: { x?: number; y?: number; x2?: number; y2?: number } = {};
    if (directX !== undefined) coords.x = directX;
    if (directY !== undefined) coords.y = directY;
    if (directX2 !== undefined) coords.x2 = directX2;
    if (directY2 !== undefined) coords.y2 = directY2;
    return coords;
  }

  // Fallback: look for coordinate pair in message: "(12.34, 56.78)" or "at (12.34, 56.78)"
  const match = message.match(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
  if (match) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      return { x, y };
    }
  }

  return undefined;
}

/**
 * Extracts affected net names from record fields or message string.
 */
export function extractViolationNets(rec: Record<string, unknown>, message: string): string[] {
  const nets = new Set<string>();

  const rawNets = rec.nets ?? rec.netNames ?? rec.net;
  if (Array.isArray(rawNets)) {
    for (const item of rawNets) {
      const s = stringOrUndefined(item);
      if (s) nets.add(s);
    }
  } else {
    const s = stringOrUndefined(rawNets);
    if (s) nets.add(s);
  }

  // Regex extract: "Net <name>" or "Net: <name>" or "(Net <name>)"
  const regex = /(?:Net|net)[:\s]+([A-Za-z0-9_+\-/$]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(message)) !== null) {
    if (match[1] && !["error", "violation", "name"].includes(match[1].toLowerCase())) {
      nets.add(match[1]);
    }
  }

  return Array.from(nets);
}

/**
 * Extracts involved primitive IDs from record fields or message string.
 */
export function extractViolationPrimitiveIds(rec: Record<string, unknown>, message: string): string[] {
  const ids = new Set<string>();

  const rawIds = rec.primitiveIds ?? rec.primitiveId ?? rec.items ?? rec.objects ?? rec.ids;
  if (Array.isArray(rawIds)) {
    for (const item of rawIds) {
      const s = stringOrUndefined(item);
      if (s) ids.add(s);
    }
  } else {
    const s = stringOrUndefined(rawIds);
    if (s) ids.add(s);
  }

  // Regex extract bracketed primitive IDs: "[track-123]" or "[pad-456]"
  const bracketMatch = /\[([A-Za-z0-9_-]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = bracketMatch.exec(message)) !== null) {
    if (m[1]) ids.add(m[1]);
  }

  return Array.from(ids);
}

/**
 * Extracts structured evidence (actual value vs required/expected value).
 */
export function extractViolationEvidence(rec: Record<string, unknown>, message: string): DrcEvidence | undefined {
  let actual = rec.actual ?? rec.current ?? rec.real ?? rec.distance ?? rec.width ?? rec.value;
  let expected = rec.expected ?? rec.required ?? rec.min ?? rec.limit ?? rec.ruleValue;

  if (actual === undefined || expected === undefined) {
    // Attempt regex parsing from message:
    // "actual 0.12mm, required 0.20mm" or "actual: 0.12, expected: 0.2"
    const actualMatch = message.match(/actual[:\s=]+([0-9.]+)\s*(?:mm|mil)?/i);
    const expectedMatch = message.match(/(?:required|expected|min|limit)[:\s=]+([0-9.]+)\s*(?:mm|mil)?/i);
    if (actualMatch) actual = Number(actualMatch[1]);
    if (expectedMatch) expected = Number(expectedMatch[1]);
  }

  if (actual === undefined && expected === undefined) {
    return undefined;
  }

  const evidence: DrcEvidence = {};
  if (actual !== undefined) evidence.actual = actual as string | number;
  if (expected !== undefined) evidence.expected = expected as string | number;

  const numActual = typeof actual === "number" ? actual : Number(actual);
  const numExpected = typeof expected === "number" ? expected : Number(expected);

  if (!Number.isNaN(numActual) && !Number.isNaN(numExpected)) {
    evidence.difference = Number((numActual - numExpected).toFixed(4));
    evidence.description = `Actual value (${numActual}) deviates from expected rule (${numExpected}) by ${evidence.difference}`;
  } else {
    evidence.description = `Actual: ${String(actual)} | Expected: ${String(expected)}`;
  }

  return evidence;
}

/**
 * Normalizes a single raw violation record into a standard NormalizedDrcViolation.
 */
export function normalizeDrcViolation(raw: unknown, index: number): NormalizedDrcViolation {
  if (typeof raw === "string") {
    const message = raw;
    const { rule, category } = classifyDrcRule(undefined, message);
    const coords = extractViolationCoordinates({}, message);
    const nets = extractViolationNets({}, message);
    const primitiveIds = extractViolationPrimitiveIds({}, message);
    const evidence = extractViolationEvidence({}, message);

    return {
      id: `violation-${index + 1}`,
      rule,
      category,
      message,
      severity: /warn/i.test(message) ? "warning" : "error",
      primitiveIds,
      nets,
      coordinates: coords,
      evidence,
      raw: message
    };
  }

  const rec = isRecord(raw) ? (raw as Record<string, unknown>) : {};
  const rawRule = pickString(rec, ["rule", "ruleCode", "code", "type", "ruleType", "name"]);
  const message =
    pickString(rec, ["message", "desc", "description", "text", "detail", "error"]) ?? JSON.stringify(sanitize(rec));

  const { rule, category } = classifyDrcRule(rawRule, message);

  const rawSeverity = String(rec.severity ?? rec.level ?? rec.type ?? "").toLowerCase();
  const severity: "error" | "warning" = rawSeverity.includes("warn") ? "warning" : "error";

  const layer =
    pickString(rec, ["layer", "layerName", "layerId"]) ??
    (typeof rec.layer === "number" ? String(rec.layer) : undefined);
  const coordinates = extractViolationCoordinates(rec, message);
  const nets = extractViolationNets(rec, message);
  const primitiveIds = extractViolationPrimitiveIds(rec, message);
  const evidence = extractViolationEvidence(rec, message);

  const id = pickString(rec, ["id", "violationId", "uuid"]) ?? `violation-${index + 1}`;

  return {
    id,
    rule,
    category,
    message,
    severity,
    primitiveIds,
    layer,
    nets,
    coordinates,
    evidence,
    raw: sanitize(rec) as Record<string, unknown>
  };
}

/**
 * Aggregates summary counts and breakdowns by rule, category, severity, and layer.
 */
export function summarizeDrcViolations(violations: NormalizedDrcViolation[]): DrcSummary {
  const byRule: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byLayer: Record<string, number> = {};
  let errors = 0;
  let warnings = 0;

  for (const v of violations) {
    if (v.severity === "error") {
      errors++;
    } else {
      warnings++;
    }
    byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;
    byCategory[v.category] = (byCategory[v.category] ?? 0) + 1;
    if (v.layer) {
      byLayer[v.layer] = (byLayer[v.layer] ?? 0) + 1;
    }
  }

  const topViolatedRules = Object.entries(byRule)
    .map(([rule, count]) => ({ rule, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalViolations: violations.length,
    errors,
    warnings,
    byRule,
    byCategory,
    bySeverity: { error: errors, warning: warnings },
    byLayer,
    topViolatedRules
  };
}

/**
 * Filters violations by severity and rule/category and limits results.
 */
export function filterAndLimitViolations(
  violations: NormalizedDrcViolation[],
  options: { severity?: string; rule?: string; limit?: number }
): {
  filtered: NormalizedDrcViolation[];
  totalMatches: number;
  warnings: string[];
} {
  const severityFilter = (options.severity ?? "all").toLowerCase();
  const ruleFilter = options.rule?.trim().toLowerCase();
  const limit = options.limit && options.limit > 0 ? options.limit : 100;
  const warnings: string[] = [];

  let result = violations;

  if (severityFilter === "error" || severityFilter === "warning") {
    result = result.filter((v) => v.severity === severityFilter);
  }

  if (ruleFilter) {
    result = result.filter(
      (v) =>
        v.rule.toLowerCase().includes(ruleFilter) ||
        v.category.toLowerCase().includes(ruleFilter) ||
        v.message.toLowerCase().includes(ruleFilter)
    );
  }

  const totalMatches = result.length;

  if (result.length > limit) {
    warnings.push(`Violations output truncated to ${limit} items (total matching: ${totalMatches}).`);
    result = result.slice(0, limit);
  }

  return {
    filtered: result,
    totalMatches,
    warnings
  };
}
