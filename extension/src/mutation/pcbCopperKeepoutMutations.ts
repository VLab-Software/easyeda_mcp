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
import { assertDocumentTargetMatch, extractDocumentIdentity } from "../identity.js";
import { extensionMutations } from "./mutationManager.js";
import type { EasyEdaApi } from "../types.js";

export interface NormalizedCopperZone {
  primitiveId: string;
  net?: string;
  layer: string | number;
  clearance?: number;
  fillType?: string;
  isPoured?: boolean;
  points: Array<{ x: number; y: number }>;
  vertexCount: number;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  locked?: boolean;
  raw?: Record<string, unknown>;
}

export interface NormalizedKeepout {
  primitiveId: string;
  layer: string | number;
  keepoutType?: string;
  points: Array<{ x: number; y: number }>;
  vertexCount: number;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  locked?: boolean;
  raw?: Record<string, unknown>;
}

export type PcbCopperKeepoutOperation =
  | {
      entity: "copperZone";
      action: "create";
      net: string;
      layer: string | number;
      points: Array<{ x: number; y: number }>;
      clearance?: number;
      fillType?: string;
    }
  | {
      entity: "copperZone";
      action: "modify";
      zoneId: string;
      properties: {
        net?: string;
        layer?: string | number;
        clearance?: number;
        fillType?: string;
        points?: Array<{ x: number; y: number }>;
      };
    }
  | {
      entity: "copperZone";
      action: "delete";
      zoneId: string;
    }
  | {
      entity: "copperZone";
      action: "rebuild";
      zoneId?: string;
    }
  | {
      entity: "keepout";
      action: "create";
      layer: string | number;
      points: Array<{ x: number; y: number }>;
      keepoutType?: string;
    }
  | {
      entity: "keepout";
      action: "modify";
      keepoutId: string;
      properties: {
        layer?: string | number;
        keepoutType?: string;
        points?: Array<{ x: number; y: number }>;
      };
    }
  | {
      entity: "keepout";
      action: "delete";
      keepoutId: string;
    };

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

function parsePoints(rawPoints: unknown): Array<{ x: number; y: number }> {
  const arr = toArray(rawPoints);
  const result: Array<{ x: number; y: number }> = [];

  for (const item of arr) {
    if (Array.isArray(item) && item.length >= 2) {
      const x = numeric(item[0]);
      const y = numeric(item[1]);
      if (x !== undefined && y !== undefined) result.push({ x, y });
    } else if (isRecord(item)) {
      const x = numeric((item as any).x ?? (item as any).coordX);
      const y = numeric((item as any).y ?? (item as any).coordY);
      if (x !== undefined && y !== undefined) result.push({ x, y });
    }
  }
  return result;
}

function computeBounds(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Number((maxX - minX).toFixed(4)),
    height: Number((maxY - minY).toFixed(4))
  };
}

