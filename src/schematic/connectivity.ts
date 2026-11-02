import { applyNativeNetlist } from "./nativeNetlist.js";
import {
  extractSegments,
  formatPin,
  labelTouchesSegments,
  netNodeId,
  normalizeComponent,
  normalizeComponentLabel,
  normalizePin,
  normalizeTextLabel,
  normalizeWire,
  pinEvidence,
  pointTouchesSegment,
  requiredPosition,
  sameText,
  segmentsTouch,
  unique
} from "./normalization.js";
import {
  assertDocumentTargetMatch,
  validateDocumentTarget,
  type DataCompleteness,
  type DataSource,
  type DocumentIdentity
} from "../protocol/identity.js";
import type {
  Confidence,
  ConnectivityGroup,
  RawSchematicData,
  SchematicComponent,
  SchematicFinding,
  SchematicLabel,
  SchematicNet,
  SchematicPin,
  SchematicSnapshot,
  SchematicWire,
  WireWithSegments
} from "./types.js";

export function netConfidence(pins: SchematicPin[], wires: SchematicWire[], labels: SchematicLabel[]): Confidence {
  if (
    pins.some((pin) => pin.connectivityEvidence?.confidence === "high" || pin.netSource === "direct") &&
    wires.length > 0
  ) {
    return "high";
  }
  if (pins.length > 0 || wires.length > 0 || labels.length > 0) {
    return "partial";
  }
  return "low";
}

export function snapshotConfidence(pins: SchematicPin[], wires: SchematicWire[], nets: SchematicNet[]): Confidence {
  if (pins.length === 0 && wires.length === 0) {
    return nets.length > 0 ? "partial" : "low";
  }
  const resolvedPins = pins.filter((pin) => pin.connected || pin.net).length;
  if (pins.length > 0 && wires.length > 0 && resolvedPins / pins.length >= 0.75) {
    return "high";
  }
  return resolvedPins > 0 || nets.length > 0 ? "partial" : "low";
}

export function buildConnectivityGroups(
  wireData: WireWithSegments[],
  labels: SchematicLabel[],
  tolerance: number
): ConnectivityGroup[] {
  const visited = new Set<number>();
  const groups: ConnectivityGroup[] = [];

  for (let index = 0; index < wireData.length; index += 1) {
    if (visited.has(index)) {
      continue;
    }
    const componentIndexes: number[] = [];
    const queue = [index];
    visited.add(index);

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) {
        continue;
      }
      componentIndexes.push(current);
      const currentSegments = wireData[current]?.segments ?? [];
      for (let otherIndex = 0; otherIndex < wireData.length; otherIndex += 1) {
        if (visited.has(otherIndex)) {
          continue;
        }
        const otherSegments = wireData[otherIndex]?.segments ?? [];
        if (segmentsTouch(currentSegments, otherSegments, tolerance)) {
          visited.add(otherIndex);
          queue.push(otherIndex);
        }
      }
    }

    const segments = componentIndexes.flatMap((itemIndex) => wireData[itemIndex]?.segments ?? []);
    const matchingWires = componentIndexes
      .map((itemIndex) => wireData[itemIndex]?.wire)
      .filter((w): w is SchematicWire => w !== undefined);
    const touchingLabels = labels.filter((label) => labelTouchesSegments(label, segments, tolerance));
    const netNames = unique([
      ...matchingWires.map((wire) => wire.net).filter((net): net is string => Boolean(net)),
      ...touchingLabels.map((label) => label.net).filter((net): net is string => Boolean(net))
    ]);

    const primaryNet = netNames[0];
    const wirePrimitiveIds = matchingWires.map((wire) => wire.primitiveId).filter((id): id is string => Boolean(id));
    const labelPrimitiveIds = touchingLabels
      .map((label) => label.primitiveId)
      .filter((id): id is string => Boolean(id));
    const nodeId = primaryNet ? netNodeId(primaryNet) : `node:${wirePrimitiveIds[0] ?? `group_${groups.length + 1}`}`;

    groups.push({
      nodeId,
      wireIndexes: componentIndexes,
      segments,
      net: primaryNet,
      netNames,
      source: touchingLabels.length > 0 ? "label_inferred" : "wire_inferred",
      confidence: netNames.length === 1 ? "high" : "partial",
      wirePrimitiveIds,
      labelPrimitiveIds
    });
  }

  return groups;
}

