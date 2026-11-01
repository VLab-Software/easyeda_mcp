import {
  apiError,
  ensureApi,
  isRecord,
  numeric,
  optionalCall,
  pickString,
  sanitize,
  stringOrUndefined,
  toArray
} from "../helpers.js";
import { assertDocumentTargetMatch, extractDocumentIdentity, type DocumentIdentity } from "../identity.js";
import { extensionMutations } from "./mutationManager.js";
import type { EasyEdaApi } from "../types.js";
import type { MutationRecord } from "../../../src/mutation/contracts.js";

export type SchematicPortType = "input" | "output" | "bidirectional" | "unspecified";

export interface NormalizedSchematicPort {
  primitiveId: string;
  name: string;
  portType: SchematicPortType;
  x: number;
  y: number;
  rotation: number;
  sheet?: string;
  color?: string;
  raw?: Record<string, unknown>;
}

export interface BusRangeInfo {
  start: number;
  end: number;
  count: number;
  signals: string[];
}

export interface NormalizedSchematicBus {
  primitiveId: string;
  name: string;
  prefix: string;
  range?: BusRangeInfo;
  signals: string[];
  coordinates: number[];
  points: Array<{ x: number; y: number }>;
  lineWidth?: number;
  color?: string;
  sheet?: string;
  raw?: Record<string, unknown>;
}

export interface NormalizedSchematicBusEntry {
  primitiveId: string;
  busId?: string;
  wireId?: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  rotation?: number;
  net?: string;
  sheet?: string;
  raw?: Record<string, unknown>;
}

export interface SchematicPortBusDiagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  busId?: string;
  portId?: string;
  entryId?: string;
  suggestion?: string;
}

export interface SchematicPortsBusesReport {
  target: DocumentIdentity;
  summary: {
    portCount: number;
    busCount: number;
    busEntryCount: number;
    totalSignalsInBuses: number;
    warningsCount: number;
  };
  ports: NormalizedSchematicPort[];
  buses: NormalizedSchematicBus[];
  busEntries: NormalizedSchematicBusEntry[];
  diagnostics: SchematicPortBusDiagnostic[];
}

export function normalizeLineCoordinates(rawLine: unknown): number[] {
  if (Array.isArray(rawLine)) {
    if (rawLine.every((n) => typeof n === "number" && Number.isFinite(n))) {
      if (rawLine.length >= 4 && rawLine.length % 2 === 0) {
        return rawLine as number[];
      }
    }
    if (rawLine.every((pair) => Array.isArray(pair) && pair.length >= 2)) {
      const flat: number[] = [];
      for (const pair of rawLine) {
        const x = numeric(pair[0]);
        const y = numeric(pair[1]);
        if (x === undefined || y === undefined) {
          throw apiError("invalid_coordinates", "Coordinate pairs must contain finite numbers.");
        }
        flat.push(x, y);
      }
      if (flat.length >= 4) {
        return flat;
      }
    }
  }

  throw apiError(
    "invalid_coordinates",
    "Bus coordinates must be an array of at least 2 points (e.g. [x1, y1, x2, y2] or [[x1, y1], [x2, y2]])."
  );
}

export function extractPointsFromFlat(flat: number[]): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < flat.length; i += 2) {
    points.push({ x: flat[i], y: flat[i + 1] });
  }
  return points;
}

export function pointDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanceToSegment(
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): number {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return pointDistance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projection = {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y)
  };
  return pointDistance(p, projection);
}

export function distanceToPolyline(p: { x: number; y: number }, points: Array<{ x: number; y: number }>): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return pointDistance(p, points[0]);
  let minDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distanceToSegment(p, points[i], points[i + 1]);
    if (d < minDist) {
      minDist = d;
    }
  }
  return minDist;
}

export function parseBusName(rawName: string): {
  prefix: string;
  range?: BusRangeInfo;
  signals: string[];
} {
  const name = rawName.trim();
  const rangeMatch = name.match(/^([a-zA-Z0-9_]+)\[(\d+)(?:\.\.|:)(\d+)\]$/);
  if (rangeMatch) {
    const prefix = rangeMatch[1];
    const start = parseInt(rangeMatch[2], 10);
    const end = parseInt(rangeMatch[3], 10);
    const step = start <= end ? 1 : -1;
    const count = Math.abs(end - start) + 1;
    const signals: string[] = [];

    // Guard against accidentally enormous ranges
    if (count > 512) {
      throw apiError("invalid_bus_range", `Bus range ${name} specifies ${count} signals (maximum allowed is 512).`);
    }

    for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
      signals.push(`${prefix}${i}`);
    }

    return {
      prefix,
      range: { start, end, count, signals },
      signals
    };
  }

  const listMatch = name.match(/^([a-zA-Z0-9_]+)\[([^\]]+)\]$/);
  if (listMatch) {
    const prefix = listMatch[1];
    const items = listMatch[2]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const signals = items.map((item) => (item.startsWith(prefix) ? item : `${prefix}_${item}`));
    return {
      prefix,
      signals
    };
  }

  const commaMatch = name
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (commaMatch.length > 1) {
    return {
      prefix: commaMatch[0],
      signals: commaMatch
    };
  }

  return {
    prefix: name,
    signals: name ? [name] : []
  };
}

