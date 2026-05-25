export type Confidence = "high" | "partial" | "low";

export type Position = {
  x?: number;
  y?: number;
};

export type ConnectivitySource = "direct" | "wire_inferred" | "label_inferred" | "unknown";

export type ConnectivityEvidence = {
  source: ConnectivitySource;
  confidence: Confidence;
  net?: string;
  nodeId?: string;
  wirePrimitiveIds?: string[];
  labelPrimitiveIds?: string[];
  reason?: string;
};

export type SchematicComponent = {
  primitiveId?: string;
  designator?: string;
  value?: string;
  name?: string;
  componentType?: string;
  footprint?: unknown;
  manufacturer?: string;
  manufacturerId?: string;
  position: Position;
  raw?: unknown;
};

export type SchematicPin = {
  primitiveId?: string;
  componentPrimitiveId?: string;
  componentDesignator?: string;
  pinNumber?: string;
  pinName?: string;
  net?: string;
  nodeId?: string;
  connected?: boolean;
  netSource?: ConnectivitySource;
  connectivityEvidence?: ConnectivityEvidence;
  position: Position;
  raw?: unknown;
};

export type SchematicWire = {
  primitiveId?: string;
  net?: string;
  nodeId?: string;
  geometry?: unknown;
  endpoints?: Position[];
  raw?: unknown;
};

export type SchematicLabel = {
  primitiveId?: string;
  net?: string;
  type?: string;
  position: Position;
  raw?: unknown;
};

export type SchematicNet = {
  name: string;
  connectedPins: SchematicPin[];
  wires: SchematicWire[];
  labels: SchematicLabel[];
  nodeIds: string[];
  confidence: Confidence;
  inferredConnectivity: {
    pinCount: number;
    wireCount: number;
    labelCount: number;
  };
};

export type SchematicSnapshot = {
  components: SchematicComponent[];
  pins: SchematicPin[];
  wires: SchematicWire[];
  labels: SchematicLabel[];
  nets: SchematicNet[];
  counts: {
    components: number;
    pins: number;
    wires: number;
    labels: number;
    nets: number;
  };
  confidence: Confidence;
  warnings: string[];
  betaApi: true;
};

export type RawSchematicData = {
  components?: unknown[];
  pinsByComponent?: Record<string, unknown[]>;
  wires?: unknown[];
  texts?: unknown[];
  includeRaw?: boolean;
};

export type SchematicFinding = {
  severity: "info" | "warning" | "error";
  type: string;
  message: string;
  evidence: Record<string, unknown>;
};

export type EndpointRef =
  | { component: string; pin?: string; pinName?: string }
  | { net: string };

export type PassiveKind = "resistor" | "capacitor" | "inductor" | "diode" | "led" | "passive";

export type PassiveConstraint = {
  kind?: PassiveKind;
  component?: string;
  value?: string;
};

export type ConnectionCheckInput =
  | {
      id?: string;
      type: "pin_connected";
      component: string;
      pin?: string;
      pinName?: string;
    }
  | {
      id?: string;
      type: "pin_on_net";
      component: string;
      pin?: string;
      pinName?: string;
      net: string;
    }
  | {
      id?: string;
      type: "same_node";
      left: EndpointRef;
      right: EndpointRef;
    }
  | {
      id?: string;
      type: "path_exists";
      from: EndpointRef;
      to: EndpointRef;
      through?: PassiveConstraint;
      maxHops?: number;
    }
  | {
      id?: string;
      type: "path_absent";
      from: EndpointRef;
      to: EndpointRef;
      through?: PassiveConstraint;
      maxHops?: number;
    }
  | {
      id?: string;
      type: "pull_to_net";
      signal: EndpointRef;
      net: string;
      through: PassiveConstraint;
      maxHops?: number;
    }
  | {
      id?: string;
      type: "decoupled_to_net";
      power: EndpointRef;
      referenceNet: string;
      capacitorValue?: string;
      maxHops?: number;
    };

export type GraphPathStep = {
  fromNodeId: string;
  toNodeId: string;
  viaComponent?: SchematicComponent;
  viaPins?: SchematicPin[];
  passiveKind?: PassiveKind;
};

export type ConnectionCheckResult = {
  id?: string;
  type: string;
  status: "pass" | "warning" | "fail" | "unknown";
  message: string;
  evidence: {
    endpoints?: unknown[];
    nodeIds?: string[];
    nets?: string[];
    path?: GraphPathStep[];
    matchedComponents?: SchematicComponent[];
    matchedPins?: SchematicPin[];
    reason: string;
  };
};

