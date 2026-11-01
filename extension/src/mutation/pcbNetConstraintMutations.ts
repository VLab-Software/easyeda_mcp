import {
  apiError,
  ensureApi,
  isRecord,
  numeric,
  optionalCall,
  sanitize,
  stringOrUndefined,
  toArray
} from "../helpers.js";
import { assertDocumentTargetMatch, extractDocumentIdentity } from "../identity.js";
import { fetchPcbTracks } from "./pcbTrackViaMutations.js";
import { extensionMutations } from "./mutationManager.js";
import type { EasyEdaApi } from "../types.js";

function getProp(obj: any, getterNames: string | string[], propNames: string[]): any {
  if (!obj || typeof obj !== "object") return undefined;
  const getters = Array.isArray(getterNames) ? getterNames : [getterNames];
  for (const getter of getters) {
    if (typeof obj[getter] === "function") {
      try {
        const val = obj[getter]();
        if (val !== undefined && val !== null) return val;
      } catch {
        // ignore
      }
    }
  }
  for (const prop of propNames) {
    if (obj[prop] !== undefined && obj[prop] !== null) {
      return obj[prop];
    }
  }
  return undefined;
}

export interface NormalizedNetClass {
  name: string;
  nets: string[];
  netCount: number;
  routingWidth?: number;
  clearance?: number;
  viaDiameter?: number;
  viaHoleDiameter?: number;
  source: "native_api" | "drc_net_rules" | "inferred";
  raw?: Record<string, unknown>;
}

export interface NormalizedDifferentialPair {
  name: string;
  positiveNet: string;
  negativeNet: string;
  targetImpedance?: number;
  traceWidth?: number;
  differentialGap?: number;
  positiveLengthMm?: number;
  negativeLengthMm?: number;
  skewMm?: number;
  toleranceMm: number;
  matched: boolean;
  source: "native_api" | "inferred_naming";
  raw?: Record<string, unknown>;
}

export interface LengthGroupMember {
  net: string;
  lengthMm: number;
  deltaMm: number;
  compliant: boolean;
}

export interface NormalizedLengthGroup {
  name: string;
  nets: string[];
  netCount: number;
  targetLengthMm?: number;
  referenceLengthMm: number;
  longestNet?: string;
  shortestNet?: string;
  maxSkewMm: number;
  toleranceMm: number;
  compliant: boolean;
  members: LengthGroupMember[];
  source: "native_api" | "configured_group";
  raw?: Record<string, unknown>;
}

export type PcbNetConstraintOperation =
  | {
      entity: "netClass";
      action: "create";
      name: string;
      nets: string[];
      routingWidth?: number;
      clearance?: number;
      viaDiameter?: number;
      viaHoleDiameter?: number;
    }
  | {
      entity: "netClass";
      action: "modify";
      name: string;
      properties: {
        nets?: string[];
        routingWidth?: number;
        clearance?: number;
        viaDiameter?: number;
        viaHoleDiameter?: number;
      };
    }
  | {
      entity: "netClass";
      action: "delete";
      name: string;
    }
  | {
      entity: "differentialPair";
      action: "create";
      name: string;
      positiveNet: string;
      negativeNet: string;
      targetImpedance?: number;
      traceWidth?: number;
      differentialGap?: number;
      toleranceMm?: number;
    }
  | {
      entity: "differentialPair";
      action: "modify";
      name: string;
      properties: {
        positiveNet?: string;
        negativeNet?: string;
        targetImpedance?: number;
        traceWidth?: number;
        differentialGap?: number;
        toleranceMm?: number;
      };
    }
  | {
      entity: "differentialPair";
      action: "delete";
      name: string;
    }
  | {
      entity: "lengthGroup";
      action: "create";
      name: string;
      nets: string[];
      toleranceMm?: number;
      targetLengthMm?: number;
    }
  | {
      entity: "lengthGroup";
      action: "modify";
      name: string;
      properties: {
        nets?: string[];
        toleranceMm?: number;
        targetLengthMm?: number;
      };
    }
  | {
      entity: "lengthGroup";
      action: "delete";
      name: string;
    };

/**
 * Normalizes and extracts net classes from native APIs or DRC rule configurations.
 */
