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

export interface NormalizedPcbTrack {
  primitiveId: string;
  net?: string;
  layer: string | number;
  lineWidth: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  length: number;
  locked?: boolean;
  raw?: Record<string, unknown>;
}

export interface NormalizedPcbVia {
  primitiveId: string;
  net?: string;
  x: number;
  y: number;
  diameter: number;
  holeDiameter: number;
  startLayer?: string | number;
  endLayer?: string | number;
  locked?: boolean;
  raw?: Record<string, unknown>;
}

export type PcbTrackViaOperation =
  | {
      entity: "track";
      action: "create";
      net: string;
      layer: string | number;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      lineWidth?: number;
    }
  | {
      entity: "track";
      action: "modify";
      trackId: string;
      properties: {
        net?: string;
        layer?: string | number;
        lineWidth?: number;
        startX?: number;
        startY?: number;
        endX?: number;
        endY?: number;
      };
    }
  | {
      entity: "track";
      action: "delete";
      trackId: string;
    }
  | {
      entity: "via";
      action: "create";
      net: string;
      x: number;
      y: number;
      diameter?: number;
      holeDiameter?: number;
      startLayer?: string | number;
      endLayer?: string | number;
    }
  | {
      entity: "via";
      action: "modify";
      viaId: string;
      properties: {
        net?: string;
        x?: number;
        y?: number;
        diameter?: number;
        holeDiameter?: number;
        startLayer?: string | number;
        endLayer?: string | number;
      };
    }
  | {
      entity: "via";
      action: "delete";
      viaId: string;
    };

function getProp(obj: any, getterName: string, propNames: string[]): any {
  if (!obj || typeof obj !== "object") return undefined;
  if (typeof obj[getterName] === "function") {
    try {
      const val = obj[getterName]();
      if (val !== undefined && val !== null) return val;
    } catch {
      // ignore
    }
  }
  for (const prop of propNames) {
    if (obj[prop] !== undefined && obj[prop] !== null) {
      return obj[prop];
    }
  }
  return undefined;
}