export function resolvePinConnectivity(
  pin: SchematicPin,
  groups: ConnectivityGroup[],
  tolerance: number
): SchematicPin {
  if (pin.net) {
    const point = requiredPosition(pin.position);
    const touchingGroups = point
      ? groups.filter((group) => group.segments.some((segment) => pointTouchesSegment(point, segment, tolerance)))
      : [];
    const matchingGroup = touchingGroups.find((group) => group.netNames.some((name) => sameText(name, pin.net)));
    return {
      ...pin,
      nodeId: matchingGroup?.nodeId ?? netNodeId(pin.net),
      connected: true,
      connectivityEvidence: {
        ...(pin.connectivityEvidence ?? { source: "direct", confidence: "high" }),
        nodeId: matchingGroup?.nodeId ?? netNodeId(pin.net),
        net: pin.net
      }
    };
  }
  const point = requiredPosition(pin.position);
  if (!point) {
    return {
      ...pin,
      connected: false,
      netSource: "unknown",
      connectivityEvidence: {
        source: "unknown",
        confidence: "low",
        reason: "Pin position is unavailable, so geometry inference cannot run."
      }
    };
  }

  const touchingGroups = groups.filter((group) =>
    group.segments.some((segment) => pointTouchesSegment(point, segment, tolerance))
  );
  const netNames = new Set(touchingGroups.map((group) => group.net).filter((net): net is string => Boolean(net)));
  const nodeIds = unique(touchingGroups.map((group) => group.nodeId));
  if (netNames.size !== 1) {
    return {
      ...pin,
      nodeId: nodeIds.length === 1 ? nodeIds[0] : undefined,
      connected: nodeIds.length === 1,
      netSource: "unknown",
      connectivityEvidence: {
        source: "unknown",
        confidence: nodeIds.length === 1 ? "partial" : "low",
        nodeId: nodeIds.length === 1 ? nodeIds[0] : undefined,
        wirePrimitiveIds: unique(touchingGroups.flatMap((group) => group.wirePrimitiveIds)),
        labelPrimitiveIds: unique(touchingGroups.flatMap((group) => group.labelPrimitiveIds)),
        reason:
          netNames.size > 1
            ? "Pin touches multiple differently named wire groups."
            : nodeIds.length === 1
              ? "Pin touches an unnamed local wire group."
              : "Pin does not touch a wire group."
      }
    };
  }

  const [net] = [...netNames];
  const evidenceGroups = touchingGroups.filter((group) => sameText(group.net, net));
  const source = evidenceGroups.some((group) => group.source === "wire_inferred") ? "wire_inferred" : "label_inferred";
  const confidence = evidenceGroups.every((group) => group.confidence === "high") ? "high" : "partial";
  return {
    ...pin,
    net,
    nodeId: evidenceGroups[0]?.nodeId,
    connected: true,
    netSource: source,
    connectivityEvidence: {
      source,
      confidence,
      net,
      nodeId: evidenceGroups[0]?.nodeId,
      wirePrimitiveIds: unique(evidenceGroups.flatMap((group) => group.wirePrimitiveIds)),
      labelPrimitiveIds: unique(evidenceGroups.flatMap((group) => group.labelPrimitiveIds)),
      reason:
        source === "wire_inferred"
          ? "Pin touches a named schematic wire."
          : "Pin touches a wire group named by a nearby net label."
    }
  };
}

export function resolveConnectivity(
  pins: SchematicPin[],
  wires: SchematicWire[],
  labels: SchematicLabel[],
  tolerance = 0.01
): {
  pins: SchematicPin[];
  wires: SchematicWire[];
  warnings: string[];
} {
  const wireData = wires.map((wire) => ({
    wire,
    segments: extractSegments(wire.geometry)
  }));
  const groups = buildConnectivityGroups(wireData, labels, tolerance);
  const resolvedWires = wires.map((wire, index) => {
    const group = groups.find((item) => item.wireIndexes.includes(index));
    return {
      ...wire,
      nodeId: group?.nodeId ?? (wire.net ? netNodeId(wire.net) : undefined),
      net: wire.net ?? group?.net
    };
  });
  const warnings = groups
    .filter((group) => !group.net && group.wireIndexes.length > 0)
    .map((group) => `Wire group ${group.wirePrimitiveIds.join(", ")} has ambiguous or missing net evidence.`);

  return {
    pins: pins.map((pin) => resolvePinConnectivity(pin, groups, tolerance)),
    wires: resolvedWires,
    warnings
  };
}