export async function fetchPcbNetClasses(
  eda: EasyEdaApi,
  filters: { name?: string; includeRaw?: boolean } = {}
): Promise<{ total: number; classes: NormalizedNetClass[] }> {
  const classes: NormalizedNetClass[] = [];

  // 1. Check native pcb_NetClass
  if (eda.pcb_NetClass?.getAll) {
    try {
      const rawList = toArray(await eda.pcb_NetClass.getAll());
      for (const item of rawList) {
        if (!item || typeof item !== "object") continue;
        const name = String(getProp(item, ["getState_Name", "getName"], ["name", "className"]) ?? "");
        if (!name) continue;

        const nets = toArray(getProp(item, ["getState_Nets", "getNets"], ["nets", "netNames"])).map(String);
        const routingWidth = numeric(getProp(item, "getState_RoutingWidth", ["routingWidth", "trackWidth", "width"]));
        const clearance = numeric(getProp(item, "getState_Clearance", ["clearance", "spacing"]));
        const viaDiameter = numeric(getProp(item, "getState_ViaDiameter", ["viaDiameter", "viaSize"]));
        const viaHoleDiameter = numeric(getProp(item, "getState_ViaHoleDiameter", ["viaHoleDiameter", "viaDrill"]));

        classes.push({
          name,
          nets,
          netCount: nets.length,
          routingWidth,
          clearance,
          viaDiameter,
          viaHoleDiameter,
          source: "native_api",
          ...(filters.includeRaw ? { raw: sanitize(item) as Record<string, unknown> } : {})
        });
      }
    } catch {
      // Fall through to DRC net rules
    }
  }

  // 2. Check DRC netRules if native pcb_NetClass was absent or empty
  if (classes.length === 0 && eda.pcb_Drc?.getNetRules) {
    try {
      const rawRules = toArray(await eda.pcb_Drc.getNetRules());
      for (const rawRule of rawRules) {
        if (!rawRule || typeof rawRule !== "object") continue;
        const rule = rawRule as Record<string, any>;
        const name = String(getProp(rule, ["getState_Name", "getName"], ["name", "ruleName", "netClass"]) ?? "");
        if (!name) continue;

        const nets = toArray(rule.nets ?? rule.netNames ?? (rule.net ? [rule.net] : [])).map(String);
        const routingWidth = numeric(rule.trackWidth ?? rule.routingWidth ?? rule.width);
        const clearance = numeric(rule.clearance ?? rule.spacing);
        const viaDiameter = numeric(rule.viaDiameter ?? rule.viaSize);
        const viaHoleDiameter = numeric(rule.viaHoleDiameter ?? rule.viaDrill);

        classes.push({
          name,
          nets,
          netCount: nets.length,
          routingWidth,
          clearance,
          viaDiameter,
          viaHoleDiameter,
          source: "drc_net_rules",
          ...(filters.includeRaw ? { raw: sanitize(rule) as Record<string, unknown> } : {})
        });
      }
    } catch {
      // Fall through
    }
  }

  // Apply filters
  let filtered = classes;
  if (filters.name) {
    const filterName = filters.name.toLowerCase();
    filtered = filtered.filter((c) => c.name.toLowerCase() === filterName);
  }

  return {
    total: filtered.length,
    classes: filtered
  };
}

/**
 * Inspects differential pairs via native API or heuristic net pairing with physical track length skew.
 */