export function normalizePortType(raw: unknown): SchematicPortType {
  const str = String(raw ?? "")
    .toLowerCase()
    .trim();
  if (str === "input" || str === "in") return "input";
  if (str === "output" || str === "out") return "output";
  if (str === "bidirectional" || str === "bi" || str === "io" || str === "inout") return "bidirectional";
  return "unspecified";
}

export function normalizeSchematicPort(raw: unknown, includeRaw = false): NormalizedSchematicPort | null {
  if (!isRecord(raw)) return null;
  const primitiveId = pickString(raw, ["primitiveId", "id", "uuid", "gId"]);
  if (!primitiveId) return null;

  const name = pickString(raw, ["name", "net", "netName", "displayName", "label"]) ?? "";
  const rawType = raw.portType ?? raw.type ?? raw.direction ?? raw.flagType;
  const portType = normalizePortType(rawType);
  const x = numeric(raw.x) ?? 0;
  const y = numeric(raw.y) ?? 0;
  const rotation = numeric(raw.rotation) ?? 0;
  const sheet = pickString(raw, ["sheet", "pageId", "sheetId"]);
  const color = pickString(raw, ["color", "strokeColor"]);

  return {
    primitiveId,
    name,
    portType,
    x,
    y,
    rotation,
    sheet,
    color,
    raw: includeRaw ? (sanitize(raw) as Record<string, unknown>) : undefined
  };
}

export function normalizeSchematicBus(raw: unknown, includeRaw = false): NormalizedSchematicBus | null {
  if (!isRecord(raw)) return null;
  const primitiveId = pickString(raw, ["primitiveId", "id", "uuid", "gId"]);
  if (!primitiveId) return null;

  const name = pickString(raw, ["name", "net", "busName", "label"]) ?? "";
  const { prefix, range, signals } = parseBusName(name);

  let coordinates: number[];
  const rawCoords = raw.pointList ?? raw.coordinates ?? raw.line ?? raw.points;
  try {
    coordinates = normalizeLineCoordinates(rawCoords);
  } catch {
    coordinates = [];
  }

  const points = extractPointsFromFlat(coordinates);
  const lineWidth = numeric(raw.lineWidth ?? raw.strokeWidth);
  const color = pickString(raw, ["color", "strokeColor"]);
  const sheet = pickString(raw, ["sheet", "pageId", "sheetId"]);

  return {
    primitiveId,
    name,
    prefix,
    range,
    signals,
    coordinates,
    points,
    lineWidth,
    color,
    sheet,
    raw: includeRaw ? (sanitize(raw) as Record<string, unknown>) : undefined
  };
}

export function normalizeSchematicBusEntry(raw: unknown, includeRaw = false): NormalizedSchematicBusEntry | null {
  if (!isRecord(raw)) return null;
  const primitiveId = pickString(raw, ["primitiveId", "id", "uuid", "gId"]);
  if (!primitiveId) return null;

  const startX = numeric(raw.startX ?? raw.x1) ?? (Array.isArray(raw.pointList) ? numeric(raw.pointList[0]) : 0) ?? 0;
  const startY = numeric(raw.startY ?? raw.y1) ?? (Array.isArray(raw.pointList) ? numeric(raw.pointList[1]) : 0) ?? 0;
  const endX = numeric(raw.endX ?? raw.x2) ?? (Array.isArray(raw.pointList) ? numeric(raw.pointList[2]) : 0) ?? 0;
  const endY = numeric(raw.endY ?? raw.y2) ?? (Array.isArray(raw.pointList) ? numeric(raw.pointList[3]) : 0) ?? 0;
  const rotation = numeric(raw.rotation) ?? 0;
  const busId = pickString(raw, ["busId", "busPrimitiveId"]);
  const wireId = pickString(raw, ["wireId", "wirePrimitiveId"]);
  const net = pickString(raw, ["net", "netName", "signal"]);
  const sheet = pickString(raw, ["sheet", "pageId", "sheetId"]);

  return {
    primitiveId,
    busId,
    wireId,
    startX,
    startY,
    endX,
    endY,
    rotation,
    net,
    sheet,
    raw: includeRaw ? (sanitize(raw) as Record<string, unknown>) : undefined
  };
}