export function buildNets(pins: SchematicPin[], wires: SchematicWire[], labels: SchematicLabel[]): SchematicNet[] {
  const names = new Set<string>();
  for (const pin of pins) if (pin.net) names.add(pin.net);
  for (const wire of wires) if (wire.net) names.add(wire.net);
  for (const label of labels) if (label.net) names.add(label.net);

  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const connectedPins = pins.filter((pin) => sameText(pin.net, name));
      const netWires = wires.filter((wire) => sameText(wire.net, name));
      const netLabels = labels.filter((label) => sameText(label.net, name));
      const nodeIds = unique([
        ...connectedPins.map((pin) => pin.nodeId).filter((id): id is string => Boolean(id)),
        ...netWires.map((wire) => wire.nodeId).filter((id): id is string => Boolean(id))
      ]);
      return {
        name,
        connectedPins,
        wires: netWires,
        labels: netLabels,
        nodeIds,
        confidence: netConfidence(connectedPins, netWires, netLabels),
        inferredConnectivity: {
          pinCount: connectedPins.length,
          wireCount: netWires.length,
          labelCount: netLabels.length
        }
      };
    });
}

export function buildSchematicSnapshot(raw: RawSchematicData): SchematicSnapshot {
  const includeRaw = raw.includeRaw ?? true;
  const rawComponents = raw.components ?? [];
  const components = rawComponents.map((component) => normalizeComponent(component, includeRaw));
  const componentById = new Map(components.map((component) => [component.primitiveId, component]));
  const pins: SchematicPin[] = [];

  for (const [componentPrimitiveId, rawPins] of Object.entries(raw.pinsByComponent ?? {})) {
    const component = componentById.get(componentPrimitiveId);
    for (const rawPin of rawPins) {
      pins.push(normalizePin(rawPin, componentPrimitiveId, component?.designator, includeRaw));
    }
  }

  const wires = (raw.wires ?? []).map((wire) => normalizeWire(wire, includeRaw));
  const labels = [
    ...rawComponents.flatMap((component) => normalizeComponentLabel(component, includeRaw)),
    ...(raw.texts ?? []).flatMap((text) => normalizeTextLabel(text, includeRaw))
  ];
  const resolved = resolveConnectivity(pins, wires, labels);
  const native = applyNativeNetlist(resolved.pins, raw.nativeNetlist);
  resolved.pins = native.pins;
  const nets = buildNets(resolved.pins, resolved.wires, labels);
  const warnings: string[] = [];

  if (pins.length === 0 && components.some((component) => component.componentType === "part")) {
    warnings.push("No component pins were returned by EasyEDA Pro; connectivity confidence is low.");
  }
  if (wires.length === 0) {
    warnings.push("No schematic wires were returned by EasyEDA Pro; wire-based checks may be incomplete.");
  }
  warnings.push(...resolved.warnings, ...native.warnings);

  const completeness: DataCompleteness =
    raw.completeness ??
    (components.length > 0 && pins.length > 0
      ? "full"
      : components.length > 0 || wires.length > 0
        ? "partial"
        : "empty");
  const source: DataSource = raw.source ?? raw.target?.source ?? "native_api";
  const capturedAt = raw.capturedAt ?? raw.target?.capturedAt ?? new Date().toISOString();
  const snapshotId = raw.snapshotId ?? `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    snapshotId,
    nativeNetlist: native.report,
    target: raw.target,
    capturedAt,
    source,
    completeness,
    components,
    pins: resolved.pins,
    wires: resolved.wires,
    labels,
    nets,
    counts: {
      components: components.length,
      pins: pins.length,
      wires: wires.length,
      labels: labels.length,
      nets: nets.length
    },
    confidence: snapshotConfidence(resolved.pins, resolved.wires, nets),
    warnings,
    betaApi: true
  };
}

export function isSnapshotFresh(
  snapshot: SchematicSnapshot,
  options?: {
    expectedTarget?: Partial<DocumentIdentity>;
    currentTarget?: Partial<DocumentIdentity>;
    maxAgeMs?: number;
    nowMs?: number;
  }
): boolean {
  if (options?.expectedTarget && snapshot.target) {
    const res = validateDocumentTarget(options.expectedTarget, snapshot.target, {
      maxAgeMs: options.maxAgeMs,
      nowMs: options.nowMs
    });
    if (!res.valid) return false;
  }

  if (options?.currentTarget && snapshot.target) {
    const res = validateDocumentTarget(snapshot.target, options.currentTarget, {
      maxAgeMs: options.maxAgeMs,
      nowMs: options.nowMs
    });
    if (!res.valid) return false;
  }

  if (options?.maxAgeMs && snapshot.capturedAt) {
    const captureTime = Date.parse(snapshot.capturedAt);
    const now = options.nowMs ?? Date.now();
    if (!Number.isNaN(captureTime) && now - captureTime > options.maxAgeMs) {
      return false;
    }
  }

  return true;
}

export function assertSnapshotFresh(
  snapshot: SchematicSnapshot,
  options?: {
    expectedTarget?: Partial<DocumentIdentity>;
    currentTarget?: Partial<DocumentIdentity>;
    maxAgeMs?: number;
    nowMs?: number;
  }
): void {
  if (options?.expectedTarget) {
    assertDocumentTargetMatch(options.expectedTarget, snapshot.target, {
      maxAgeMs: options.maxAgeMs,
      nowMs: options.nowMs
    });
  }

  if (options?.currentTarget) {
    assertDocumentTargetMatch(snapshot.target, options.currentTarget, {
      maxAgeMs: options.maxAgeMs,
      nowMs: options.nowMs
    });
  }

  if (options?.maxAgeMs && snapshot.capturedAt) {
    const captureTime = Date.parse(snapshot.capturedAt);
    const now = options.nowMs ?? Date.now();
    if (!Number.isNaN(captureTime) && now - captureTime > options.maxAgeMs) {
      const error = new Error(
        `Schematic snapshot has expired (age: ${Math.round((now - captureTime) / 1000)}s, max: ${Math.round(options.maxAgeMs / 1000)}s)`
      ) as Error & { code: string };
      error.code = "capture_expired";
      throw error;
    }
  }
}

export function findComponent(snapshot: SchematicSnapshot, query: string): SchematicComponent | undefined {
  const needle = query.toLowerCase();
  return (
    snapshot.components.find((component) => sameText(component.designator, query)) ??
    snapshot.components.find((component) => JSON.stringify(component).toLowerCase().includes(needle))
  );
}

export function findNet(snapshot: SchematicSnapshot, query: string): SchematicNet | undefined {
  return (
    snapshot.nets.find((net) => sameText(net.name, query)) ??
    snapshot.nets.find((net) => net.name.toLowerCase().includes(query.toLowerCase()))
  );
}

export function listSchematicComponents(
  snapshot: SchematicSnapshot,
  query?: string,
  limit = 100
): SchematicComponent[] {
  const needle = query?.trim().toLowerCase();
  const components = needle
    ? snapshot.components.filter((component) => JSON.stringify(component).toLowerCase().includes(needle))
    : snapshot.components;
  return components.slice(0, limit);
}

export function getComponentPins(
  snapshot: SchematicSnapshot,
  query: string
): {
  component?: SchematicComponent;
  pins: SchematicPin[];
  confidence: Confidence;
} {
  const component = findComponent(snapshot, query);
  if (!component) {
    return { pins: [], confidence: "low" };
  }
  const pins = snapshot.pins.filter(
    (pin) =>
      pin.componentPrimitiveId === component.primitiveId || sameText(pin.componentDesignator, component.designator)
  );
  return {
    component,
    pins,
    confidence: pins.length > 0 ? snapshot.confidence : "partial"
  };
}

export function traceComponent(
  snapshot: SchematicSnapshot,
  query: string
): {
  component?: SchematicComponent;
  pins: Array<SchematicPin & { netDetail?: SchematicNet }>;
  findings: SchematicFinding[];
  confidence: Confidence;
} {
  const result = getComponentPins(snapshot, query);
  const pins = result.pins.map((pin) => ({
    ...pin,
    netDetail: pin.net ? findNet(snapshot, pin.net) : undefined
  }));
  const findings = pins
    .filter((pin) => !pin.connected)
    .map((pin): SchematicFinding => ({
      severity: "warning",
      type: "pin_without_connection",
      message: `Pin ${formatPin(pin)} has no confirmed electrical connection.`,
      evidence: pinEvidence(pin)
    }));

  return {
    component: result.component,
    pins,
    findings,
    confidence: result.confidence
  };
}

export function traceNet(
  snapshot: SchematicSnapshot,
  query: string
): {
  net?: SchematicNet;
  matches: SchematicNet[];
  findings: SchematicFinding[];
  confidence: Confidence;
} {
  const matches = snapshot.nets.filter((net) => net.name.toLowerCase().includes(query.toLowerCase()));
  const exact = findNet(snapshot, query) ?? matches[0];
  const findings: SchematicFinding[] = [];

  if (exact && exact.connectedPins.length <= 1 && exact.wires.length <= 1) {
    findings.push({
      severity: "warning",
      type: "single_node_net",
      message: `Net ${exact.name} has very little confirmed connectivity.`,
      evidence: {
        net: exact.name,
        pinCount: exact.connectedPins.length,
        wireCount: exact.wires.length,
        labelCount: exact.labels.length
      }
    });
  }

  return {
    net: exact,
    matches,
    findings,
    confidence: exact ? snapshot.confidence : "low"
  };
}