export async function fetchPcbDifferentialPairs(
  eda: EasyEdaApi,
  filters: { name?: string; toleranceMm?: number; includeRaw?: boolean } = {}
): Promise<{ total: number; pairs: NormalizedDifferentialPair[] }> {
  const defaultTolerance = filters.toleranceMm ?? 0.15;
  const pairs: NormalizedDifferentialPair[] = [];

  // Query actual net lengths from tracks
  const { tracks } = await fetchPcbTracks(eda, { limit: 500 });
  const trackLengthsByNet = new Map<string, number>();
  for (const trk of tracks) {
    if (!trk.net) continue;
    trackLengthsByNet.set(trk.net, (trackLengthsByNet.get(trk.net) ?? 0) + (trk.length ?? 0));
  }

  // Helper to query single net length via pcb_Net if available
  const getNetPhysicalLength = async (netName: string): Promise<number | undefined> => {
    if (eda.pcb_Net?.getNetLength) {
      const len = await optionalCall(() => eda.pcb_Net.getNetLength(netName));
      if (typeof len === "number") return Number(len.toFixed(4));
    }
    const fromTracks = trackLengthsByNet.get(netName);
    return fromTracks !== undefined ? Number(fromTracks.toFixed(4)) : undefined;
  };

  // 1. Native differential pair API
  if (eda.pcb_DifferentialPair?.getAll) {
    try {
      const rawList = toArray(await eda.pcb_DifferentialPair.getAll());
      for (const item of rawList) {
        if (!item || typeof item !== "object") continue;
        const name = String(getProp(item, ["getState_Name", "getName"], ["name", "pairName"]) ?? "");
        const positiveNet = String(
          getProp(item, ["getState_PositiveNet", "getPositiveNet"], ["positiveNet", "posNet", "netP"]) ?? ""
        );
        const negativeNet = String(
          getProp(item, ["getState_NegativeNet", "getNegativeNet"], ["negativeNet", "negNet", "netN"]) ?? ""
        );
        if (!name || !positiveNet || !negativeNet) continue;

        const targetImpedance = numeric(getProp(item, "getState_TargetImpedance", ["targetImpedance", "impedance"]));
        const traceWidth = numeric(getProp(item, "getState_TraceWidth", ["traceWidth", "width"]));
        const differentialGap = numeric(
          getProp(item, "getState_DifferentialGap", ["differentialGap", "gap", "spacing"])
        );
        const tol = numeric(getProp(item, "getState_Tolerance", ["tolerance", "toleranceMm"])) ?? defaultTolerance;

        const posLen = await getNetPhysicalLength(positiveNet);
        const negLen = await getNetPhysicalLength(negativeNet);
        const skew =
          posLen !== undefined && negLen !== undefined ? Number(Math.abs(posLen - negLen).toFixed(4)) : undefined;
        const matched = skew !== undefined ? skew <= tol : true;

        pairs.push({
          name,
          positiveNet,
          negativeNet,
          targetImpedance,
          traceWidth,
          differentialGap,
          positiveLengthMm: posLen,
          negativeLengthMm: negLen,
          skewMm: skew,
          toleranceMm: tol,
          matched,
          source: "native_api",
          ...(filters.includeRaw ? { raw: sanitize(item) as Record<string, unknown> } : {})
        });
      }
    } catch {
      // Fall through to heuristic pairing
    }
  }

  // 2. Fallback: heuristic pairing from net names
  if (pairs.length === 0) {
    let allNetNames: string[];
    if (eda.pcb_Net?.getAllNetsName) {
      allNetNames = toArray(await optionalCall(() => eda.pcb_Net.getAllNetsName())).map(String);
    } else if (eda.pcb_Net?.getAllNetName) {
      allNetNames = toArray(await optionalCall(() => eda.pcb_Net.getAllNetName())).map(String);
    } else {
      allNetNames = Array.from(trackLengthsByNet.keys());
    }

    const netSet = new Set(allNetNames);
    const seen = new Set<string>();

    const pairSuffixes = [
      { pos: "_P", neg: "_N" },
      { pos: "_DP", neg: "_DM" },
      { pos: "_POS", neg: "_NEG" },
      { pos: "+", neg: "-" }
    ];

    for (const net of allNetNames) {
      if (seen.has(net)) continue;

      for (const { pos, neg } of pairSuffixes) {
        if (net.endsWith(pos)) {
          const baseName = net.slice(0, -pos.length);
          const counterpart = baseName + neg;
          if (netSet.has(counterpart) && !seen.has(counterpart)) {
            seen.add(net);
            seen.add(counterpart);

            const posLen = await getNetPhysicalLength(net);
            const negLen = await getNetPhysicalLength(counterpart);
            const skew =
              posLen !== undefined && negLen !== undefined ? Number(Math.abs(posLen - negLen).toFixed(4)) : undefined;
            const matched = skew !== undefined ? skew <= defaultTolerance : true;

            pairs.push({
              name: `DIFF_${baseName}`,
              positiveNet: net,
              negativeNet: counterpart,
              targetImpedance: 90, // standard differential impedance default
              traceWidth: 0.15,
              differentialGap: 0.15,
              positiveLengthMm: posLen,
              negativeLengthMm: negLen,
              skewMm: skew,
              toleranceMm: defaultTolerance,
              matched,
              source: "inferred_naming"
            });
            break;
          }
        }
      }
    }
  }

  let filtered = pairs;
  if (filters.name) {
    const filterName = filters.name.toLowerCase();
    filtered = filtered.filter((p) => p.name.toLowerCase() === filterName);
  }

  return {
    total: filtered.length,
    pairs: filtered
  };
}

