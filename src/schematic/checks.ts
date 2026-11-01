import { findComponent, findNet } from "./connectivity.js";
import {
  canonicalNet,
  formatPin,
  intersects,
  isPresent,
  looksLikePowerNet,
  looksLikePowerPin,
  pinEvidence,
  sameText,
  unique,
  uniqueByPrimitiveId
} from "./normalization.js";
import type {
  Confidence,
  ConnectionCheckInput,
  ConnectionCheckResult,
  EndpointRef,
  EndpointResolution,
  GraphPathStep,
  PassiveConstraint,
  PassiveEdge,
  PassiveGraph,
  PassiveKind,
  SchematicComponent,
  SchematicFinding,
  SchematicPin,
  SchematicSnapshot,
  VerifyConnectionsResult
} from "./types.js";

export function findSuspiciousSimilarPowerNets(snapshot: SchematicSnapshot, allowedNames: Set<string>): SchematicFinding[] {
  const powerNets = snapshot.nets
    .filter((net) => allowedNames.size === 0 || allowedNames.has(net.name))
    .filter((net) => looksLikePowerNet(net.name));
  const findings: SchematicFinding[] = [];
  for (let index = 0; index < powerNets.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < powerNets.length; otherIndex += 1) {
      const left = powerNets[index];
      const right = powerNets[otherIndex];
      if (canonicalNet(left.name) === canonicalNet(right.name) && left.name !== right.name) {
        findings.push({
          severity: "info",
          type: "similar_power_net_names",
          message: `Power nets ${left.name} and ${right.name} look similar; verify they are intentionally separate.`,
          evidence: { nets: [left.name, right.name] }
        });
      }
    }
  }
  return findings;
}

export function findPowerNetsWithoutCapacitors(snapshot: SchematicSnapshot, allowedNames: Set<string>): SchematicFinding[] {
  const capacitorsByNet = new Map<string, number>();
  for (const pin of snapshot.pins) {
    if (pin.net && pin.componentDesignator?.toUpperCase().startsWith("C")) {
      capacitorsByNet.set(pin.net, (capacitorsByNet.get(pin.net) ?? 0) + 1);
    }
  }
  return snapshot.nets
    .filter((net) => allowedNames.size === 0 || allowedNames.has(net.name))
    .filter((net) => looksLikePowerNet(net.name) && net.connectedPins.length > 1 && !capacitorsByNet.has(net.name))
    .map((net) => ({
      severity: "info",
      type: "power_net_without_detected_capacitor",
      message: `Power net ${net.name} has no capacitor pins detected in the normalized data.`,
      evidence: {
        net: net.name,
        connectedPins: net.connectedPins.map(pinEvidence)
      }
    }));
}

export function findUnconnectedPins(
  snapshot: SchematicSnapshot,
  options: { includePowerPins?: boolean; limit?: number } = {}
): {
  pins: SchematicPin[];
  findings: SchematicFinding[];
  confidence: Confidence;
} {
  const includePowerPins = options.includePowerPins ?? true;
  const limit = options.limit ?? 100;
  const pins = snapshot.pins
    .filter((pin) => !pin.connected)
    .filter((pin) => includePowerPins || !looksLikePowerPin(pin))
    .slice(0, limit);

  return {
    pins,
    findings: pins.map((pin) => ({
      severity: "warning",
      type: "pin_without_connection",
      message: `Pin ${formatPin(pin)} has no confirmed electrical connection.`,
      evidence: pinEvidence(pin)
    })),
    confidence: snapshot.pins.length > 0 ? snapshot.confidence : "low"
  };
}