export function normalizePcbTrack(raw: unknown, includeRaw = false): NormalizedPcbTrack | null {
  if (!raw || typeof raw !== "object") return null;

  const primitiveId = String(getProp(raw, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ?? "");
  if (!primitiveId) return null;

  const net = stringOrUndefined(getProp(raw, "getState_Net", ["net", "netName"]));
  const layer = getProp(raw, "getState_Layer", ["layer", "layerId"]) ?? 1;
  const lineWidth = numeric(getProp(raw, "getState_LineWidth", ["lineWidth", "width"])) ?? 0.254;
  const startX = numeric(getProp(raw, "getState_StartX", ["startX", "x1"])) ?? 0;
  const startY = numeric(getProp(raw, "getState_StartY", ["startY", "y1"])) ?? 0;
  const endX = numeric(getProp(raw, "getState_EndX", ["endX", "x2"])) ?? 0;
  const endY = numeric(getProp(raw, "getState_EndY", ["endY", "y2"])) ?? 0;
  const locked = Boolean(getProp(raw, "getState_PrimitiveLock", ["locked", "primitiveLock"]));

  const dx = endX - startX;
  const dy = endY - startY;
  const length = Number(Math.sqrt(dx * dx + dy * dy).toFixed(4));

  return {
    primitiveId,
    net,
    layer,
    lineWidth,
    startX,
    startY,
    endX,
    endY,
    length,
    locked,
    ...(includeRaw ? { raw: sanitize(raw) as Record<string, unknown> } : {})
  };
}

export function normalizePcbVia(raw: unknown, includeRaw = false): NormalizedPcbVia | null {
  if (!raw || typeof raw !== "object") return null;

  const primitiveId = String(getProp(raw, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ?? "");
  if (!primitiveId) return null;

  const net = stringOrUndefined(getProp(raw, "getState_Net", ["net", "netName"]));
  const x = numeric(getProp(raw, "getState_X", ["x", "centerX"])) ?? 0;
  const y = numeric(getProp(raw, "getState_Y", ["y", "centerY"])) ?? 0;
  const diameter = numeric(getProp(raw, "getState_Diameter", ["diameter", "size", "outerDiameter"])) ?? 0.6;
  const holeDiameter = numeric(getProp(raw, "getState_HoleDiameter", ["holeDiameter", "hole", "drill"])) ?? 0.3;
  const startLayer = getProp(raw, "getState_StartLayer", ["startLayer", "fromLayer"]);
  const endLayer = getProp(raw, "getState_EndLayer", ["endLayer", "toLayer"]);
  const locked = Boolean(getProp(raw, "getState_PrimitiveLock", ["locked", "primitiveLock"]));

  return {
    primitiveId,
    net,
    x,
    y,
    diameter,
    holeDiameter,
    startLayer,
    endLayer,
    locked,
    ...(includeRaw ? { raw: sanitize(raw) as Record<string, unknown> } : {})
  };
}

export async function fetchPcbTracks(
  eda: EasyEdaApi,
  filters: { net?: string; layer?: string | number; primitiveId?: string; limit?: number; includeRaw?: boolean } = {}
): Promise<{ total: number; count: number; tracks: NormalizedPcbTrack[] }> {
  let rawList: unknown[] = [];
  if (eda.pcb_PrimitiveTrack?.getAll) {
    rawList = toArray(await eda.pcb_PrimitiveTrack.getAll());
  } else if (eda.pcb_PrimitiveLine?.getAll) {
    rawList = toArray(await eda.pcb_PrimitiveLine.getAll());
  }

  let tracks = rawList
    .map((item) => normalizePcbTrack(item, filters.includeRaw))
    .filter((t): t is NormalizedPcbTrack => t !== null);

  const total = tracks.length;

  if (filters.primitiveId) {
    const id = filters.primitiveId.toLowerCase();
    tracks = tracks.filter((t) => t.primitiveId.toLowerCase() === id);
  }
  if (filters.net) {
    const net = filters.net.toLowerCase();
    tracks = tracks.filter((t) => t.net?.toLowerCase() === net);
  }
  if (filters.layer !== undefined) {
    const layerStr = String(filters.layer).toLowerCase();
    tracks = tracks.filter((t) => String(t.layer).toLowerCase() === layerStr);
  }

  const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 500) : 100;
  const count = tracks.length;
  const limitedTracks = tracks.slice(0, limit);

  return { total, count, tracks: limitedTracks };
}

export async function fetchPcbVias(
  eda: EasyEdaApi,
  filters: { net?: string; primitiveId?: string; limit?: number; includeRaw?: boolean } = {}
): Promise<{ total: number; count: number; vias: NormalizedPcbVia[] }> {
  let rawList: unknown[] = [];
  if (eda.pcb_PrimitiveVia?.getAll) {
    rawList = toArray(await eda.pcb_PrimitiveVia.getAll());
  }

  let vias = rawList
    .map((item) => normalizePcbVia(item, filters.includeRaw))
    .filter((v): v is NormalizedPcbVia => v !== null);

  const total = vias.length;

  if (filters.primitiveId) {
    const id = filters.primitiveId.toLowerCase();
    vias = vias.filter((v) => v.primitiveId.toLowerCase() === id);
  }
  if (filters.net) {
    const net = filters.net.toLowerCase();
    vias = vias.filter((v) => v.net?.toLowerCase() === net);
  }

  const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 500) : 100;
  const count = vias.length;
  const limitedVias = vias.slice(0, limit);

  return { total, count, vias: limitedVias };
}