export function analyzePortsAndBusesDiagnostics(
  ports: NormalizedSchematicPort[],
  buses: NormalizedSchematicBus[],
  busEntries: NormalizedSchematicBusEntry[],
  tolerance = 15
): SchematicPortBusDiagnostic[] {
  const diagnostics: SchematicPortBusDiagnostic[] = [];

  // 1. Port diagnostics
  const portsByName = new Map<string, NormalizedSchematicPort[]>();
  for (const port of ports) {
    if (!port.name) {
      diagnostics.push({
        code: "unnamed_port",
        severity: "warning",
        message: `Port ${port.primitiveId} has an empty net name.`,
        portId: port.primitiveId,
        suggestion: "Assign a meaningful net name to this port."
      });
      continue;
    }

    const list = portsByName.get(port.name) ?? [];
    list.push(port);
    portsByName.set(port.name, list);
  }

  for (const [name, pList] of portsByName.entries()) {
    if (pList.length > 1) {
      const distinctTypes = new Set(pList.map((p) => p.portType).filter((t) => t !== "unspecified"));
      if (distinctTypes.has("input") && distinctTypes.has("output") && distinctTypes.size > 1) {
        diagnostics.push({
          code: "conflicting_port_types",
          severity: "warning",
          message: `Net port '${name}' is declared with conflicting types: [${Array.from(distinctTypes).join(", ")}].`,
          suggestion: "Ensure driving ports are output and sink ports are input, or use bidirectional."
        });
      }
    }
  }

  // 2. Bus diagnostics
  for (const bus of buses) {
    if (!bus.name) {
      diagnostics.push({
        code: "unnamed_bus",
        severity: "warning",
        message: `Bus ${bus.primitiveId} has no name specified.`,
        busId: bus.primitiveId,
        suggestion: "Assign a bus syntax name like 'DATA[0..7]'."
      });
    } else if (bus.signals.length === 0) {
      diagnostics.push({
        code: "empty_bus_signals",
        severity: "warning",
        message: `Bus '${bus.name}' does not resolve to any signals.`,
        busId: bus.primitiveId,
        suggestion: "Check syntax; use 'NAME[start..end]' or 'NAME[A,B,C]'."
      });
    }

    if (bus.points.length < 2) {
      diagnostics.push({
        code: "degenerate_bus",
        severity: "warning",
        message: `Bus '${bus.name || bus.primitiveId}' has fewer than 2 coordinate points.`,
        busId: bus.primitiveId
      });
    }
  }

  // 3. Bus entry diagnostics
  for (const entry of busEntries) {
    const ptStart = { x: entry.startX, y: entry.startY };
    const ptEnd = { x: entry.endX, y: entry.endY };

    // Find nearest bus to either start or end point
    let nearestBus: NormalizedSchematicBus | undefined;
    let minDistance = Infinity;

    for (const bus of buses) {
      if (bus.points.length < 2) continue;
      const dStart = distanceToPolyline(ptStart, bus.points);
      const dEnd = distanceToPolyline(ptEnd, bus.points);
      const best = Math.min(dStart, dEnd);
      if (best < minDistance) {
        minDistance = best;
        nearestBus = bus;
      }
    }

    if (!nearestBus || minDistance > tolerance) {
      diagnostics.push({
        code: "dangling_bus_entry",
        severity: "warning",
        message: `Bus entry ${entry.primitiveId} is not connected to any bus polyline (nearest distance: ${Number.isFinite(minDistance) ? minDistance.toFixed(1) : "none"}).`,
        entryId: entry.primitiveId,
        suggestion: "Align the bus entry endpoint exactly with the bus polyline."
      });
    } else {
      // If connected to nearestBus, check whether entry's net belongs to nearestBus signals
      if (entry.net && nearestBus.signals.length > 0) {
        const netUpper = entry.net.toUpperCase();
        const busSignalsUpper = nearestBus.signals.map((s) => s.toUpperCase());
        if (!busSignalsUpper.includes(netUpper)) {
          diagnostics.push({
            code: "bus_signal_mismatch",
            severity: "warning",
            message: `Bus entry ${entry.primitiveId} net '${entry.net}' is not in connected bus '${nearestBus.name}' signals [${nearestBus.signals.slice(0, 5).join(", ")}${nearestBus.signals.length > 5 ? "..." : ""}].`,
            entryId: entry.primitiveId,
            busId: nearestBus.primitiveId,
            suggestion: `Rename the wire/net to match one of ${nearestBus.name} signals.`
          });
        }
      }
    }
  }

  return diagnostics;
}