export function normalizeCopperZone(raw: unknown, includeRaw = false): NormalizedCopperZone | null {
  if (!raw || typeof raw !== "object") return null;

  const primitiveId = String(getProp(raw, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ?? "");
  if (!primitiveId) return null;

  const net = stringOrUndefined(getProp(raw, "getState_Net", ["net", "netName"]));
  const layer = getProp(raw, "getState_Layer", ["layer", "layerId"]) ?? 1;
  const clearance = numeric(getProp(raw, "getState_Clearance", ["clearance", "clearanceWidth", "spacing"]));
  const fillType =
    stringOrUndefined(
      getProp(raw, ["getState_FillType", "getState_FillStyle"], ["fillType", "fillStyle", "fill", "pourType"])
    ) ?? "solid";
  const isPoured = Boolean(getProp(raw, "getState_IsPoured", ["isPoured", "poured", "rebuilt"]) ?? true);
  const locked = Boolean(getProp(raw, "getState_PrimitiveLock", ["locked", "primitiveLock"]));

  const rawPath = getProp(
    raw,
    ["getState_Path", "getState_Points", "getState_Contour"],
    ["path", "points", "coordinates", "contour"]
  );
  const points = parsePoints(rawPath);
  const bounds = computeBounds(points);

  return {
    primitiveId,
    net,
    layer,
    clearance,
    fillType,
    isPoured,
    points,
    vertexCount: points.length,
    bounds,
    locked,
    ...(includeRaw ? { raw: sanitize(raw) as Record<string, unknown> } : {})
  };
}

export function normalizeKeepout(raw: unknown, includeRaw = false): NormalizedKeepout | null {
  if (!raw || typeof raw !== "object") return null;

  const primitiveId = String(getProp(raw, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ?? "");
  if (!primitiveId) return null;

  const layer = getProp(raw, "getState_Layer", ["layer", "layerId"]) ?? "all";
  const keepoutType =
    stringOrUndefined(getProp(raw, "getState_KeepoutType", ["keepoutType", "type", "restrictionType"])) ?? "all";
  const locked = Boolean(getProp(raw, "getState_PrimitiveLock", ["locked", "primitiveLock"]));

  const rawPath = getProp(
    raw,
    ["getState_Path", "getState_Points", "getState_Contour"],
    ["path", "points", "coordinates", "contour"]
  );
  const points = parsePoints(rawPath);
  const bounds = computeBounds(points);

  return {
    primitiveId,
    layer,
    keepoutType,
    points,
    vertexCount: points.length,
    bounds,
    locked,
    ...(includeRaw ? { raw: sanitize(raw) as Record<string, unknown> } : {})
  };
}

export async function fetchPcbCopperZones(
  eda: EasyEdaApi,
  filters: { net?: string; layer?: string | number; primitiveId?: string; limit?: number; includeRaw?: boolean } = {}
): Promise<{ total: number; count: number; zones: NormalizedCopperZone[] }> {
  let rawList: unknown[] = [];
  if (eda.pcb_PrimitiveCopperArea?.getAll) {
    rawList = toArray(await eda.pcb_PrimitiveCopperArea.getAll());
  } else if (eda.pcb_PrimitiveRegion?.getAll) {
    // Check if regions include copper zones
    const regions = toArray(await eda.pcb_PrimitiveRegion.getAll());
    rawList = regions.filter((r: any) => {
      const type = String(getProp(r, "getState_Type", ["type", "regionType"]) ?? "").toLowerCase();
      return type.includes("copper") || type.includes("pour") || Boolean(r.net || r.netName);
    });
  }

  let zones = rawList
    .map((item) => normalizeCopperZone(item, filters.includeRaw))
    .filter((z): z is NormalizedCopperZone => z !== null);

  const total = zones.length;

  if (filters.primitiveId) {
    const id = filters.primitiveId.toLowerCase();
    zones = zones.filter((z) => z.primitiveId.toLowerCase() === id);
  }
  if (filters.net) {
    const net = filters.net.toLowerCase();
    zones = zones.filter((z) => z.net?.toLowerCase() === net);
  }
  if (filters.layer !== undefined) {
    const layerStr = String(filters.layer).toLowerCase();
    zones = zones.filter((z) => String(z.layer).toLowerCase() === layerStr);
  }

  const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 500) : 100;
  const count = zones.length;
  const limitedZones = zones.slice(0, limit);

  return { total, count, zones: limitedZones };
}

export async function fetchPcbKeepouts(
  eda: EasyEdaApi,
  filters: { layer?: string | number; primitiveId?: string; limit?: number; includeRaw?: boolean } = {}
): Promise<{ total: number; count: number; keepouts: NormalizedKeepout[] }> {
  let rawList: unknown[] = [];
  if (eda.pcb_PrimitiveKeepout?.getAll) {
    rawList = toArray(await eda.pcb_PrimitiveKeepout.getAll());
  } else if (eda.pcb_PrimitiveRegion?.getAll) {
    const regions = toArray(await eda.pcb_PrimitiveRegion.getAll());
    rawList = regions.filter((r: any) => {
      const type = String(getProp(r, "getState_Type", ["type", "regionType"]) ?? "").toLowerCase();
      return type.includes("keepout") || type.includes("restriction");
    });
  }

  let keepouts = rawList
    .map((item) => normalizeKeepout(item, filters.includeRaw))
    .filter((k): k is NormalizedKeepout => k !== null);

  const total = keepouts.length;

  if (filters.primitiveId) {
    const id = filters.primitiveId.toLowerCase();
    keepouts = keepouts.filter((k) => k.primitiveId.toLowerCase() === id);
  }
  if (filters.layer !== undefined && String(filters.layer).toLowerCase() !== "all") {
    const layerStr = String(filters.layer).toLowerCase();
    keepouts = keepouts.filter(
      (k) => String(k.layer).toLowerCase() === layerStr || String(k.layer).toLowerCase() === "all"
    );
  }

  const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 500) : 100;
  const count = keepouts.length;
  const limitedKeepouts = keepouts.slice(0, limit);

  return { total, count, keepouts: limitedKeepouts };
}