export async function preparePcbTrackViaMutation(
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
    throw apiError("wrong_document", "PCB track and via mutations require an active PCB document.");
  }

  const entity = String(params.entity ?? "").toLowerCase();
  const action = String(params.action ?? "").toLowerCase();

  if (!["track", "via"].includes(entity)) {
    throw apiError("invalid_parameters", "Parameter 'entity' must be 'track' or 'via'.");
  }
  if (!["create", "modify", "delete"].includes(action)) {
    throw apiError("invalid_parameters", "Parameter 'action' must be 'create', 'modify', or 'delete'.");
  }

  if (entity === "track") {
    if (action === "create") {
      const net = stringOrUndefined(params.net);
      if (!net) {
        throw apiError("missing_parameters", "Track creation requires 'net'.");
      }
      const layer = params.layer ?? 1;
      const startX = numeric(params.startX);
      const startY = numeric(params.startY);
      const endX = numeric(params.endX);
      const endY = numeric(params.endY);
      if (startX === undefined || startY === undefined || endX === undefined || endY === undefined) {
        throw apiError("missing_parameters", "Track creation requires 'startX', 'startY', 'endX', and 'endY'.");
      }
      const lineWidth = numeric(params.lineWidth) ?? 0.254;

      const impact = `Creates PCB track on layer ${layer} (Net: ${net}, width: ${lineWidth}mm) from (${startX}, ${startY}) to (${endX}, ${endY}).`;
      const operation: PcbTrackViaOperation = {
        entity: "track",
        action: "create",
        net,
        layer,
        startX,
        startY,
        endX,
        endY,
        lineWidth
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "createTrack",
        target: currentTarget,
        operation,
        before: { exists: false },
        requestedAfter: { net, layer, startX, startY, endX, endY, lineWidth },
        changedKeys: ["net", "layer", "startX", "startY", "endX", "endY", "lineWidth"],
        scope: `track:create:layer=${layer}:net=${net}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "createTrack",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "modify") {
      const trackId = pickString(params, ["trackId", "primitiveId", "id"]);
      if (!trackId) {
        throw apiError("missing_parameters", "Track modification requires 'trackId'.");
      }
      const properties = isRecord(params.properties) ? (params.properties as Record<string, any>) : {};
      const changedKeys = Object.keys(properties);
      if (changedKeys.length === 0) {
        throw apiError("missing_parameters", "Track modification requires non-empty 'properties' object.");
      }

      const { tracks } = await fetchPcbTracks(eda, { primitiveId: trackId, limit: 1 });
      const currentTrack = tracks[0];
      if (!currentTrack) {
        throw apiError("not_found", `Track with primitiveId '${trackId}' not found on active PCB.`);
      }

      const impact = `Modifies PCB track ${trackId} (Net: ${currentTrack.net ?? "none"}, Layer: ${currentTrack.layer}) changing fields: ${changedKeys.join(", ")}.`;
      const operation: PcbTrackViaOperation = {
        entity: "track",
        action: "modify",
        trackId,
        properties
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "modifyTrack",
        target: currentTarget,
        operation,
        before: currentTrack,
        requestedAfter: { ...currentTrack, ...properties },
        changedKeys,
        scope: `track:modify:${trackId}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "modifyTrack",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "delete") {
      const trackId = pickString(params, ["trackId", "primitiveId", "id"]);
      if (!trackId) {
        throw apiError("missing_parameters", "Track deletion requires 'trackId'.");
      }

      const { tracks } = await fetchPcbTracks(eda, { primitiveId: trackId, limit: 1 });
      const currentTrack = tracks[0];
      if (!currentTrack) {
        throw apiError("not_found", `Track with primitiveId '${trackId}' not found on active PCB.`);
      }

      const impact = `Destructively deletes PCB track ${trackId} (Net: ${currentTrack.net ?? "none"}, Layer: ${currentTrack.layer}, length: ${currentTrack.length}mm).`;
      const operation: PcbTrackViaOperation = {
        entity: "track",
        action: "delete",
        trackId
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "deleteTrack",
        target: currentTarget,
        operation,
        before: currentTrack,
        requestedAfter: { exists: false },
        changedKeys: ["deleted"],
        scope: `track:delete:${trackId}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "deleteTrack",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }
  }

  if (entity === "via") {
    if (action === "create") {
      const net = stringOrUndefined(params.net);
      if (!net) {
        throw apiError("missing_parameters", "Via creation requires 'net'.");
      }
      const x = numeric(params.x);
      const y = numeric(params.y);
      if (x === undefined || y === undefined) {
        throw apiError("missing_parameters", "Via creation requires 'x' and 'y'.");
      }
      const diameter = numeric(params.diameter) ?? 0.6;
      const holeDiameter = numeric(params.holeDiameter) ?? 0.3;
      const startLayer = params.startLayer;
      const endLayer = params.endLayer;

      const impact = `Creates PCB via at (${x}, ${y}) (Net: ${net}, outer: ${diameter}mm, drill: ${holeDiameter}mm).`;
      const operation: PcbTrackViaOperation = {
        entity: "via",
        action: "create",
        net,
        x,
        y,
        diameter,
        holeDiameter,
        startLayer,
        endLayer
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "createVia",
        target: currentTarget,
        operation,
        before: { exists: false },
        requestedAfter: { net, x, y, diameter, holeDiameter, startLayer, endLayer },
        changedKeys: ["net", "x", "y", "diameter", "holeDiameter"],
        scope: `via:create:net=${net}:at=(${x},${y})`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "createVia",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "modify") {
      const viaId = pickString(params, ["viaId", "primitiveId", "id"]);
      if (!viaId) {
        throw apiError("missing_parameters", "Via modification requires 'viaId'.");
      }
      const properties = isRecord(params.properties) ? (params.properties as Record<string, any>) : {};
      const changedKeys = Object.keys(properties);
      if (changedKeys.length === 0) {
        throw apiError("missing_parameters", "Via modification requires non-empty 'properties' object.");
      }

      const { vias } = await fetchPcbVias(eda, { primitiveId: viaId, limit: 1 });
      const currentVia = vias[0];
      if (!currentVia) {
        throw apiError("not_found", `Via with primitiveId '${viaId}' not found on active PCB.`);
      }

      const impact = `Modifies PCB via ${viaId} (Net: ${currentVia.net ?? "none"}, at (${currentVia.x}, ${currentVia.y})) changing fields: ${changedKeys.join(", ")}.`;
      const operation: PcbTrackViaOperation = {
        entity: "via",
        action: "modify",
        viaId,
        properties
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "modifyVia",
        target: currentTarget,
        operation,
        before: currentVia,
        requestedAfter: { ...currentVia, ...properties },
        changedKeys,
        scope: `via:modify:${viaId}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "modifyVia",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }

    if (action === "delete") {
      const viaId = pickString(params, ["viaId", "primitiveId", "id"]);
      if (!viaId) {
        throw apiError("missing_parameters", "Via deletion requires 'viaId'.");
      }

      const { vias } = await fetchPcbVias(eda, { primitiveId: viaId, limit: 1 });
      const currentVia = vias[0];
      if (!currentVia) {
        throw apiError("not_found", `Via with primitiveId '${viaId}' not found on active PCB.`);
      }

      const impact = `Destructively deletes PCB via ${viaId} at (${currentVia.x}, ${currentVia.y}) (Net: ${currentVia.net ?? "none"}).`;
      const operation: PcbTrackViaOperation = {
        entity: "via",
        action: "delete",
        viaId
      };

      const record = extensionMutations.prepare({
        domain: "pcb",
        action: "deleteVia",
        target: currentTarget,
        operation,
        before: currentVia,
        requestedAfter: { exists: false },
        changedKeys: ["deleted"],
        scope: `via:delete:${viaId}`,
        impact,
        ttlMs: 5 * 60_000
      });

      return {
        mutationId: record.mutationId,
        confirmation: record.confirmation,
        action: "deleteVia",
        target: record.target,
        preview: record.preview,
        expiresAt: record.expiresAt
      };
    }
  }

  throw apiError("invalid_parameters", `Unsupported track/via mutation operation '${entity}:${action}'.`);
}

export async function executePcbTrackViaMutation(
  api: () => EasyEdaApi,
  op: PcbTrackViaOperation,
  before?: unknown
): Promise<{ executed: boolean; readback: Record<string, unknown> }> {
  const eda = api();

  if (op.entity === "track") {
    if (op.action === "create") {
      let createdId: string | undefined;

      if (eda.pcb_PrimitiveTrack?.create) {
        const res = await eda.pcb_PrimitiveTrack.create({
          net: op.net,
          layer: op.layer,
          startX: op.startX,
          startY: op.startY,
          endX: op.endX,
          endY: op.endY,
          lineWidth: op.lineWidth
        });
        createdId = stringOrUndefined(
          getProp(res, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ??
            (typeof res === "string" ? res : undefined)
        );
      } else if (eda.pcb_PrimitiveLine?.create) {
        const res = await eda.pcb_PrimitiveLine.create(
          op.startX,
          op.startY,
          op.endX,
          op.endY,
          op.layer,
          op.lineWidth,
          op.net
        );
        createdId = stringOrUndefined(
          getProp(res, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ??
            (typeof res === "string" ? res : undefined)
        );
      } else {
        ensureApi("pcb_PrimitiveTrack", "create", eda);
      }

      // Readback verification
      const { tracks } = await fetchPcbTracks(eda, {
        net: op.net,
        layer: op.layer,
        primitiveId: createdId,
        limit: 10
      });

      const matchedTrack = createdId ? tracks.find((t) => t.primitiveId === createdId) : tracks[0];
      if (!matchedTrack) {
        throw apiError("readback_failed", "Created PCB track could not be verified on readback.");
      }

      return {
        executed: true,
        readback: {
          action: "createTrack",
          primitiveId: matchedTrack.primitiveId,
          track: matchedTrack
        }
      };
    }

    if (op.action === "modify") {
      if (eda.pcb_PrimitiveTrack?.modify) {
        await eda.pcb_PrimitiveTrack.modify(op.trackId, op.properties);
      } else if (eda.pcb_PrimitiveLine?.modify) {
        await eda.pcb_PrimitiveLine.modify(op.trackId, op.properties);
      } else {
        ensureApi("pcb_PrimitiveTrack", "modify", eda);
      }

      // Readback verification
      const { tracks } = await fetchPcbTracks(eda, { primitiveId: op.trackId, limit: 1 });
      const modifiedTrack = tracks[0];
      if (!modifiedTrack) {
        throw apiError("readback_failed", `Modified PCB track '${op.trackId}' could not be read back.`);
      }

      return {
        executed: true,
        readback: {
          action: "modifyTrack",
          primitiveId: op.trackId,
          before,
          track: modifiedTrack
        }
      };
    }

    if (op.action === "delete") {
      if (eda.pcb_PrimitiveTrack?.delete) {
        await eda.pcb_PrimitiveTrack.delete([op.trackId]);
      } else if (eda.pcb_PrimitiveLine?.delete) {
        await eda.pcb_PrimitiveLine.delete([op.trackId]);
      } else {
        ensureApi("pcb_PrimitiveTrack", "delete", eda);
      }

      // Readback verification: verify it is gone
      const { tracks } = await fetchPcbTracks(eda, { primitiveId: op.trackId, limit: 1 });
      if (tracks.length > 0) {
        throw apiError("readback_failed", `PCB track '${op.trackId}' still exists after delete operation.`);
      }

      return {
        executed: true,
        readback: {
          action: "deleteTrack",
          primitiveId: op.trackId,
          deleted: true
        }
      };
    }
  }

  if (op.entity === "via") {
    if (op.action === "create") {
      ensureApi("pcb_PrimitiveVia", "create", eda);
      const res = await eda.pcb_PrimitiveVia.create({
        net: op.net,
        x: op.x,
        y: op.y,
        diameter: op.diameter,
        holeDiameter: op.holeDiameter,
        startLayer: op.startLayer,
        endLayer: op.endLayer
      });

      const createdId = stringOrUndefined(
        getProp(res, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ??
          (typeof res === "string" ? res : undefined)
      );

      // Readback verification
      const { vias } = await fetchPcbVias(eda, {
        net: op.net,
        primitiveId: createdId,
        limit: 10
      });

      const matchedVia = createdId ? vias.find((v) => v.primitiveId === createdId) : vias[0];
      if (!matchedVia) {
        throw apiError("readback_failed", "Created PCB via could not be verified on readback.");
      }

      return {
        executed: true,
        readback: {
          action: "createVia",
          primitiveId: matchedVia.primitiveId,
          via: matchedVia
        }
      };
    }

    if (op.action === "modify") {
      ensureApi("pcb_PrimitiveVia", "modify", eda);
      await eda.pcb_PrimitiveVia.modify(op.viaId, op.properties);

      // Readback verification
      const { vias } = await fetchPcbVias(eda, { primitiveId: op.viaId, limit: 1 });
      const modifiedVia = vias[0];
      if (!modifiedVia) {
        throw apiError("readback_failed", `Modified PCB via '${op.viaId}' could not be read back.`);
      }

      return {
        executed: true,
        readback: {
          action: "modifyVia",
          primitiveId: op.viaId,
          before,
          via: modifiedVia
        }
      };
    }

    if (op.action === "delete") {
      ensureApi("pcb_PrimitiveVia", "delete", eda);
      await eda.pcb_PrimitiveVia.delete([op.viaId]);

      // Readback verification
      const { vias } = await fetchPcbVias(eda, { primitiveId: op.viaId, limit: 1 });
      if (vias.length > 0) {
        throw apiError("readback_failed", `PCB via '${op.viaId}' still exists after delete operation.`);
      }

      return {
        executed: true,
        readback: {
          action: "deleteVia",
          primitiveId: op.viaId,
          deleted: true
        }
      };
    }
  }

  throw apiError("invalid_parameters", "Unsupported operation for track/via execution.");
}