export async function fetchSchematicPortsBusesReport(
  api: () => EasyEdaApi,
  params: Record<string, any> = {}
): Promise<SchematicPortsBusesReport> {
  const eda = api();
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const currentTarget = extractDocumentIdentity(documentInfo, undefined, "native_api");

  const expectedTarget = params.expectedTarget ?? params.target;
  if (expectedTarget) {
    assertDocumentTargetMatch(expectedTarget, currentTarget);
  }

  if (
    currentTarget.documentType &&
    currentTarget.documentType !== "schematic" &&
    currentTarget.documentType !== "unknown"
  ) {
    throw apiError("wrong_document", "Schematic ports and buses report requires an active schematic document.");
  }

  const includePorts = params.includePorts !== false;
  const includeBuses = params.includeBuses !== false;
  const includeBusEntries = params.includeBusEntries !== false;
  const includeRaw = Boolean(params.includeRaw);

  const ports: NormalizedSchematicPort[] = [];
  const buses: NormalizedSchematicBus[] = [];
  const busEntries: NormalizedSchematicBusEntry[] = [];

  // Fetch Ports
  if (includePorts) {
    let rawPorts: unknown[] = [];
    if (eda.sch_PrimitiveNetPort?.getAll) {
      rawPorts = toArray(await optionalCall(() => eda.sch_PrimitiveNetPort.getAll()));
    } else if (eda.sch_PrimitivePort?.getAll) {
      rawPorts = toArray(await optionalCall(() => eda.sch_PrimitivePort.getAll()));
    } else if (eda.sch_PrimitiveComponent?.getAll) {
      const allComponents = toArray(await optionalCall(() => eda.sch_PrimitiveComponent.getAll(undefined, true)));
      rawPorts = allComponents.filter((c) => {
        if (!isRecord(c)) return false;
        const type = String(c.type ?? c.itemType ?? c.primitiveType ?? "").toLowerCase();
        return type === "netport" || type === "port" || type === "net_port";
      });
    }

    for (const p of rawPorts) {
      const norm = normalizeSchematicPort(p, includeRaw);
      if (norm) ports.push(norm);
    }
  }

  // Fetch Buses
  if (includeBuses) {
    let rawBuses: unknown[] = [];
    if (eda.sch_PrimitiveBus?.getAll) {
      rawBuses = toArray(await optionalCall(() => eda.sch_PrimitiveBus.getAll()));
    }

    for (const b of rawBuses) {
      const norm = normalizeSchematicBus(b, includeRaw);
      if (norm) buses.push(norm);
    }
  }

  // Fetch Bus Entries
  if (includeBusEntries) {
    let rawBusEntries: unknown[] = [];
    if (eda.sch_PrimitiveBusEntry?.getAll) {
      rawBusEntries = toArray(await optionalCall(() => eda.sch_PrimitiveBusEntry.getAll()));
    }

    for (const e of rawBusEntries) {
      const norm = normalizeSchematicBusEntry(e, includeRaw);
      if (norm) busEntries.push(norm);
    }
  }

  const diagnostics = analyzePortsAndBusesDiagnostics(ports, buses, busEntries);
  const totalSignalsInBuses = buses.reduce((acc, b) => acc + b.signals.length, 0);
  const warningsCount = diagnostics.filter((d) => d.severity === "warning" || d.severity === "error").length;

  return {
    target: currentTarget,
    summary: {
      portCount: ports.length,
      busCount: buses.length,
      busEntryCount: busEntries.length,
      totalSignalsInBuses,
      warningsCount
    },
    ports,
    buses,
    busEntries,
    diagnostics
  };
}