export type VerifyConnectionsResult = {
  checks: ConnectionCheckResult[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
    unknown: number;
  };
  confidence: Confidence;
};

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
  const nets = buildNets(resolved.pins, resolved.wires, labels);
  const warnings: string[] = [];

  if (pins.length === 0 && components.some((component) => component.componentType === "part")) {
    warnings.push("No component pins were returned by EasyEDA Pro; connectivity confidence is low.");
  }
  if (wires.length === 0) {
    warnings.push("No schematic wires were returned by EasyEDA Pro; wire-based checks may be incomplete.");
  }
  warnings.push(...resolved.warnings);

  return {
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

export function listSchematicComponents(snapshot: SchematicSnapshot, query?: string, limit = 100): SchematicComponent[] {
  const needle = query?.trim().toLowerCase();
  const components = needle
    ? snapshot.components.filter((component) => JSON.stringify(component).toLowerCase().includes(needle))
    : snapshot.components;
  return components.slice(0, limit);
}

export function getComponentPins(snapshot: SchematicSnapshot, query: string): {
  component?: SchematicComponent;
  pins: SchematicPin[];
  confidence: Confidence;
} {
  const component = findComponent(snapshot, query);
  if (!component) {
    return { pins: [], confidence: "low" };
  }
  const pins = snapshot.pins.filter((pin) => pin.componentPrimitiveId === component.primitiveId || sameText(pin.componentDesignator, component.designator));
  return {
    component,
    pins,
    confidence: pins.length > 0 ? snapshot.confidence : "partial"
  };
}

export function traceComponent(snapshot: SchematicSnapshot, query: string): {
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

export function traceNet(snapshot: SchematicSnapshot, query: string): {
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

export function findUnconnectedPins(snapshot: SchematicSnapshot, options: { includePowerPins?: boolean; limit?: number } = {}): {
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
  const components = options.components?.length ? options.components.map((query) => findComponent(snapshot, query)).filter(isPresent) : snapshot.components;
  const nets = options.nets?.length ? options.nets.map((query) => findNet(snapshot, query)).filter(isPresent) : snapshot.nets;
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

type PassiveEdge = {
  fromNodeId: string;
  toNodeId: string;
  component: SchematicComponent;
  pins: SchematicPin[];
  kind: PassiveKind;
};

type PassiveGraph = {
  edges: PassiveEdge[];
  adjacency: Map<string, PassiveEdge[]>;
};

type EndpointResolution = {
  ref: EndpointRef;
  nodeIds: string[];
  pins: SchematicPin[];
  components: SchematicComponent[];
  nets: string[];
  reason?: string;
};

function verifyConnectionCheck(
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
      message: connectedPins.length === endpoint.pins.length
        ? `Pin ${formatPin(endpoint.pins[0])} is connected.`
        : `Pin ${formatPin(endpoint.pins[0])} has no confirmed electrical connection.`,
      evidence: endpointEvidence(connectedPins.length > 0 ? "Matched pin has a node or net." : "Matched pin has no node or net.", [endpoint]).evidence
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
    const matchingPins = endpoint.pins.filter((pin) => sameText(pin.net, check.net) || intersects([pin.nodeId].filter(isPresent), netEndpoint.nodeIds));
    return {
      id: check.id,
      type: check.type,
      status: matchingPins.length > 0 ? "pass" : "fail",
      message: matchingPins.length > 0
        ? `Pin ${formatPin(matchingPins[0])} is on net ${check.net}.`
        : `No matched pin is on net ${check.net}.`,
      evidence: endpointEvidence(matchingPins.length > 0 ? "Pin net or node matches the expected net." : "Pin node did not match the expected net node.", [endpoint, netEndpoint]).evidence
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
      evidence: endpointEvidence(common.length > 0 ? "Both endpoints share a nodeId." : "No nodeId is shared by the endpoints.", [left, right], common).evidence
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
        ...endpointEvidence(exists ? "Passive graph search found a path." : "Passive graph search did not find a path.", [from, to]).evidence,
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
      message: path ? `Signal has the requested passive path to ${check.net}.` : `Signal does not have the requested passive path to ${check.net}.`,
      evidence: {
        ...endpointEvidence(path ? "Found a passive pull path to the target net." : "No passive pull path matched the constraint.", [signal, target]).evidence,
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
      message: path ? `Power endpoint is decoupled to ${check.referenceNet}.` : `No matching decoupling capacitor to ${check.referenceNet} was found.`,
      evidence: {
        ...endpointEvidence(path ? "Found a capacitor path to the reference net." : "No capacitor path matched the requested reference net.", [power, reference]).evidence,
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

function buildPassiveGraph(snapshot: SchematicSnapshot): PassiveGraph {
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

function resolveEndpoint(snapshot: SchematicSnapshot, ref: EndpointRef): EndpointResolution {
  if ("net" in ref) {
    const net = findNet(snapshot, ref.net);
    const nodeIds = net?.nodeIds.length ? net.nodeIds : unique([
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
    .filter((pin) => pin.componentPrimitiveId === component.primitiveId || sameText(pin.componentDesignator, component.designator))
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

function findPassivePath(
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

function edgeToPathStep(edge: PassiveEdge): GraphPathStep {
  return {
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    viaComponent: edge.component,
    viaPins: edge.pins,
    passiveKind: edge.kind
  };
}

function passiveKind(component: SchematicComponent): PassiveKind | undefined {
  const designator = component.designator?.toUpperCase() ?? "";
  const text = `${component.name ?? ""} ${component.value ?? ""} ${component.manufacturerId ?? ""}`.toLowerCase();
  if (designator.startsWith("LED") || text.includes("led")) return "led";
  if (designator.startsWith("R") || text.includes("resistor")) return "resistor";
  if (designator.startsWith("C") || text.includes("capacitor")) return "capacitor";
  if (designator.startsWith("L") || text.includes("inductor")) return "inductor";
  if (designator.startsWith("D") || text.includes("diode")) return "diode";
  return undefined;
}

function edgeMatchesConstraint(edge: PassiveEdge, constraint: PassiveConstraint): boolean {
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

function unknownResult(check: ConnectionCheckInput, reason: string, ...endpoints: EndpointResolution[]): ConnectionCheckResult {
  return {
    id: check.id,
    type: check.type,
    status: "unknown",
    message: reason,
    evidence: endpointEvidence(reason, endpoints).evidence
  };
}

function endpointEvidence(reason: string, endpoints: EndpointResolution[], sharedNodeIds: string[] = []): ConnectionCheckResult {
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

function normalizeComponent(raw: unknown, includeRaw: boolean): SchematicComponent {
  const item = asRecord(raw);
  const otherProperty = asRecord(item.otherProperty);
  return {
    primitiveId: stringValue(item.primitiveId ?? item.id ?? item.uuid),
    designator: stringValue(item.designator ?? item.prefix ?? item.name),
    value: stringValue(item.value ?? otherProperty.Value ?? item.comment),
    name: stringValue(item.name ?? item.subPartName ?? item.title),
    componentType: stringValue(item.componentType ?? item.primitiveType),
    footprint: item.footprint,
    manufacturer: stringValue(item.manufacturer ?? otherProperty.Manufacturer),
    manufacturerId: stringValue(item.manufacturerId ?? otherProperty["Manufacturer Part"]),
    position: {
      x: numberValue(item.x),
      y: numberValue(item.y)
    },
    raw: includeRaw ? compactRaw(item) : undefined
  };
}

function normalizePin(raw: unknown, componentPrimitiveId: string, componentDesignator: string | undefined, includeRaw: boolean): SchematicPin {
  const item = asRecord(raw);
  const net = normalizeNetName(item.net ?? item.netName ?? item.network);
  return {
    primitiveId: stringValue(item.primitiveId ?? item.id ?? item.uuid),
    componentPrimitiveId,
    componentDesignator: stringValue(item.componentDesignator ?? item.designator ?? componentDesignator),
    pinNumber: stringValue(item.pinNumber ?? item.number ?? item.num ?? item.no),
    pinName: stringValue(item.pinName ?? item.name ?? item.label ?? item.displayName),
    net,
    netSource: net ? "direct" : "unknown",
    connectivityEvidence: net
      ? {
        source: "direct",
        confidence: "high",
        net,
        reason: "EasyEDA returned a net directly on the pin."
      }
      : {
        source: "unknown",
        confidence: "low",
        reason: "No direct net was returned for this pin."
      },
    position: {
      x: numberValue(item.x),
      y: numberValue(item.y)
    },
    raw: includeRaw ? compactRaw(item) : undefined
  };
}

function normalizeWire(raw: unknown, includeRaw: boolean): SchematicWire {
  const item = asRecord(raw);
  return {
    primitiveId: stringValue(item.primitiveId ?? item.id ?? item.uuid),
    net: normalizeNetName(item.net ?? item.netName),
    geometry: item.line ?? item.points ?? item.geometry,
    endpoints: inferEndpoints(item.line ?? item.points ?? item.geometry),
    raw: includeRaw ? compactRaw(item) : undefined
  };
}

function normalizeComponentLabel(raw: unknown, includeRaw: boolean): SchematicLabel[] {
  const item = asRecord(raw);
  const componentType = stringValue(item.componentType ?? item.primitiveType);
  const net = normalizeNetName(item.net ?? item.netName);
  if (!net || !componentType || !["netflag", "netport", "short_symbol"].includes(componentType)) {
    return [];
  }
  return [{
    primitiveId: stringValue(item.primitiveId ?? item.id ?? item.uuid),
    net,
    type: componentType,
    position: {
      x: numberValue(item.x),
      y: numberValue(item.y)
    },
    raw: includeRaw ? compactRaw(item) : undefined
  }];
}

function normalizeTextLabel(raw: unknown, includeRaw: boolean): SchematicLabel[] {
  const item = asRecord(raw);
  const text = stringValue(item.text ?? item.content ?? item.value);
  if (!text || !looksLikeExplicitTextNetName(text)) {
    return [];
  }
  return [{
    primitiveId: stringValue(item.primitiveId ?? item.id ?? item.uuid),
    net: text,
    type: "text",
    position: {
      x: numberValue(item.x),
      y: numberValue(item.y)
    },
    raw: includeRaw ? compactRaw(item) : undefined
  }];
}

function buildNets(pins: SchematicPin[], wires: SchematicWire[], labels: SchematicLabel[]): SchematicNet[] {
  const names = new Set<string>();
  for (const pin of pins) if (pin.net) names.add(pin.net);
  for (const wire of wires) if (wire.net) names.add(wire.net);
  for (const label of labels) if (label.net) names.add(label.net);

  return [...names].sort((a, b) => a.localeCompare(b)).map((name) => {
    const connectedPins = pins.filter((pin) => sameText(pin.net, name));
    const netWires = wires.filter((wire) => sameText(wire.net, name));
    const netLabels = labels.filter((label) => sameText(label.net, name));
    const nodeIds = unique([
      ...connectedPins.map((pin) => pin.nodeId).filter(isPresent),
      ...netWires.map((wire) => wire.nodeId).filter(isPresent)
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

type Segment = {
  start: Required<Position>;
  end: Required<Position>;
};

type WireWithSegments = {
  wire: SchematicWire;
  segments: Segment[];
};

type ConnectivityGroup = {
  nodeId: string;
  wireIndexes: number[];
  segments: Segment[];
  net?: string;
  netNames: string[];
  source: "wire_inferred" | "label_inferred";
  confidence: Confidence;
  wirePrimitiveIds: string[];
  labelPrimitiveIds: string[];
};

function resolveConnectivity(
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

function resolvePinConnectivity(pin: SchematicPin, groups: ConnectivityGroup[], tolerance: number): SchematicPin {
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

  const touchingGroups = groups.filter((group) => group.segments.some((segment) => pointTouchesSegment(point, segment, tolerance)));
  const netNames = new Set(touchingGroups.map((group) => group.net).filter(isPresent));
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
        reason: netNames.size > 1
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
      reason: source === "wire_inferred" ? "Pin touches a named schematic wire." : "Pin touches a wire group named by a nearby net label."
    }
  };
}

function buildConnectivityGroups(wireData: WireWithSegments[], labels: SchematicLabel[], tolerance: number): ConnectivityGroup[] {
  const parent = wireData.map((_, index) => index);
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const unite = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parent[rightRoot] = leftRoot;
    }
  };

  for (let left = 0; left < wireData.length; left += 1) {
    for (let right = left + 1; right < wireData.length; right += 1) {
      if (segmentsTouch(wireData[left].segments, wireData[right].segments, tolerance)) {
        unite(left, right);
      }
    }
  }

  const byRoot = new Map<number, number[]>();
  for (let index = 0; index < wireData.length; index += 1) {
    const root = find(index);
    byRoot.set(root, [...(byRoot.get(root) ?? []), index]);
  }

  return [...byRoot.values()].map((wireIndexes, groupIndex) => {
    const groupWires = wireIndexes.map((index) => wireData[index]);
    const segments = groupWires.flatMap((item) => item.segments);
    const wireNetNames = unique(groupWires.map((item) => item.wire.net).filter(isPresent));
    const touchingLabels = labels.filter((label) => labelTouchesSegments(label, segments, tolerance));
    const labelNetNames = unique(touchingLabels.map((label) => label.net).filter(isPresent));
    const allNetNames = unique([...wireNetNames, ...labelNetNames]);
    const net = allNetNames.length === 1 ? allNetNames[0] : undefined;
    return {
      nodeId: net ? netNodeId(net) : `node:${groupIndex + 1}`,
      wireIndexes,
      segments,
      net,
      netNames: allNetNames,
      source: wireNetNames.length === 1 ? "wire_inferred" : "label_inferred",
      confidence: wireNetNames.length === 1 ? "high" : labelNetNames.length === 1 ? "partial" : "low",
      wirePrimitiveIds: groupWires.map((item) => item.wire.primitiveId).filter(isPresent),
      labelPrimitiveIds: touchingLabels.map((label) => label.primitiveId).filter(isPresent)
    };
  });
}

function extractSegments(value: unknown): Segment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const segments: Segment[] = [];
  const points: Required<Position>[] = [];
  for (const item of value) {
    if (Array.isArray(item) && item.length >= 4) {
      const start = requiredPosition({ x: numberValue(item[0]), y: numberValue(item[1]) });
      const end = requiredPosition({ x: numberValue(item[2]), y: numberValue(item[3]) });
      if (start && end) {
        segments.push({ start, end });
      }
      continue;
    }
    const point = Array.isArray(item)
      ? requiredPosition({ x: numberValue(item[0]), y: numberValue(item[1]) })
      : requiredPosition({ x: numberValue(asRecord(item).x), y: numberValue(asRecord(item).y) });
    if (point) {
      points.push(point);
    }
  }
  for (let index = 1; index < points.length; index += 1) {
    segments.push({ start: points[index - 1], end: points[index] });
  }
  return segments;
}

function segmentsTouch(left: Segment[], right: Segment[], tolerance: number): boolean {
  return left.some((leftSegment) => right.some((rightSegment) => segmentTouchesSegment(leftSegment, rightSegment, tolerance)));
}

function segmentTouchesSegment(left: Segment, right: Segment, tolerance: number): boolean {
  return pointTouchesSegment(left.start, right, tolerance)
    || pointTouchesSegment(left.end, right, tolerance)
    || pointTouchesSegment(right.start, left, tolerance)
    || pointTouchesSegment(right.end, left, tolerance);
}

function labelTouchesSegments(label: SchematicLabel, segments: Segment[], tolerance: number): boolean {
  const point = requiredPosition(label.position);
  if (!point) {
    return false;
  }
  const candidates = [point, { x: point.x, y: -point.y }];
  return candidates.some((candidate) => segments.some((segment) => pointTouchesSegment(candidate, segment, tolerance)));
}

function pointTouchesSegment(point: Required<Position>, segment: Segment, tolerance: number): boolean {
  const minX = Math.min(segment.start.x, segment.end.x) - tolerance;
  const maxX = Math.max(segment.start.x, segment.end.x) + tolerance;
  const minY = Math.min(segment.start.y, segment.end.y) - tolerance;
  const maxY = Math.max(segment.start.y, segment.end.y) + tolerance;
  if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
    return false;
  }
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= tolerance) {
    return distance(point, segment.start) <= tolerance;
  }
  const cross = Math.abs((point.x - segment.start.x) * dy - (point.y - segment.start.y) * dx);
  return cross / length <= tolerance;
}

function distance(left: Required<Position>, right: Required<Position>): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function requiredPosition(position: Position): Required<Position> | undefined {
  return position.x !== undefined && position.y !== undefined ? { x: position.x, y: position.y } : undefined;
}

function netConfidence(pins: SchematicPin[], wires: SchematicWire[], labels: SchematicLabel[]): Confidence {
  if (pins.some((pin) => pin.connectivityEvidence?.confidence === "high" || pin.netSource === "direct") && wires.length > 0) {
    return "high";
  }
  if (pins.length > 0 || wires.length > 0 || labels.length > 0) {
    return "partial";
  }
  return "low";
}

function snapshotConfidence(pins: SchematicPin[], wires: SchematicWire[], nets: SchematicNet[]): Confidence {
  if (pins.length === 0 && wires.length === 0) {
    return nets.length > 0 ? "partial" : "low";
  }
  const resolvedPins = pins.filter((pin) => pin.connected || pin.net).length;
  if (pins.length > 0 && wires.length > 0 && resolvedPins / pins.length >= 0.75) {
    return "high";
  }
  return resolvedPins > 0 || nets.length > 0 ? "partial" : "low";
}

function findComponent(snapshot: SchematicSnapshot, query: string): SchematicComponent | undefined {
  const needle = query.toLowerCase();
  return snapshot.components.find((component) => sameText(component.designator, query))
    ?? snapshot.components.find((component) => JSON.stringify(component).toLowerCase().includes(needle));
}

function findNet(snapshot: SchematicSnapshot, query: string): SchematicNet | undefined {
  return snapshot.nets.find((net) => sameText(net.name, query))
    ?? snapshot.nets.find((net) => net.name.toLowerCase().includes(query.toLowerCase()));
}

function findSuspiciousSimilarPowerNets(snapshot: SchematicSnapshot, allowedNames: Set<string>): SchematicFinding[] {
  const powerNets = snapshot.nets.filter((net) => allowedNames.size === 0 || allowedNames.has(net.name)).filter((net) => looksLikePowerNet(net.name));
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

function findPowerNetsWithoutCapacitors(snapshot: SchematicSnapshot, allowedNames: Set<string>): SchematicFinding[] {
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

function looksLikePowerPin(pin: SchematicPin): boolean {
  const text = `${pin.pinName ?? ""} ${pin.pinNumber ?? ""}`.toUpperCase();
  return /\b(VCC|VDD|VIN|VBUS|GND|VSS|AVDD|DVDD|3V3|5V)\b/.test(text);
}

function looksLikePowerNet(name: string): boolean {
  return /(^|\b)(GND|VCC|VDD|VIN|VBUS|3V3|5V|BAT|VBAT|POWER)(\b|$)/i.test(name);
}

function looksLikeNetName(text: string): boolean {
  return /^[A-Za-z0-9_+\-./:]+$/.test(text) && /[A-Za-z0-9]/.test(text);
}

function looksLikeExplicitTextNetName(text: string): boolean {
  if (!looksLikeNetName(text)) {
    return false;
  }
  if (/\s/.test(text)) {
    return false;
  }
  if (/^(pull-?up|pull-?down|gpio|usb_c|buck|charger|batt)$/i.test(text)) {
    return false;
  }
  return /[_+\-./:]|\d|^(GND|VCC|VDD|VIN|VBUS|VBAT|BAT|SDA|SCL|MISO|MOSI|SCK|RX|TX|D\+|D-)$/i.test(text);
}

function canonicalNet(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatPin(pin: SchematicPin): string {
  const designator = pin.componentDesignator ?? "unknown component";
  const number = pin.pinNumber ? `#${pin.pinNumber}` : "";
  const name = pin.pinName ? ` ${pin.pinName}` : "";
  return `${designator}${number}${name}`.trim();
}

function pinEvidence(pin: SchematicPin): Record<string, unknown> {
  return {
    component: pin.componentDesignator,
    pinNumber: pin.pinNumber,
    pinName: pin.pinName,
    net: pin.net,
    nodeId: pin.nodeId,
    connected: pin.connected,
    position: pin.position,
    primitiveId: pin.primitiveId
  };
}

function netNodeId(net: string): string {
  return `net:${canonicalNet(net)}`;
}

function inferEndpoints(value: unknown): Position[] | undefined {
  const segments = extractSegments(value);
  if (segments.length === 0) {
    return undefined;
  }
  return [segments[0].start, segments[segments.length - 1].end];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function compactRaw(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 40).map(compactRaw);
  }
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
    if (typeof item !== "function") {
      output[key] = item && typeof item === "object" ? compactRaw(item) : item;
    }
  }
  return output;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : undefined;
}

function normalizeNetName(value: unknown): string | undefined {
  const text = stringValue(value);
  return text && text !== "?" ? text : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sameText(left: unknown, right: unknown): boolean {
  return stringValue(left)?.toLowerCase() === stringValue(right)?.toLowerCase();
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function intersects(left: string[], right: string[]): boolean {
  const rightSet = new Set(right);
  return left.some((item) => rightSet.has(item));
}

function uniqueByPrimitiveId<T extends { primitiveId?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = item.primitiveId ?? JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      output.push(item);
    }
  }
  return output;
}