export function validateSchematicArea(
  snapshot: SchematicSnapshot,
  options: { components?: string[]; nets?: string[]; includeGlobalChecks?: boolean } = {}
): {
  findings: SchematicFinding[];
  summary: {
    checkedComponents: number;
    checkedNets: number;
    warnings: number;
    errors: number;
  };
  confidence: Confidence;
} {
  const components = options.components?.length
    ? options.components.map((query) => findComponent(snapshot, query)).filter(isPresent)
    : snapshot.components;
  const nets = options.nets?.length
    ? options.nets.map((query) => findNet(snapshot, query)).filter(isPresent)
    : snapshot.nets;
  const findings: SchematicFinding[] = [];
  const componentIds = new Set(components.map((component) => component.primitiveId));
  const netNames = new Set(nets.map((net) => net.name));

  for (const pin of snapshot.pins) {
    if (components.length > 0 && !componentIds.has(pin.componentPrimitiveId)) {
      continue;
    }
    if (!pin.connected) {
      findings.push({
        severity: "warning",
        type: "pin_without_connection",
        message: `Pin ${formatPin(pin)} has no confirmed electrical connection.`,
        evidence: pinEvidence(pin)
      });
    } else if (!pin.net) {
      findings.push({
        severity: "info",
        type: "pin_on_unnamed_node",
        message: `Pin ${formatPin(pin)} is connected to an unnamed local node.`,
        evidence: pinEvidence(pin)
      });
    }
  }

  for (const net of nets) {
    if (net.connectedPins.length === 1) {
      findings.push({
        severity: "warning",
        type: "single_pin_net",
        message: `Net ${net.name} connects to only one confirmed pin.`,
        evidence: {
          net: net.name,
          pin: net.connectedPins[0] ? pinEvidence(net.connectedPins[0]) : undefined,
          wireCount: net.wires.length,
          labelCount: net.labels.length
        }
      });
    }
  }

  if (options.includeGlobalChecks ?? true) {
    findings.push(...findSuspiciousSimilarPowerNets(snapshot, netNames));
    findings.push(...findPowerNetsWithoutCapacitors(snapshot, netNames));
  }

  return {
    findings,
    summary: {
      checkedComponents: components.length,
      checkedNets: nets.length,
      warnings: findings.filter((finding) => finding.severity === "warning").length,
      errors: findings.filter((finding) => finding.severity === "error").length
    },
    confidence: snapshot.confidence
  };
}

export function passiveKind(component: SchematicComponent): PassiveKind | undefined {
  const designator = component.designator?.toUpperCase() ?? "";
  const text = `${component.name ?? ""} ${component.value ?? ""} ${component.manufacturerId ?? ""}`.toLowerCase();
  if (designator.startsWith("LED") || text.includes("led")) return "led";
  if (designator.startsWith("R") || text.includes("resistor")) return "resistor";
  if (designator.startsWith("C") || text.includes("capacitor")) return "capacitor";
  if (designator.startsWith("L") || text.includes("inductor")) return "inductor";
  if (designator.startsWith("D") || text.includes("diode")) return "diode";
  return undefined;
}

export function buildPassiveGraph(snapshot: SchematicSnapshot): PassiveGraph {
  const edges: PassiveEdge[] = [];
  for (const component of snapshot.components) {
    const kind = passiveKind(component);
    if (!kind || !component.primitiveId) {
      continue;
    }
    const pins = snapshot.pins.filter((pin) => pin.componentPrimitiveId === component.primitiveId && pin.nodeId);
    const nodeIds = unique(pins.map((pin) => pin.nodeId).filter(isPresent));
    if (nodeIds.length !== 2) {
      continue;
    }
    edges.push({
      fromNodeId: nodeIds[0],
      toNodeId: nodeIds[1],
      component,
      pins,
      kind
    });
  }

  const adjacency = new Map<string, PassiveEdge[]>();
  for (const edge of edges) {
    adjacency.set(edge.fromNodeId, [...(adjacency.get(edge.fromNodeId) ?? []), edge]);
    adjacency.set(edge.toNodeId, [...(adjacency.get(edge.toNodeId) ?? []), edge]);
  }
  return { edges, adjacency };
}