export async function prepareSchematicPortMutation(
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

  if (
    currentTarget.documentType &&
    currentTarget.documentType !== "schematic" &&
    currentTarget.documentType !== "unknown"
  ) {
    throw apiError("wrong_document", "Schematic port mutations require an active schematic document.");
  }

  const action = String(params.action ?? "")
    .toLowerCase()
    .trim();
  if (!["createport", "modifyport", "deleteport", "create", "modify", "delete"].includes(action)) {
    throw apiError("invalid_parameters", "Port action must be 'createPort', 'modifyPort', or 'deletePort'.");
  }

  if (action === "createport" || action === "create") {
    const name = stringOrUndefined(params.name);
    if (!name) {
      throw apiError("missing_parameters", "Parameter 'name' is required to create a net port.");
    }
    const x = numeric(params.x);
    const y = numeric(params.y);
    if (x === undefined || y === undefined) {
      throw apiError("missing_parameters", "Parameters 'x' and 'y' are required to create a net port.");
    }
    const portType = normalizePortType(params.portType ?? params.type ?? "bidirectional");
    const rotation = numeric(params.rotation) ?? 0;
    const color = stringOrUndefined(params.color);

    const operation = {
      action: "createPort",
      name,
      portType,
      x,
      y,
      rotation,
      color
    };

    const preview = {
      before: null,
      requestedAfter: operation,
      changedKeys: ["name", "portType", "x", "y", "rotation"],
      scope: `port:${name}`,
      impact: `Creates net port '${name}' (type: ${portType}) at (${x}, ${y}, rotation: ${rotation}°).`
    };

    const record = extensionMutations.prepare({
      domain: "schematic",
      action: "createPort",
      target: currentTarget,
      operation,
      before: preview.before,
      requestedAfter: preview.requestedAfter,
      changedKeys: preview.changedKeys,
      scope: preview.scope,
      impact: preview.impact,
      ttlMs: 5 * 60_000
    });

    return {
      mutationId: record.mutationId,
      confirmation: record.confirmation,
      action: record.action,
      target: record.target,
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  if (action === "modifyport" || action === "modify") {
    const portId = stringOrUndefined(params.portId ?? params.primitiveId ?? params.id);
    if (!portId) {
      throw apiError("missing_parameters", "Parameter 'portId' is required to modify a port.");
    }

    const report = await fetchSchematicPortsBusesReport(api, { includeBuses: false, includeBusEntries: false });
    const existing = report.ports.find((p) => p.primitiveId === portId);
    if (!existing) {
      throw apiError("not_found", `Port with id '${portId}' not found in active schematic.`);
    }

    const changedKeys: string[] = [];
    const updates: Record<string, unknown> = {};

    if (params.name !== undefined && String(params.name) !== existing.name) {
      updates.name = String(params.name);
      changedKeys.push("name");
    }
    if (params.portType !== undefined) {
      const pType = normalizePortType(params.portType);
      if (pType !== existing.portType) {
        updates.portType = pType;
        changedKeys.push("portType");
      }
    }
    if (params.x !== undefined && numeric(params.x) !== existing.x) {
      updates.x = numeric(params.x);
      changedKeys.push("x");
    }
    if (params.y !== undefined && numeric(params.y) !== existing.y) {
      updates.y = numeric(params.y);
      changedKeys.push("y");
    }
    if (params.rotation !== undefined && numeric(params.rotation) !== existing.rotation) {
      updates.rotation = numeric(params.rotation);
      changedKeys.push("rotation");
    }
    if (params.color !== undefined && String(params.color) !== existing.color) {
      updates.color = String(params.color);
      changedKeys.push("color");
    }

    if (changedKeys.length === 0) {
      throw apiError("no_changes", "No property changes specified for port modification.");
    }

    const operation = {
      action: "modifyPort",
      portId,
      properties: updates
    };

    const preview = {
      before: existing,
      requestedAfter: { ...existing, ...updates },
      changedKeys,
      scope: `port:${portId}`,
      impact: `Modifies properties [${changedKeys.join(", ")}] on port ${portId} (${existing.name}).`
    };

    const record = extensionMutations.prepare({
      domain: "schematic",
      action: "modifyPort",
      target: currentTarget,
      operation,
      before: preview.before,
      requestedAfter: preview.requestedAfter,
      changedKeys: preview.changedKeys,
      scope: preview.scope,
      impact: preview.impact,
      ttlMs: 5 * 60_000
    });

    return {
      mutationId: record.mutationId,
      confirmation: record.confirmation,
      action: record.action,
      target: record.target,
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  // deleteport
  const portId = stringOrUndefined(params.portId ?? params.primitiveId ?? params.id);
  if (!portId) {
    throw apiError("missing_parameters", "Parameter 'portId' is required to delete a port.");
  }

  const report = await fetchSchematicPortsBusesReport(api, { includeBuses: false, includeBusEntries: false });
  const existing = report.ports.find((p) => p.primitiveId === portId);

  const operation = {
    action: "deletePort",
    portId
  };

  const preview = {
    before: existing ?? { primitiveId: portId },
    requestedAfter: null,
    changedKeys: ["deleted"],
    scope: `port:${portId}`,
    impact: `Deletes net port ${portId} (${existing?.name ?? "unnamed"}) from the active schematic.`
  };

  const record = extensionMutations.prepare({
    domain: "schematic",
    action: "deletePort",
    target: currentTarget,
    operation,
    before: preview.before,
    requestedAfter: preview.requestedAfter,
    changedKeys: preview.changedKeys,
    scope: preview.scope,
    impact: preview.impact,
    ttlMs: 5 * 60_000
  });

  return {
    mutationId: record.mutationId,
    confirmation: record.confirmation,
    action: record.action,
    target: record.target,
    preview: record.preview,
    expiresAt: record.expiresAt
  };
}

export async function prepareSchematicBusMutation(
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

  if (
    currentTarget.documentType &&
    currentTarget.documentType !== "schematic" &&
    currentTarget.documentType !== "unknown"
  ) {
    throw apiError("wrong_document", "Schematic bus mutations require an active schematic document.");
  }

  const action = String(params.action ?? "")
    .toLowerCase()
    .trim();
  const validActions = [
    "createbus",
    "modifybus",
    "deletebus",
    "createbusentry",
    "deletebusentry",
    "create",
    "modify",
    "delete"
  ];

  if (!validActions.includes(action)) {
    throw apiError(
      "invalid_parameters",
      "Bus action must be 'createBus', 'modifyBus', 'deleteBus', 'createBusEntry', or 'deleteBusEntry'."
    );
  }

  if (action === "createbus" || (action === "create" && !params.busEntry)) {
    const name = stringOrUndefined(params.name);
    if (!name) {
      throw apiError("missing_parameters", "Parameter 'name' is required to create a bus (e.g. 'DATA[0..7]').");
    }

    const { prefix, signals } = parseBusName(name);
    const coordinates = normalizeLineCoordinates(params.coordinates ?? params.pointList ?? params.line);
    const lineWidth = numeric(params.lineWidth) ?? 2;
    const color = stringOrUndefined(params.color);

    const operation = {
      action: "createBus",
      name,
      prefix,
      signals,
      coordinates,
      lineWidth,
      color
    };

    const preview = {
      before: null,
      requestedAfter: operation,
      changedKeys: ["name", "coordinates", "lineWidth"],
      scope: `bus:${name}`,
      impact: `Creates bus '${name}' (${signals.length} signals: ${signals.slice(0, 4).join(", ")}${signals.length > 4 ? "..." : ""}) with ${coordinates.length / 2} points.`
    };

    const record = extensionMutations.prepare({
      domain: "schematic",
      action: "createBus",
      target: currentTarget,
      operation,
      before: preview.before,
      requestedAfter: preview.requestedAfter,
      changedKeys: preview.changedKeys,
      scope: preview.scope,
      impact: preview.impact,
      ttlMs: 5 * 60_000
    });

    return {
      mutationId: record.mutationId,
      confirmation: record.confirmation,
      action: record.action,
      target: record.target,
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  if (action === "modifybus" || (action === "modify" && !params.busEntry)) {
    const busId = stringOrUndefined(params.busId ?? params.primitiveId ?? params.id);
    if (!busId) {
      throw apiError("missing_parameters", "Parameter 'busId' is required to modify a bus.");
    }

    const report = await fetchSchematicPortsBusesReport(api, { includePorts: false, includeBusEntries: false });
    const existing = report.buses.find((b) => b.primitiveId === busId);
    if (!existing) {
      throw apiError("not_found", `Bus with id '${busId}' not found in active schematic.`);
    }

    const changedKeys: string[] = [];
    const updates: Record<string, unknown> = {};

    if (params.name !== undefined && String(params.name) !== existing.name) {
      updates.name = String(params.name);
      changedKeys.push("name");
    }
    if (params.coordinates !== undefined || params.pointList !== undefined) {
      const coords = normalizeLineCoordinates(params.coordinates ?? params.pointList);
      updates.coordinates = coords;
      changedKeys.push("coordinates");
    }
    if (params.lineWidth !== undefined && numeric(params.lineWidth) !== existing.lineWidth) {
      updates.lineWidth = numeric(params.lineWidth);
      changedKeys.push("lineWidth");
    }
    if (params.color !== undefined && String(params.color) !== existing.color) {
      updates.color = String(params.color);
      changedKeys.push("color");
    }

    if (changedKeys.length === 0) {
      throw apiError("no_changes", "No property changes specified for bus modification.");
    }

    const operation = {
      action: "modifyBus",
      busId,
      properties: updates
    };

    const preview = {
      before: existing,
      requestedAfter: { ...existing, ...updates },
      changedKeys,
      scope: `bus:${busId}`,
      impact: `Modifies properties [${changedKeys.join(", ")}] on bus ${busId} (${existing.name}).`
    };

    const record = extensionMutations.prepare({
      domain: "schematic",
      action: "modifyBus",
      target: currentTarget,
      operation,
      before: preview.before,
      requestedAfter: preview.requestedAfter,
      changedKeys: preview.changedKeys,
      scope: preview.scope,
      impact: preview.impact,
      ttlMs: 5 * 60_000
    });

    return {
      mutationId: record.mutationId,
      confirmation: record.confirmation,
      action: record.action,
      target: record.target,
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  if (action === "deletebus" || (action === "delete" && !params.busEntry && !params.entryId)) {
    const busId = stringOrUndefined(params.busId ?? params.primitiveId ?? params.id);
    if (!busId) {
      throw apiError("missing_parameters", "Parameter 'busId' is required to delete a bus.");
    }

    const report = await fetchSchematicPortsBusesReport(api, { includePorts: false, includeBusEntries: false });
    const existing = report.buses.find((b) => b.primitiveId === busId);

    const operation = {
      action: "deleteBus",
      busId
    };

    const preview = {
      before: existing ?? { primitiveId: busId },
      requestedAfter: null,
      changedKeys: ["deleted"],
      scope: `bus:${busId}`,
      impact: `Deletes bus ${busId} (${existing?.name ?? "unnamed"}) from the active schematic.`
    };

    const record = extensionMutations.prepare({
      domain: "schematic",
      action: "deleteBus",
      target: currentTarget,
      operation,
      before: preview.before,
      requestedAfter: preview.requestedAfter,
      changedKeys: preview.changedKeys,
      scope: preview.scope,
      impact: preview.impact,
      ttlMs: 5 * 60_000
    });

    return {
      mutationId: record.mutationId,
      confirmation: record.confirmation,
      action: record.action,
      target: record.target,
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  if (action === "createbusentry" || (action === "create" && params.busEntry)) {
    let startX = numeric(params.startX ?? params.x1);
    let startY = numeric(params.startY ?? params.y1);
    let endX = numeric(params.endX ?? params.x2);
    let endY = numeric(params.endY ?? params.y2);

    if (startX === undefined || startY === undefined || endX === undefined || endY === undefined) {
      if (params.coordinates || params.pointList) {
        const coords = normalizeLineCoordinates(params.coordinates ?? params.pointList);
        if (coords.length >= 4) {
          startX = coords[0];
          startY = coords[1];
          endX = coords[2];
          endY = coords[3];
        }
      }
    }

    if (startX === undefined || startY === undefined || endX === undefined || endY === undefined) {
      throw apiError(
        "missing_parameters",
        "Bus entry creation requires start and end coordinates (startX, startY, endX, endY)."
      );
    }

    const rotation = numeric(params.rotation) ?? 0;
    const busId = stringOrUndefined(params.busId);
    const wireId = stringOrUndefined(params.wireId);
    const net = stringOrUndefined(params.net ?? params.signal);

    const operation = {
      action: "createBusEntry",
      startX,
      startY,
      endX,
      endY,
      rotation,
      busId,
      wireId,
      net
    };

    const preview = {
      before: null,
      requestedAfter: operation,
      changedKeys: ["startX", "startY", "endX", "endY"],
      scope: `busEntry:(${startX},${startY})->(${endX},${endY})`,
      impact: `Creates diagonal bus entry tap from (${startX}, ${startY}) to (${endX}, ${endY})${net ? ` for net '${net}'` : ""}.`
    };

    const record = extensionMutations.prepare({
      domain: "schematic",
      action: "createBusEntry",
      target: currentTarget,
      operation,
      before: preview.before,
      requestedAfter: preview.requestedAfter,
      changedKeys: preview.changedKeys,
      scope: preview.scope,
      impact: preview.impact,
      ttlMs: 5 * 60_000
    });

    return {
      mutationId: record.mutationId,
      confirmation: record.confirmation,
      action: record.action,
      target: record.target,
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  // deletebusentry
  const entryId = stringOrUndefined(params.entryId ?? params.primitiveId ?? params.id);
  if (!entryId) {
    throw apiError("missing_parameters", "Parameter 'entryId' is required to delete a bus entry.");
  }

  const report = await fetchSchematicPortsBusesReport(api, { includePorts: false, includeBuses: false });
  const existing = report.busEntries.find((e) => e.primitiveId === entryId);

  const operation = {
    action: "deleteBusEntry",
    entryId
  };

  const preview = {
    before: existing ?? { primitiveId: entryId },
    requestedAfter: null,
    changedKeys: ["deleted"],
    scope: `busEntry:${entryId}`,
    impact: `Deletes bus entry tap ${entryId} from the active schematic.`
  };

  const record = extensionMutations.prepare({
    domain: "schematic",
    action: "deleteBusEntry",
    target: currentTarget,
    operation,
    before: preview.before,
    requestedAfter: preview.requestedAfter,
    changedKeys: preview.changedKeys,
    scope: preview.scope,
    impact: preview.impact,
    ttlMs: 5 * 60_000
  });

  return {
    mutationId: record.mutationId,
    confirmation: record.confirmation,
    action: record.action,
    target: record.target,
    preview: record.preview,
    expiresAt: record.expiresAt
  };
}

export async function executeSchematicPortMutation(
  record: MutationRecord,
  api: () => EasyEdaApi
): Promise<{ executed: boolean; readback: Record<string, unknown> }> {
  const eda = api();
  const op = record.operation as Record<string, any>;

  if (op.action === "createPort") {
    let created: any;
    if (eda.sch_PrimitiveNetPort?.create) {
      created = await eda.sch_PrimitiveNetPort.create({
        name: op.name,
        portType: op.portType,
        x: op.x,
        y: op.y,
        rotation: op.rotation,
        color: op.color
      });
    } else if (eda.sch_PrimitivePort?.create) {
      created = await eda.sch_PrimitivePort.create({
        name: op.name,
        portType: op.portType,
        x: op.x,
        y: op.y,
        rotation: op.rotation
      });
    } else if (eda.sch_PrimitiveComponent?.createNetFlag) {
      created = await eda.sch_PrimitiveComponent.createNetFlag(
        op.portType === "input" ? "InputPort" : op.portType === "output" ? "OutputPort" : "NetPort",
        op.name,
        op.x,
        op.y,
        op.rotation
      );
    } else {
      throw apiError(
        "capability_unavailable",
        "Schematic port creation (sch_PrimitiveNetPort.create / sch_PrimitivePort.create) is not available in the connected EasyEDA Pro version."
      );
    }

    const createdPrimitiveId =
      created?.primitiveId ?? created?.id ?? created?.uuid ?? (typeof created === "string" ? created : undefined);

    const report = await fetchSchematicPortsBusesReport(api, { includeBuses: false, includeBusEntries: false });
    const verifiedPort = report.ports.find((p) => p.name === op.name || p.primitiveId === createdPrimitiveId);

    return {
      executed: true,
      readback: {
        primitiveId: createdPrimitiveId ?? verifiedPort?.primitiveId ?? "created_port",
        name: op.name,
        portType: op.portType,
        x: op.x,
        y: op.y,
        rotation: op.rotation,
        verified: Boolean(verifiedPort || createdPrimitiveId),
        port: verifiedPort
      }
    };
  }

  if (op.action === "modifyPort") {
    if (eda.sch_PrimitiveNetPort?.modify) {
      await eda.sch_PrimitiveNetPort.modify(op.portId, op.properties);
    } else if (eda.sch_PrimitivePort?.modify) {
      await eda.sch_PrimitivePort.modify(op.portId, op.properties);
    } else {
      throw apiError(
        "capability_unavailable",
        "Schematic port modification (sch_PrimitiveNetPort.modify / sch_PrimitivePort.modify) is not available."
      );
    }

    const report = await fetchSchematicPortsBusesReport(api, { includeBuses: false, includeBusEntries: false });
    const modifiedPort = report.ports.find((p) => p.primitiveId === op.portId);

    return {
      executed: true,
      readback: {
        portId: op.portId,
        properties: op.properties,
        verified: Boolean(modifiedPort),
        port: modifiedPort
      }
    };
  }

  if (op.action === "deletePort") {
    if (eda.sch_PrimitiveNetPort?.delete) {
      await eda.sch_PrimitiveNetPort.delete([op.portId]);
    } else if (eda.sch_PrimitivePort?.delete) {
      await eda.sch_PrimitivePort.delete([op.portId]);
    } else {
      throw apiError(
        "capability_unavailable",
        "Schematic port deletion (sch_PrimitiveNetPort.delete / sch_PrimitivePort.delete) is not available."
      );
    }

    const report = await fetchSchematicPortsBusesReport(api, { includeBuses: false, includeBusEntries: false });
    const stillExists = report.ports.some((p) => p.primitiveId === op.portId);

    if (stillExists) {
      throw apiError("readback_verification_failed", `Port ${op.portId} still exists after delete call.`);
    }

    return {
      executed: true,
      readback: {
        portId: op.portId,
        deleted: true,
        verified: true
      }
    };
  }

  throw apiError("unsupported_action", `Unsupported schematic port mutation action "${op.action}".`);
}

export async function executeSchematicBusMutation(
  record: MutationRecord,
  api: () => EasyEdaApi
): Promise<{ executed: boolean; readback: Record<string, unknown> }> {
  const eda = api();
  const op = record.operation as Record<string, any>;

  if (op.action === "createBus") {
    ensureApi("sch_PrimitiveBus", "create", eda);
    const created = await eda.sch_PrimitiveBus.create(op.coordinates, {
      name: op.name,
      strokeWidth: op.lineWidth,
      color: op.color
    });

    const createdPrimitiveId =
      created?.primitiveId ?? created?.id ?? created?.uuid ?? (typeof created === "string" ? created : undefined);

    const report = await fetchSchematicPortsBusesReport(api, { includePorts: false, includeBusEntries: false });
    const verifiedBus = report.buses.find((b) => b.name === op.name || b.primitiveId === createdPrimitiveId);

    return {
      executed: true,
      readback: {
        primitiveId: createdPrimitiveId ?? verifiedBus?.primitiveId ?? "created_bus",
        name: op.name,
        signalsCount: op.signals?.length ?? 0,
        coordinates: op.coordinates,
        verified: Boolean(verifiedBus || createdPrimitiveId),
        bus: verifiedBus
      }
    };
  }

  if (op.action === "modifyBus") {
    ensureApi("sch_PrimitiveBus", "modify", eda);
    await eda.sch_PrimitiveBus.modify(op.busId, op.properties);

    const report = await fetchSchematicPortsBusesReport(api, { includePorts: false, includeBusEntries: false });
    const modifiedBus = report.buses.find((b) => b.primitiveId === op.busId);

    return {
      executed: true,
      readback: {
        busId: op.busId,
        properties: op.properties,
        verified: Boolean(modifiedBus),
        bus: modifiedBus
      }
    };
  }

  if (op.action === "deleteBus") {
    ensureApi("sch_PrimitiveBus", "delete", eda);
    await eda.sch_PrimitiveBus.delete([op.busId]);

    const report = await fetchSchematicPortsBusesReport(api, { includePorts: false, includeBusEntries: false });
    const stillExists = report.buses.some((b) => b.primitiveId === op.busId);

    if (stillExists) {
      throw apiError("readback_verification_failed", `Bus ${op.busId} still exists after delete call.`);
    }

    return {
      executed: true,
      readback: {
        busId: op.busId,
        deleted: true,
        verified: true
      }
    };
  }

  if (op.action === "createBusEntry") {
    ensureApi("sch_PrimitiveBusEntry", "create", eda);
    const created = await eda.sch_PrimitiveBusEntry.create({
      startX: op.startX,
      startY: op.startY,
      endX: op.endX,
      endY: op.endY,
      rotation: op.rotation,
      busId: op.busId,
      wireId: op.wireId,
      net: op.net
    });

    const createdPrimitiveId =
      created?.primitiveId ?? created?.id ?? created?.uuid ?? (typeof created === "string" ? created : undefined);

    const report = await fetchSchematicPortsBusesReport(api, { includePorts: false, includeBuses: false });
    const verifiedEntry = report.busEntries.find((e) => e.primitiveId === createdPrimitiveId);

    return {
      executed: true,
      readback: {
        primitiveId: createdPrimitiveId ?? "created_bus_entry",
        startX: op.startX,
        startY: op.startY,
        endX: op.endX,
        endY: op.endY,
        net: op.net,
        verified: Boolean(verifiedEntry || createdPrimitiveId),
        busEntry: verifiedEntry
      }
    };
  }

  if (op.action === "deleteBusEntry") {
    ensureApi("sch_PrimitiveBusEntry", "delete", eda);
    await eda.sch_PrimitiveBusEntry.delete([op.entryId]);

    const report = await fetchSchematicPortsBusesReport(api, { includePorts: false, includeBuses: false });
    const stillExists = report.busEntries.some((e) => e.primitiveId === op.entryId);

    if (stillExists) {
      throw apiError("readback_verification_failed", `Bus entry ${op.entryId} still exists after delete call.`);
    }

    return {
      executed: true,
      readback: {
        entryId: op.entryId,
        deleted: true,
        verified: true
      }
    };
  }

  throw apiError("unsupported_action", `Unsupported schematic bus mutation action "${op.action}".`);
}