export async function preparePcbCopperKeepoutMutation(
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
    throw apiError("wrong_document", "Copper zone and keepout mutations require an active PCB document.");
  }

  const entity = String(params.entity ?? "").toLowerCase();
  const action = String(params.action ?? "").toLowerCase();

  if (!["copperzone", "keepout"].includes(entity)) {
    throw apiError("invalid_parameters", "Parameter 'entity' must be 'copperZone' or 'keepout'.");
  }
  if (!["create", "modify", "delete", "rebuild"].includes(action)) {
    throw apiError("invalid_parameters", "Parameter 'action' must be 'create', 'modify', 'delete', or 'rebuild'.");
  }

  if (entity === "copperzone") {
    if (action === "create") {
      const net = stringOrUndefined(params.net);
      if (!net) {
        throw apiError("missing_parameters", "Copper zone creation requires 'net'.");
      }
      const layer = params.layer ?? 1;
      let points = parsePoints(params.points);

      // Support rectangular box as points shortcut
      if (points.length === 0 && params.x !== undefined && params.y !== undefined && params.width && params.height) {
        const x = Number(params.x);
        const y = Number(params.y);
        const w = Number(params.width);
        const h = Number(params.height);
        points = [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h }
        ];
      }

      if (points.length < 3) {
        throw apiError(
          "missing_parameters",
          "Copper zone requires 'points' with at least 3 vertices (or x, y, width, height)."
        );
      }

      const clearance = numeric(params.clearance) ?? 0.254;
      const fillType = stringOrUndefined(params.fillType) ?? "solid";
      const bounds = computeBounds(points);

      const impact = `Creates copper zone on layer ${layer} (Net: ${net}, fill: ${fillType}, clearance: ${clearance}mm, area: ${bounds.width * bounds.height}mm²).`;
      const operation: PcbCopperKeepoutOperation = {
        entity: "copperZone",
        action: "create",
        net,
        layer,
        points,
        clearance,
        fillType
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "createCopperZone",
        target: currentTarget,
        operation,
        before: { exists: false },
        requestedAfter: { net, layer, points, clearance, fillType, bounds },
        changedKeys: ["net", "layer", "points", "clearance", "fillType"],
        scope: `copperZone:create:layer=${layer}:net=${net}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "createCopperZone",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "modify") {
      const zoneId = pickString(params, ["zoneId", "primitiveId", "id"]);
      if (!zoneId) {
        throw apiError("missing_parameters", "Copper zone modification requires 'zoneId'.");
      }
      const properties = isRecord(params.properties) ? (params.properties as Record<string, any>) : {};
      const changedKeys = Object.keys(properties);
      if (changedKeys.length === 0) {
        throw apiError("missing_parameters", "Copper zone modification requires non-empty 'properties' object.");
      }

      const { zones } = await fetchPcbCopperZones(eda, { primitiveId: zoneId, limit: 1 });
      const currentZone = zones[0];
      if (!currentZone) {
        throw apiError("not_found", `Copper zone with primitiveId '${zoneId}' not found on active PCB.`);
      }

      const impact = `Modifies copper zone ${zoneId} (Net: ${currentZone.net ?? "none"}, Layer: ${currentZone.layer}) changing fields: ${changedKeys.join(", ")}.`;
      const operation: PcbCopperKeepoutOperation = {
        entity: "copperZone",
        action: "modify",
        zoneId,
        properties
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "modifyCopperZone",
        target: currentTarget,
        operation,
        before: currentZone,
        requestedAfter: { ...currentZone, ...properties },
        changedKeys,
        scope: `copperZone:modify:${zoneId}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "modifyCopperZone",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "delete") {
      const zoneId = pickString(params, ["zoneId", "primitiveId", "id"]);
      if (!zoneId) {
        throw apiError("missing_parameters", "Copper zone deletion requires 'zoneId'.");
      }

      const { zones } = await fetchPcbCopperZones(eda, { primitiveId: zoneId, limit: 1 });
      const currentZone = zones[0];
      if (!currentZone) {
        throw apiError("not_found", `Copper zone with primitiveId '${zoneId}' not found on active PCB.`);
      }

      const impact = `Destructively deletes copper zone ${zoneId} (Net: ${currentZone.net ?? "none"}, Layer: ${currentZone.layer}).`;
      const operation: PcbCopperKeepoutOperation = {
        entity: "copperZone",
        action: "delete",
        zoneId
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "deleteCopperZone",
        target: currentTarget,
        operation,
        before: currentZone,
        requestedAfter: { exists: false },
        changedKeys: ["deleted"],
        scope: `copperZone:delete:${zoneId}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "deleteCopperZone",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "rebuild") {
      const zoneId = pickString(params, ["zoneId", "primitiveId", "id"]);
      const { zones } = await fetchPcbCopperZones(eda, { limit: 100 });
      const impact = zoneId
        ? `Rebuilds copper pour calculations for zone ${zoneId}.`
        : `Rebuilds all copper pours across the entire PCB (${zones.length} zone(s)).`;

      const operation: PcbCopperKeepoutOperation = {
        entity: "copperZone",
        action: "rebuild",
        zoneId
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "rebuildCopper",
        target: currentTarget,
        operation,
        before: { totalZones: zones.length, zones: zones.map((z) => ({ id: z.primitiveId, net: z.net })) },
        requestedAfter: { rebuilt: true, zoneId },
        changedKeys: ["rebuilt"],
        scope: zoneId ? `copperZone:rebuild:${zoneId}` : `copperZone:rebuild:all`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "rebuildCopper",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }
  }

  if (entity === "keepout") {
    if (action === "create") {
      const layer = params.layer ?? "all";
      let points = parsePoints(params.points);

      if (points.length === 0 && params.x !== undefined && params.y !== undefined && params.width && params.height) {
        const x = Number(params.x);
        const y = Number(params.y);
        const w = Number(params.width);
        const h = Number(params.height);
        points = [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h }
        ];
      }

      if (points.length < 3) {
        throw apiError(
          "missing_parameters",
          "Keepout requires 'points' with at least 3 vertices (or x, y, width, height)."
        );
      }

      const keepoutType = stringOrUndefined(params.keepoutType) ?? "all";
      const bounds = computeBounds(points);

      const impact = `Creates keepout area on layer ${layer} (type: ${keepoutType}, area: ${bounds.width * bounds.height}mm²).`;
      const operation: PcbCopperKeepoutOperation = {
        entity: "keepout",
        action: "create",
        layer,
        points,
        keepoutType
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "createKeepout",
        target: currentTarget,
        operation,
        before: { exists: false },
        requestedAfter: { layer, points, keepoutType, bounds },
        changedKeys: ["layer", "points", "keepoutType"],
        scope: `keepout:create:layer=${layer}:type=${keepoutType}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "createKeepout",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "modify") {
      const keepoutId = pickString(params, ["keepoutId", "primitiveId", "id"]);
      if (!keepoutId) {
        throw apiError("missing_parameters", "Keepout modification requires 'keepoutId'.");
      }
      const properties = isRecord(params.properties) ? (params.properties as Record<string, any>) : {};
      const changedKeys = Object.keys(properties);
      if (changedKeys.length === 0) {
        throw apiError("missing_parameters", "Keepout modification requires non-empty 'properties' object.");
      }

      const { keepouts } = await fetchPcbKeepouts(eda, { primitiveId: keepoutId, limit: 1 });
      const currentKeepout = keepouts[0];
      if (!currentKeepout) {
        throw apiError("not_found", `Keepout with primitiveId '${keepoutId}' not found on active PCB.`);
      }

      const impact = `Modifies keepout ${keepoutId} (Layer: ${currentKeepout.layer}, Type: ${currentKeepout.keepoutType}) changing fields: ${changedKeys.join(", ")}.`;
      const operation: PcbCopperKeepoutOperation = {
        entity: "keepout",
        action: "modify",
        keepoutId,
        properties
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "modifyKeepout",
        target: currentTarget,
        operation,
        before: currentKeepout,
        requestedAfter: { ...currentKeepout, ...properties },
        changedKeys,
        scope: `keepout:modify:${keepoutId}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "modifyKeepout",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "delete") {
      const keepoutId = pickString(params, ["keepoutId", "primitiveId", "id"]);
      if (!keepoutId) {
        throw apiError("missing_parameters", "Keepout deletion requires 'keepoutId'.");
      }

      const { keepouts } = await fetchPcbKeepouts(eda, { primitiveId: keepoutId, limit: 1 });
      const currentKeepout = keepouts[0];
      if (!currentKeepout) {
        throw apiError("not_found", `Keepout with primitiveId '${keepoutId}' not found on active PCB.`);
      }

      const impact = `Destructively deletes keepout ${keepoutId} (Layer: ${currentKeepout.layer}, Type: ${currentKeepout.keepoutType}).`;
      const operation: PcbCopperKeepoutOperation = {
        entity: "keepout",
        action: "delete",
        keepoutId
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "deleteKeepout",
        target: currentTarget,
        operation,
        before: currentKeepout,
        requestedAfter: { exists: false },
        changedKeys: ["deleted"],
        scope: `keepout:delete:${keepoutId}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "deleteKeepout",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }
  }

  throw apiError("invalid_parameters", `Unsupported copper/keepout mutation operation '${entity}:${action}'.`);
}

export async function executePcbCopperKeepoutMutation(
  api: () => EasyEdaApi,
  op: PcbCopperKeepoutOperation,
  before?: unknown
): Promise<{ executed: boolean; readback: Record<string, unknown> }> {
  const eda = api();

  if (op.entity === "copperZone") {
    if (op.action === "create") {
      let createdId: string | undefined;

      if (eda.pcb_PrimitiveCopperArea?.create) {
        const res = await eda.pcb_PrimitiveCopperArea.create({
          net: op.net,
          layer: op.layer,
          path: op.points,
          clearance: op.clearance,
          fillType: op.fillType
        });
        createdId = stringOrUndefined(
          getProp(res, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ??
            (typeof res === "string" ? res : undefined)
        );
      } else if (eda.pcb_PrimitiveRegion?.create) {
        const res = await eda.pcb_PrimitiveRegion.create({
          type: "copperArea",
          layer: op.layer,
          net: op.net,
          path: op.points,
          clearance: op.clearance
        });
        createdId = stringOrUndefined(
          getProp(res, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ??
            (typeof res === "string" ? res : undefined)
        );
      } else {
        ensureApi("pcb_PrimitiveCopperArea", "create", eda);
      }

      // Readback verification
      const { zones } = await fetchPcbCopperZones(eda, {
        net: op.net,
        layer: op.layer,
        primitiveId: createdId,
        limit: 10
      });

      const matchedZone = createdId ? zones.find((z) => z.primitiveId === createdId) : zones[0];
      if (!matchedZone) {
        throw apiError("readback_failed", "Created copper zone could not be verified on readback.");
      }

      return {
        executed: true,
        readback: {
          action: "createCopperZone",
          primitiveId: matchedZone.primitiveId,
          zone: matchedZone
        }
      };
    }

    if (op.action === "modify") {
      if (eda.pcb_PrimitiveCopperArea?.modify) {
        await eda.pcb_PrimitiveCopperArea.modify(op.zoneId, op.properties);
      } else if (eda.pcb_PrimitiveRegion?.modify) {
        await eda.pcb_PrimitiveRegion.modify(op.zoneId, op.properties);
      } else {
        ensureApi("pcb_PrimitiveCopperArea", "modify", eda);
      }

      // Readback verification
      const { zones } = await fetchPcbCopperZones(eda, { primitiveId: op.zoneId, limit: 1 });
      const modifiedZone = zones[0];
      if (!modifiedZone) {
        throw apiError("readback_failed", `Modified copper zone '${op.zoneId}' could not be read back.`);
      }

      return {
        executed: true,
        readback: {
          action: "modifyCopperZone",
          primitiveId: op.zoneId,
          before,
          zone: modifiedZone
        }
      };
    }

    if (op.action === "delete") {
      if (eda.pcb_PrimitiveCopperArea?.delete) {
        await eda.pcb_PrimitiveCopperArea.delete([op.zoneId]);
      } else if (eda.pcb_PrimitiveRegion?.delete) {
        await eda.pcb_PrimitiveRegion.delete([op.zoneId]);
      } else {
        ensureApi("pcb_PrimitiveCopperArea", "delete", eda);
      }

      // Readback verification: verify it is gone
      const { zones } = await fetchPcbCopperZones(eda, { primitiveId: op.zoneId, limit: 1 });
      if (zones.length > 0) {
        throw apiError("readback_failed", `Copper zone '${op.zoneId}' still exists after delete operation.`);
      }

      return {
        executed: true,
        readback: {
          action: "deleteCopperZone",
          primitiveId: op.zoneId,
          deleted: true
        }
      };
    }

    if (op.action === "rebuild") {
      if (eda.pcb_Document?.rebuildAllCopperArea) {
        await eda.pcb_Document.rebuildAllCopperArea();
      } else if (eda.pcb_Document?.rebuildCopperArea) {
        await eda.pcb_Document.rebuildCopperArea(op.zoneId);
      } else if (eda.pcb_PrimitiveCopperArea?.rebuildAll) {
        await eda.pcb_PrimitiveCopperArea.rebuildAll();
      } else if (eda.pcb_PrimitiveCopperArea?.rebuild && op.zoneId) {
        await eda.pcb_PrimitiveCopperArea.rebuild(op.zoneId);
      } else if (eda.pcb_Document?.rebuildCopper) {
        await eda.pcb_Document.rebuildCopper();
      } else {
        ensureApi("pcb_Document", "rebuildAllCopperArea", eda);
      }

      const { total, zones } = await fetchPcbCopperZones(eda, { limit: 100 });
      return {
        executed: true,
        readback: {
          action: "rebuildCopper",
          rebuilt: true,
          zoneId: op.zoneId ?? "all",
          totalZones: total,
          zones: zones.map((z) => ({ primitiveId: z.primitiveId, net: z.net, isPoured: z.isPoured }))
        }
      };
    }
  }

  if (op.entity === "keepout") {
    if (op.action === "create") {
      let createdId: string | undefined;

      if (eda.pcb_PrimitiveKeepout?.create) {
        const res = await eda.pcb_PrimitiveKeepout.create({
          layer: op.layer,
          path: op.points,
          keepoutType: op.keepoutType
        });
        createdId = stringOrUndefined(
          getProp(res, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ??
            (typeof res === "string" ? res : undefined)
        );
      } else if (eda.pcb_PrimitiveRegion?.create) {
        const res = await eda.pcb_PrimitiveRegion.create({
          type: "keepout",
          layer: op.layer,
          path: op.points,
          keepoutType: op.keepoutType
        });
        createdId = stringOrUndefined(
          getProp(res, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ??
            (typeof res === "string" ? res : undefined)
        );
      } else {
        ensureApi("pcb_PrimitiveKeepout", "create", eda);
      }

      // Readback verification
      const { keepouts } = await fetchPcbKeepouts(eda, {
        layer: op.layer,
        primitiveId: createdId,
        limit: 10
      });

      const matchedKeepout = createdId ? keepouts.find((k) => k.primitiveId === createdId) : keepouts[0];
      if (!matchedKeepout) {
        throw apiError("readback_failed", "Created keepout could not be verified on readback.");
      }

      return {
        executed: true,
        readback: {
          action: "createKeepout",
          primitiveId: matchedKeepout.primitiveId,
          keepout: matchedKeepout
        }
      };
    }

    if (op.action === "modify") {
      if (eda.pcb_PrimitiveKeepout?.modify) {
        await eda.pcb_PrimitiveKeepout.modify(op.keepoutId, op.properties);
      } else if (eda.pcb_PrimitiveRegion?.modify) {
        await eda.pcb_PrimitiveRegion.modify(op.keepoutId, op.properties);
      } else {
        ensureApi("pcb_PrimitiveKeepout", "modify", eda);
      }

      // Readback verification
      const { keepouts } = await fetchPcbKeepouts(eda, { primitiveId: op.keepoutId, limit: 1 });
      const modifiedKeepout = keepouts[0];
      if (!modifiedKeepout) {
        throw apiError("readback_failed", `Modified keepout '${op.keepoutId}' could not be read back.`);
      }

      return {
        executed: true,
        readback: {
          action: "modifyKeepout",
          primitiveId: op.keepoutId,
          before,
          keepout: modifiedKeepout
        }
      };
    }

    if (op.action === "delete") {
      if (eda.pcb_PrimitiveKeepout?.delete) {
        await eda.pcb_PrimitiveKeepout.delete([op.keepoutId]);
      } else if (eda.pcb_PrimitiveRegion?.delete) {
        await eda.pcb_PrimitiveRegion.delete([op.keepoutId]);
      } else {
        ensureApi("pcb_PrimitiveKeepout", "delete", eda);
      }

      // Readback verification
      const { keepouts } = await fetchPcbKeepouts(eda, { primitiveId: op.keepoutId, limit: 1 });
      if (keepouts.length > 0) {
        throw apiError("readback_failed", `Keepout '${op.keepoutId}' still exists after delete operation.`);
      }

      return {
        executed: true,
        readback: {
          action: "deleteKeepout",
          primitiveId: op.keepoutId,
          deleted: true
        }
      };
    }
  }

  throw apiError("invalid_parameters", "Unsupported operation for copper/keepout execution.");
}