export function resolveEndpoint(snapshot: SchematicSnapshot, ref: EndpointRef): EndpointResolution {
  if ("net" in ref) {
    const net = findNet(snapshot, ref.net);
    const nodeIds = net?.nodeIds.length
      ? net.nodeIds
      : unique([
          ...snapshot.pins.filter((pin) => sameText(pin.net, ref.net)).map((pin) => pin.nodeId).filter(isPresent),
          ...snapshot.wires.filter((wire) => sameText(wire.net, ref.net)).map((wire) => wire.nodeId).filter(isPresent)
        ]);
    return {
      ref,
      nodeIds,
      pins: net?.connectedPins ?? [],
      components: [],
      nets: net ? [net.name] : [],
      reason: net ? "Resolved endpoint by net name." : "No matching net was found."
    };
  }

  const component = findComponent(snapshot, ref.component);
  if (!component) {
    return { ref, nodeIds: [], pins: [], components: [], nets: [], reason: "No matching component was found." };
  }
  const pins = snapshot.pins
    .filter(
      (pin) =>
        pin.componentPrimitiveId === component.primitiveId ||
        sameText(pin.componentDesignator, component.designator)
    )
    .filter((pin) => !ref.pin || sameText(pin.pinNumber, ref.pin))
    .filter((pin) => !ref.pinName || sameText(pin.pinName, ref.pinName));
  return {
    ref,
    nodeIds: unique(pins.map((pin) => pin.nodeId).filter(isPresent)),
    pins,
    components: [component],
    nets: unique(pins.map((pin) => pin.net).filter(isPresent)),
    reason: pins.length > 0 ? "Resolved endpoint by component pin." : "Component matched, but no matching pin was found."
  };
}

export function edgeMatchesConstraint(edge: PassiveEdge, constraint: PassiveConstraint): boolean {
  if (constraint.component && !sameText(edge.component.designator, constraint.component)) {
    return false;
  }
  if (constraint.kind && constraint.kind !== "passive") {
    if (constraint.kind === "diode" && edge.kind !== "diode" && edge.kind !== "led") {
      return false;
    }
    if (constraint.kind !== "diode" && edge.kind !== constraint.kind) {
      return false;
    }
  }
  if (constraint.value) {
    const haystack = `${edge.component.value ?? ""} ${edge.component.name ?? ""} ${JSON.stringify(edge.component.raw ?? {})}`.toLowerCase();
    if (!haystack.includes(constraint.value.toLowerCase())) {
      return false;
    }
  }
  return true;
}

export function edgeToPathStep(edge: PassiveEdge): GraphPathStep {
  return {
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    viaComponent: edge.component,
    viaPins: edge.pins,
    passiveKind: edge.kind
  };
}

export function findPassivePath(
  graph: PassiveGraph,
  startNodeIds: string[],
  targetNodeIds: string[],
  constraint: PassiveConstraint | undefined,
  maxHops: number
): GraphPathStep[] | undefined {
  const targets = new Set(targetNodeIds);
  if (startNodeIds.some((nodeId) => targets.has(nodeId)) && !constraint) {
    return [];
  }
  const queue = startNodeIds.map((nodeId) => ({ nodeId, path: [] as PassiveEdge[] }));
  const visited = new Set(startNodeIds);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.path.length >= maxHops) {
      continue;
    }
    for (const edge of graph.adjacency.get(current.nodeId) ?? []) {
      const nextNodeId = edge.fromNodeId === current.nodeId ? edge.toNodeId : edge.fromNodeId;
      const nextPath = [...current.path, edge];
      if (targets.has(nextNodeId) && (!constraint || nextPath.some((item) => edgeMatchesConstraint(item, constraint)))) {
        return nextPath.map(edgeToPathStep);
      }
      const visitKey = `${nextNodeId}:${nextPath.map((item) => item.component.primitiveId).join(">")}`;
      if (!visited.has(visitKey)) {
        visited.add(visitKey);
        queue.push({ nodeId: nextNodeId, path: nextPath });
      }
    }
  }
  return undefined;
}

