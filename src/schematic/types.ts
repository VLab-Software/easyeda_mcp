import type { DataCompleteness, DataSource, DocumentIdentity } from "../protocol/identity.js";

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
  snapshotId?: string;
  target?: DocumentIdentity;
  capturedAt?: string;
  source?: DataSource;
  completeness?: DataCompleteness;
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
  snapshotId?: string;
  target?: DocumentIdentity;
  capturedAt?: string;
  source?: DataSource;
  completeness?: DataCompleteness;
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

export type EndpointRef = { component: string; pin?: string; pinName?: string } | { net: string };

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

export type Segment = {
  start: Required<Position>;
  end: Required<Position>;
};

export type WireWithSegments = {
  wire: SchematicWire;
  segments: Segment[];
};

export type ConnectivityGroup = {
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

export type PassiveEdge = {
  fromNodeId: string;
  toNodeId: string;
  component: SchematicComponent;
  pins: SchematicPin[];
  kind: PassiveKind;
};

export type PassiveGraph = {
  edges: PassiveEdge[];
  adjacency: Map<string, PassiveEdge[]>;
};

export type EndpointResolution = {
  ref: EndpointRef;
  nodeIds: string[];
  pins: SchematicPin[];
  components: SchematicComponent[];
  nets: string[];
  reason?: string;
};

export interface SchematicErcViolation {
  rule?: string;
  code?: string;
  message: string;
  severity: "error" | "warning" | "info";
  pageId?: string;
  pageIndex?: number;
  primitiveIds?: string[];
  location?: Position;
  raw?: unknown;
}

export interface SchematicErcResult {
  available: boolean;
  status: "passed" | "violations_found" | "inconclusive" | "unavailable";
  source: DataSource;
  target?: DocumentIdentity;
  capturedAt: string;
  reason?: string;
  passed: boolean;
  violationsCount: number;
  errorsCount: number;
  warningsCount: number;
  violations: SchematicErcViolation[];
  warnings: string[];
  durationMs?: number;
  rawResult?: unknown;
  betaApi?: true;
}

export interface SchematicNativeNetsResult {
  available: boolean;
  status: "complete" | "inconclusive" | "unavailable";
  source: DataSource;
  target?: DocumentIdentity;
  capturedAt: string;
  reason?: string;
  totalNets: number;
  nets: string[];
  byPage?: Array<{ pageId?: string; pageIndex?: number; nets: string[] }>;
  confidence: Confidence | "none";
  completeness: DataCompleteness;
  warnings: string[];
  rawResult?: unknown;
  betaApi?: true;
}