/**
 * Inspects equal-length matching groups and measures physical skews.
 */
export async function fetchPcbLengthGroups(
  eda: EasyEdaApi,
  filters: { name?: string; toleranceMm?: number; includeRaw?: boolean } = {}
): Promise<{ total: number; groups: NormalizedLengthGroup[] }> {
  const defaultTolerance = filters.toleranceMm ?? 0.5;
  const groups: NormalizedLengthGroup[] = [];

  // Track lengths
  const { tracks } = await fetchPcbTracks(eda, { limit: 500 });
  const trackLengthsByNet = new Map<string, number>();
  for (const trk of tracks) {
    if (!trk.net) continue;
    trackLengthsByNet.set(trk.net, (trackLengthsByNet.get(trk.net) ?? 0) + (trk.length ?? 0));
  }

  const getNetPhysicalLength = async (netName: string): Promise<number> => {
    if (eda.pcb_Net?.getNetLength) {
      const len = await optionalCall(() => eda.pcb_Net.getNetLength(netName));
      if (typeof len === "number") return Number(len.toFixed(4));
    }
    const fromTracks = trackLengthsByNet.get(netName);
    return fromTracks !== undefined ? Number(fromTracks.toFixed(4)) : 0;
  };

  // 1. Native LengthGroup API
  const lengthGroupApi = (eda as any).pcb_LengthGroup ?? (eda as any).pcb_EqualLengthGroup;
  if (lengthGroupApi && typeof lengthGroupApi.getAll === "function") {
    try {
      const rawList = toArray(await lengthGroupApi.getAll());
      for (const item of rawList) {
        if (!item || typeof item !== "object") continue;
        const name = String(getProp(item, ["getState_Name", "getName"], ["name", "groupName"]) ?? "");
        const nets = toArray(getProp(item, ["getState_Nets", "getNets"], ["nets", "netNames"])).map(String);
        if (!name || nets.length === 0) continue;

        const tol = numeric(getProp(item, "getState_Tolerance", ["tolerance", "toleranceMm"])) ?? defaultTolerance;
        const targetLen = numeric(getProp(item, "getState_TargetLength", ["targetLength", "targetLengthMm"]));

        // Measure member lengths
        const members: LengthGroupMember[] = [];
        let maxLen = 0;
        let minLen = Infinity;
        let longestNet: string | undefined;
        let shortestNet: string | undefined;

        for (const net of nets) {
          const len = await getNetPhysicalLength(net);
          if (len > maxLen) {
            maxLen = len;
            longestNet = net;
          }
          if (len < minLen) {
            minLen = len;
            shortestNet = net;
          }
          members.push({
            net,
            lengthMm: len,
            deltaMm: 0,
            compliant: true
          });
        }

        const refLen = targetLen ?? maxLen;
        let maxSkew = 0;

        for (const m of members) {
          m.deltaMm = Number((m.lengthMm - refLen).toFixed(4));
          const skew = Math.abs(m.lengthMm - refLen);
          m.compliant = skew <= tol;
          if (skew > maxSkew) maxSkew = skew;
        }

        groups.push({
          name,
          nets,
          netCount: nets.length,
          targetLengthMm: targetLen,
          referenceLengthMm: Number(refLen.toFixed(4)),
          longestNet,
          shortestNet,
          maxSkewMm: Number(maxSkew.toFixed(4)),
          toleranceMm: tol,
          compliant: maxSkew <= tol,
          members,
          source: "native_api",
          ...(filters.includeRaw ? { raw: sanitize(item) as Record<string, unknown> } : {})
        });
      }
    } catch {
      // Fall through
    }
  }

  let filtered = groups;
  if (filters.name) {
    const filterName = filters.name.toLowerCase();
    filtered = filtered.filter((g) => g.name.toLowerCase() === filterName);
  }

  return {
    total: filtered.length,
    groups: filtered
  };
}

/**
 * Prepares a PCB net constraint mutation with preview and confirmation phrase.
 */