export function endpointEvidence(
  reason: string,
  endpoints: EndpointResolution[],
  sharedNodeIds: string[] = []
): ConnectionCheckResult {
  return {
    type: "evidence",
    status: "unknown",
    message: reason,
    evidence: {
      endpoints: endpoints.map((endpoint) => endpoint.ref),
      nodeIds: unique([...endpoints.flatMap((endpoint) => endpoint.nodeIds), ...sharedNodeIds]),
      nets: unique(endpoints.flatMap((endpoint) => endpoint.nets)),
      matchedComponents: uniqueByPrimitiveId(endpoints.flatMap((endpoint) => endpoint.components)),
      matchedPins: uniqueByPrimitiveId(endpoints.flatMap((endpoint) => endpoint.pins)),
      reason
    }
  };
}

export function unknownResult(
  check: ConnectionCheckInput,
  reason: string,
  ...endpoints: EndpointResolution[]
): ConnectionCheckResult {
  return {
    id: check.id,
    type: check.type,
    status: "unknown",
    message: reason,
    evidence: endpointEvidence(reason, endpoints).evidence
  };
}

export function verifyConnectionCheck(
  snapshot: SchematicSnapshot,
  graph: PassiveGraph,
  check: ConnectionCheckInput,
  defaultMaxHops: number
): ConnectionCheckResult {
  if (check.type === "pin_connected") {
    const endpoint = resolveEndpoint(snapshot, { component: check.component, pin: check.pin, pinName: check.pinName });
    if (endpoint.pins.length === 0) {
      return unknownResult(check, "No matching pin was found.", endpoint);
    }
    const connectedPins = endpoint.pins.filter((pin) => pin.connected || pin.nodeId || pin.net);
    return {
      id: check.id,
      type: check.type,
      status: connectedPins.length === endpoint.pins.length ? "pass" : connectedPins.length > 0 ? "warning" : "fail",
      message:
        connectedPins.length === endpoint.pins.length
          ? `Pin ${formatPin(endpoint.pins[0])} is connected.`
          : `Pin ${formatPin(endpoint.pins[0])} has no confirmed electrical connection.`,
      evidence: endpointEvidence(
        connectedPins.length > 0 ? "Matched pin has a node or net." : "Matched pin has no node or net.",
        [endpoint]
      ).evidence
    };
  }

  if (check.type === "pin_on_net") {
    const endpoint = resolveEndpoint(snapshot, { component: check.component, pin: check.pin, pinName: check.pinName });
    const netEndpoint = resolveEndpoint(snapshot, { net: check.net });
    if (endpoint.pins.length === 0) {
      return unknownResult(check, "No matching pin was found.", endpoint);
    }
    if (netEndpoint.nodeIds.length === 0) {
      return unknownResult(check, `Net ${check.net} was not found in the snapshot.`, endpoint, netEndpoint);
    }
    const matchingPins = endpoint.pins.filter(
      (pin) => sameText(pin.net, check.net) || intersects([pin.nodeId].filter(isPresent), netEndpoint.nodeIds)
    );
    return {
      id: check.id,
      type: check.type,
      status: matchingPins.length > 0 ? "pass" : "fail",
      message:
        matchingPins.length > 0
          ? `Pin ${formatPin(matchingPins[0])} is on net ${check.net}.`
          : `No matched pin is on net ${check.net}.`,
      evidence: endpointEvidence(
        matchingPins.length > 0 ? "Pin net or node matches the expected net." : "Pin node did not match the expected net node.",
        [endpoint, netEndpoint]
      ).evidence
    };
  }

  if (check.type === "same_node") {
    const left = resolveEndpoint(snapshot, check.left);
    const right = resolveEndpoint(snapshot, check.right);
    if (left.nodeIds.length === 0 || right.nodeIds.length === 0) {
      return unknownResult(check, "One or both endpoints could not be resolved to a node.", left, right);
    }
    const common = left.nodeIds.filter((nodeId) => right.nodeIds.includes(nodeId));
    return {
      id: check.id,
      type: check.type,
      status: common.length > 0 ? "pass" : "fail",
      message: common.length > 0 ? "Endpoints are on the same electrical node." : "Endpoints are not on the same electrical node.",
      evidence: endpointEvidence(
        common.length > 0 ? "Both endpoints share a nodeId." : "No nodeId is shared by the endpoints.",
        [left, right],
        common
      ).evidence
    };
  }

  if (check.type === "path_exists" || check.type === "path_absent") {
    const from = resolveEndpoint(snapshot, check.from);
    const to = resolveEndpoint(snapshot, check.to);
    if (from.nodeIds.length === 0 || to.nodeIds.length === 0) {
      return unknownResult(check, "One or both endpoints could not be resolved to a node.", from, to);
    }
    const path = findPassivePath(graph, from.nodeIds, to.nodeIds, check.through, check.maxHops ?? defaultMaxHops);
    const exists = Boolean(path);
    const shouldExist = check.type === "path_exists";
    return {
      id: check.id,
      type: check.type,
      status: exists === shouldExist ? "pass" : "fail",
      message: exists
        ? "A matching passive path was found between the endpoints."
        : "No matching passive path was found between the endpoints.",
      evidence: {
        ...endpointEvidence(
          exists ? "Passive graph search found a path." : "Passive graph search did not find a path.",
          [from, to]
        ).evidence,
        path: path ?? undefined
      }
    };
  }

  if (check.type === "pull_to_net") {
    const signal = resolveEndpoint(snapshot, check.signal);
    const target = resolveEndpoint(snapshot, { net: check.net });
    if (signal.nodeIds.length === 0 || target.nodeIds.length === 0) {
      return unknownResult(check, "Signal or target net could not be resolved to a node.", signal, target);
    }
    const path = findPassivePath(graph, signal.nodeIds, target.nodeIds, check.through, check.maxHops ?? defaultMaxHops);
    return {
      id: check.id,
      type: check.type,
      status: path ? "pass" : "fail",
      message: path
        ? `Signal has the requested passive path to ${check.net}.`
        : `Signal does not have the requested passive path to ${check.net}.`,
      evidence: {
        ...endpointEvidence(
          path ? "Found a passive pull path to the target net." : "No passive pull path matched the constraint.",
          [signal, target]
        ).evidence,
        path: path ?? undefined
      }
    };
  }

  if (check.type === "decoupled_to_net") {
    const power = resolveEndpoint(snapshot, check.power);
    const reference = resolveEndpoint(snapshot, { net: check.referenceNet });
    if (power.nodeIds.length === 0 || reference.nodeIds.length === 0) {
      return unknownResult(check, "Power endpoint or reference net could not be resolved to a node.", power, reference);
    }
    const through: PassiveConstraint = { kind: "capacitor", value: check.capacitorValue };
    const path = findPassivePath(graph, power.nodeIds, reference.nodeIds, through, check.maxHops ?? defaultMaxHops);
    return {
      id: check.id,
      type: check.type,
      status: path ? "pass" : "fail",
      message: path
        ? `Power endpoint is decoupled to ${check.referenceNet}.`
        : `No matching decoupling capacitor to ${check.referenceNet} was found.`,
      evidence: {
        ...endpointEvidence(
          path ? "Found a capacitor path to the reference net." : "No capacitor path matched the requested reference net.",
          [power, reference]
        ).evidence,
        path: path ?? undefined
      }
    };
  }

  return {
    id: (check as { id?: string }).id,
    type: (check as { type?: string }).type ?? "unknown",
    status: "unknown",
    message: "Unsupported connection check type.",
    evidence: { reason: "The check type is not implemented." }
  };
}

export function verifyConnections(
  snapshot: SchematicSnapshot,
  checks: ConnectionCheckInput[],
  options: { maxHops?: number } = {}
): VerifyConnectionsResult {
  const graph = buildPassiveGraph(snapshot);
  const maxHops = options.maxHops ?? 4;
  const results = checks.map((check) => verifyConnectionCheck(snapshot, graph, check, maxHops));

  return {
    checks: results,
    summary: {
      passed: results.filter((result) => result.status === "pass").length,
      warnings: results.filter((result) => result.status === "warning").length,
      failed: results.filter((result) => result.status === "fail").length,
      unknown: results.filter((result) => result.status === "unknown").length
    },
    confidence: snapshot.confidence
  };
}