export async function preparePcbNetConstraintMutation(
  api: () => EasyEdaApi,
  params: Record<string, any>
): Promise<Record<string, unknown>> {
  const eda = api();
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const currentTarget = extractDocumentIdentity(documentInfo, undefined, "native_api");

  const expectedTarget = params.expectedTarget ?? params.target;
  if (expectedTarget) {
    assertDocumentTargetMatch(expectedTarget, currentTarget);
  }
  if (currentTarget.documentType && currentTarget.documentType !== "pcb" && currentTarget.documentType !== "unknown") {
    throw apiError("wrong_document", "Net constraint mutations require an active PCB document.");
  }

  const entity = String(params.entity ?? "").trim();
  const action = String(params.action ?? "")
    .trim()
    .toLowerCase();

  if (!["netClass", "differentialPair", "lengthGroup"].includes(entity)) {
    throw apiError(
      "invalid_parameters",
      "Parameter 'entity' must be 'netClass', 'differentialPair', or 'lengthGroup'."
    );
  }
  if (!["create", "modify", "delete"].includes(action)) {
    throw apiError("invalid_parameters", "Parameter 'action' must be 'create', 'modify', or 'delete'.");
  }

  const name = String(params.name ?? "").trim();
  if (!name) {
    throw apiError("missing_parameters", "Parameter 'name' is required for net constraint mutations.");
  }

  // 1. Net Class
  if (entity === "netClass") {
    if (action === "create") {
      const nets = toArray(params.nets).map(String).filter(Boolean);
      if (nets.length === 0) {
        throw apiError("missing_parameters", "Creating a NetClass requires at least one net in 'nets'.");
      }

      const routingWidth = numeric(params.routingWidth);
      const clearance = numeric(params.clearance);
      const viaDiameter = numeric(params.viaDiameter);
      const viaHoleDiameter = numeric(params.viaHoleDiameter);

      const impact = `Creates NetClass '${name}' with ${nets.length} member net(s) [${nets.join(", ")}].`;
      const operation: PcbNetConstraintOperation = {
        entity: "netClass",
        action: "create",
        name,
        nets,
        routingWidth,
        clearance,
        viaDiameter,
        viaHoleDiameter
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "createNetClass",
        target: currentTarget,
        operation,
        before: { exists: false },
        requestedAfter: { name, nets, routingWidth, clearance, viaDiameter, viaHoleDiameter },
        changedKeys: ["name", "nets", "routingWidth", "clearance", "viaDiameter", "viaHoleDiameter"],
        scope: `netClass:create:${name}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "createNetClass",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "modify") {
      const properties = isRecord(params.properties) ? (params.properties as Record<string, any>) : {};
      const changedKeys = Object.keys(properties);
      if (changedKeys.length === 0) {
        throw apiError("missing_parameters", "Modifying a NetClass requires non-empty 'properties' dictionary.");
      }

      const { classes } = await fetchPcbNetClasses(eda, { name });
      const current = classes[0];
      if (!current) {
        throw apiError("not_found", `NetClass '${name}' not found on active PCB.`);
      }

      const impact = `Modifies NetClass '${name}' properties: ${changedKeys.join(", ")}.`;
      const operation: PcbNetConstraintOperation = {
        entity: "netClass",
        action: "modify",
        name,
        properties
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "modifyNetClass",
        target: currentTarget,
        operation,
        before: current,
        requestedAfter: { ...current, ...properties },
        changedKeys,
        scope: `netClass:modify:${name}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "modifyNetClass",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "delete") {
      const { classes } = await fetchPcbNetClasses(eda, { name });
      const current = classes[0];
      if (!current) {
        throw apiError("not_found", `NetClass '${name}' not found on active PCB.`);
      }

      const impact = `Deletes NetClass '${name}' containing ${current.nets.length} net(s).`;
      const operation: PcbNetConstraintOperation = {
        entity: "netClass",
        action: "delete",
        name
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "deleteNetClass",
        target: currentTarget,
        operation,
        before: current,
        requestedAfter: { exists: false },
        changedKeys: ["exists"],
        scope: `netClass:delete:${name}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "deleteNetClass",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }
  }

  // 2. Differential Pair
  if (entity === "differentialPair") {
    if (action === "create") {
      const positiveNet = stringOrUndefined(params.positiveNet);
      const negativeNet = stringOrUndefined(params.negativeNet);
      if (!positiveNet || !negativeNet) {
        throw apiError("missing_parameters", "Creating a differential pair requires 'positiveNet' and 'negativeNet'.");
      }

      const targetImpedance = numeric(params.targetImpedance) ?? 90;
      const traceWidth = numeric(params.traceWidth);
      const differentialGap = numeric(params.differentialGap);
      const toleranceMm = numeric(params.toleranceMm) ?? 0.15;

      const impact = `Creates differential pair '${name}' (${positiveNet} / ${negativeNet}, target: ${targetImpedance}Ω, tol: ±${toleranceMm}mm).`;
      const operation: PcbNetConstraintOperation = {
        entity: "differentialPair",
        action: "create",
        name,
        positiveNet,
        negativeNet,
        targetImpedance,
        traceWidth,
        differentialGap,
        toleranceMm
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "createDifferentialPair",
        target: currentTarget,
        operation,
        before: { exists: false },
        requestedAfter: { name, positiveNet, negativeNet, targetImpedance, traceWidth, differentialGap, toleranceMm },
        changedKeys: [
          "name",
          "positiveNet",
          "negativeNet",
          "targetImpedance",
          "traceWidth",
          "differentialGap",
          "toleranceMm"
        ],
        scope: `differentialPair:create:${name}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "createDifferentialPair",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "modify") {
      const properties = isRecord(params.properties) ? (params.properties as Record<string, any>) : {};
      const changedKeys = Object.keys(properties);
      if (changedKeys.length === 0) {
        throw apiError(
          "missing_parameters",
          "Modifying a differential pair requires non-empty 'properties' dictionary."
        );
      }

      const { pairs } = await fetchPcbDifferentialPairs(eda, { name });
      const current = pairs[0];
      if (!current) {
        throw apiError("not_found", `Differential pair '${name}' not found on active PCB.`);
      }

      const impact = `Modifies differential pair '${name}' properties: ${changedKeys.join(", ")}.`;
      const operation: PcbNetConstraintOperation = {
        entity: "differentialPair",
        action: "modify",
        name,
        properties
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "modifyDifferentialPair",
        target: currentTarget,
        operation,
        before: current,
        requestedAfter: { ...current, ...properties },
        changedKeys,
        scope: `differentialPair:modify:${name}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "modifyDifferentialPair",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "delete") {
      const { pairs } = await fetchPcbDifferentialPairs(eda, { name });
      const current = pairs[0];
      if (!current) {
        throw apiError("not_found", `Differential pair '${name}' not found on active PCB.`);
      }

      const impact = `Deletes differential pair '${name}'.`;
      const operation: PcbNetConstraintOperation = {
        entity: "differentialPair",
        action: "delete",
        name
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "deleteDifferentialPair",
        target: currentTarget,
        operation,
        before: current,
        requestedAfter: { exists: false },
        changedKeys: ["exists"],
        scope: `differentialPair:delete:${name}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "deleteDifferentialPair",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }
  }

  // 3. Length Group
  if (entity === "lengthGroup") {
    if (action === "create") {
      const nets = toArray(params.nets).map(String).filter(Boolean);
      if (nets.length < 2) {
        throw apiError("missing_parameters", "Creating a length group requires at least 2 member nets in 'nets'.");
      }

      const toleranceMm = numeric(params.toleranceMm) ?? 0.5;
      const targetLengthMm = numeric(params.targetLengthMm);

      const impact = `Creates equal length group '${name}' with ${nets.length} nets [${nets.join(", ")}] (tol: ±${toleranceMm}mm).`;
      const operation: PcbNetConstraintOperation = {
        entity: "lengthGroup",
        action: "create",
        name,
        nets,
        toleranceMm,
        targetLengthMm
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "createLengthGroup",
        target: currentTarget,
        operation,
        before: { exists: false },
        requestedAfter: { name, nets, toleranceMm, targetLengthMm },
        changedKeys: ["name", "nets", "toleranceMm", "targetLengthMm"],
        scope: `lengthGroup:create:${name}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "createLengthGroup",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "modify") {
      const properties = isRecord(params.properties) ? (params.properties as Record<string, any>) : {};
      const changedKeys = Object.keys(properties);
      if (changedKeys.length === 0) {
        throw apiError("missing_parameters", "Modifying a length group requires non-empty 'properties' dictionary.");
      }

      const { groups } = await fetchPcbLengthGroups(eda, { name });
      const current = groups[0];
      if (!current) {
        throw apiError("not_found", `Length group '${name}' not found on active PCB.`);
      }

      const impact = `Modifies length group '${name}' properties: ${changedKeys.join(", ")}.`;
      const operation: PcbNetConstraintOperation = {
        entity: "lengthGroup",
        action: "modify",
        name,
        properties
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "modifyLengthGroup",
        target: currentTarget,
        operation,
        before: current,
        requestedAfter: { ...current, ...properties },
        changedKeys,
        scope: `lengthGroup:modify:${name}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "modifyLengthGroup",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "delete") {
      const { groups } = await fetchPcbLengthGroups(eda, { name });
      const current = groups[0];
      if (!current) {
        throw apiError("not_found", `Length group '${name}' not found on active PCB.`);
      }

      const impact = `Deletes length group '${name}'.`;
      const operation: PcbNetConstraintOperation = {
        entity: "lengthGroup",
        action: "delete",
        name
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "deleteLengthGroup",
        target: currentTarget,
        operation,
        before: current,
        requestedAfter: { exists: false },
        changedKeys: ["exists"],
        scope: `lengthGroup:delete:${name}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "deleteLengthGroup",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }
  }

  throw apiError("invalid_parameters", `Unsupported net constraint mutation '${entity}:${action}'.`);
}

/**
 * Executes a net constraint mutation with verified API check and readback verification.
 */
export async function executePcbNetConstraintMutation(
  api: () => EasyEdaApi,
  op: PcbNetConstraintOperation,
  _before?: unknown
): Promise<{ executed: boolean; readback: Record<string, unknown> }> {
  const eda = api();

  // 1. Net Class
  if (op.entity === "netClass") {
    if (op.action === "create") {
      if (eda.pcb_NetClass?.create) {
        await eda.pcb_NetClass.create({
          name: op.name,
          nets: op.nets,
          routingWidth: op.routingWidth,
          clearance: op.clearance,
          viaDiameter: op.viaDiameter,
          viaHoleDiameter: op.viaHoleDiameter
        });
      } else if (eda.pcb_Drc?.overwriteNetRules) {
        // Fallback to DRC net rules
        const currentRules = toArray((await optionalCall(() => eda.pcb_Drc.getNetRules?.())) ?? []);
        currentRules.push({
          name: op.name,
          nets: op.nets,
          trackWidth: op.routingWidth,
          clearance: op.clearance,
          viaDiameter: op.viaDiameter,
          viaHoleDiameter: op.viaHoleDiameter
        });
        await eda.pcb_Drc.overwriteNetRules(currentRules);
      } else {
        ensureApi("pcb_NetClass", "create", eda);
      }

      // Readback verification
      const { classes } = await fetchPcbNetClasses(eda, { name: op.name });
      const created = classes.find((c) => c.name === op.name);
      if (!created) {
        throw apiError("readback_failed", `Created NetClass '${op.name}' could not be verified on readback.`);
      }

      return {
        executed: true,
        readback: {
          action: "createNetClass",
          name: created.name,
          netCount: created.netCount,
          netClass: created
        }
      };
    }

    if (op.action === "modify") {
      if (eda.pcb_NetClass?.modify) {
        await eda.pcb_NetClass.modify(op.name, op.properties);
      } else {
        ensureApi("pcb_NetClass", "modify", eda);
      }

      // Readback verification
      const { classes } = await fetchPcbNetClasses(eda, { name: op.name });
      const modified = classes.find((c) => c.name === op.name);
      if (!modified) {
        throw apiError("readback_failed", `Modified NetClass '${op.name}' could not be verified on readback.`);
      }

      return {
        executed: true,
        readback: {
          action: "modifyNetClass",
          name: modified.name,
          netClass: modified
        }
      };
    }

    if (op.action === "delete") {
      if (eda.pcb_NetClass?.delete) {
        await eda.pcb_NetClass.delete(op.name);
      } else {
        ensureApi("pcb_NetClass", "delete", eda);
      }

      // Readback verification: ensure it no longer exists
      const { classes } = await fetchPcbNetClasses(eda, { name: op.name });
      const stillExists = classes.some((c) => c.name === op.name);
      if (stillExists) {
        throw apiError("readback_failed", `NetClass '${op.name}' was not deleted successfully.`);
      }

      return {
        executed: true,
        readback: {
          action: "deleteNetClass",
          name: op.name,
          deleted: true
        }
      };
    }
  }

  // 2. Differential Pair
  if (op.entity === "differentialPair") {
    if (op.action === "create") {
      if (eda.pcb_DifferentialPair?.create) {
        await eda.pcb_DifferentialPair.create({
          name: op.name,
          positiveNet: op.positiveNet,
          negativeNet: op.negativeNet,
          targetImpedance: op.targetImpedance,
          traceWidth: op.traceWidth,
          differentialGap: op.differentialGap,
          toleranceMm: op.toleranceMm
        });
      } else {
        ensureApi("pcb_DifferentialPair", "create", eda);
      }

      // Readback verification
      const { pairs } = await fetchPcbDifferentialPairs(eda, { name: op.name });
      const created = pairs.find((p) => p.name === op.name);
      if (!created) {
        throw apiError("readback_failed", `Created differential pair '${op.name}' could not be verified on readback.`);
      }

      return {
        executed: true,
        readback: {
          action: "createDifferentialPair",
          name: created.name,
          positiveNet: created.positiveNet,
          negativeNet: created.negativeNet,
          pair: created
        }
      };
    }

    if (op.action === "modify") {
      if (eda.pcb_DifferentialPair?.modify) {
        await eda.pcb_DifferentialPair.modify(op.name, op.properties);
      } else {
        ensureApi("pcb_DifferentialPair", "modify", eda);
      }

      const { pairs } = await fetchPcbDifferentialPairs(eda, { name: op.name });
      const modified = pairs.find((p) => p.name === op.name);
      if (!modified) {
        throw apiError("readback_failed", `Modified differential pair '${op.name}' could not be verified on readback.`);
      }

      return {
        executed: true,
        readback: {
          action: "modifyDifferentialPair",
          name: modified.name,
          pair: modified
        }
      };
    }

    if (op.action === "delete") {
      if (eda.pcb_DifferentialPair?.delete) {
        await eda.pcb_DifferentialPair.delete(op.name);
      } else {
        ensureApi("pcb_DifferentialPair", "delete", eda);
      }

      const { pairs } = await fetchPcbDifferentialPairs(eda, { name: op.name });
      const stillExists = pairs.some((p) => p.name === op.name && p.source === "native_api");
      if (stillExists) {
        throw apiError("readback_failed", `Differential pair '${op.name}' was not deleted successfully.`);
      }

      return {
        executed: true,
        readback: {
          action: "deleteDifferentialPair",
          name: op.name,
          deleted: true
        }
      };
    }
  }

  // 3. Length Group
  if (op.entity === "lengthGroup") {
    const lengthGroupApi = (eda as any).pcb_LengthGroup ?? (eda as any).pcb_EqualLengthGroup;

    if (op.action === "create") {
      if (lengthGroupApi?.create) {
        await lengthGroupApi.create({
          name: op.name,
          nets: op.nets,
          toleranceMm: op.toleranceMm,
          targetLengthMm: op.targetLengthMm
        });
      } else {
        ensureApi("pcb_LengthGroup", "create", eda);
      }

      const { groups } = await fetchPcbLengthGroups(eda, { name: op.name });
      const created = groups.find((g) => g.name === op.name);
      if (!created) {
        throw apiError("readback_failed", `Created length group '${op.name}' could not be verified on readback.`);
      }

      return {
        executed: true,
        readback: {
          action: "createLengthGroup",
          name: created.name,
          netCount: created.netCount,
          group: created
        }
      };
    }

    if (op.action === "modify") {
      if (lengthGroupApi?.modify) {
        await lengthGroupApi.modify(op.name, op.properties);
      } else {
        ensureApi("pcb_LengthGroup", "modify", eda);
      }

      const { groups } = await fetchPcbLengthGroups(eda, { name: op.name });
      const modified = groups.find((g) => g.name === op.name);
      if (!modified) {
        throw apiError("readback_failed", `Modified length group '${op.name}' could not be verified on readback.`);
      }

      return {
        executed: true,
        readback: {
          action: "modifyLengthGroup",
          name: modified.name,
          group: modified
        }
      };
    }

    if (op.action === "delete") {
      if (lengthGroupApi?.delete) {
        await lengthGroupApi.delete(op.name);
      } else {
        ensureApi("pcb_LengthGroup", "delete", eda);
      }

      const { groups } = await fetchPcbLengthGroups(eda, { name: op.name });
      const stillExists = groups.some((g) => g.name === op.name);
      if (stillExists) {
        throw apiError("readback_failed", `Length group '${op.name}' was not deleted successfully.`);
      }

      return {
        executed: true,
        readback: {
          action: "deleteLengthGroup",
          name: op.name,
          deleted: true
        }
      };
    }
  }

  throw apiError("invalid_parameters", "Unsupported net constraint mutation operation.");
}
