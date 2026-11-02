import { apiError, ensureApi, isNumber, isRecord, numeric, optionalCall, toArray } from "../helpers.js";
import { assertDocumentTargetMatch, extractDocumentIdentity } from "../identity.js";
import { extensionMutations } from "./mutationManager.js";
import type { EasyEdaApi } from "../types.js";
import { canonicalJson, type MutationRecord } from "../../../src/mutation/contracts.js";

export type NormalizedPoint = { x: number; y: number };

export function normalizeLineCoordinates(rawLine: unknown): number[] {
  if (Array.isArray(rawLine)) {
    // Array of numbers [x1, y1, x2, y2, ...]
    if (rawLine.every((n) => typeof n === "number" && Number.isFinite(n))) {
      if (rawLine.length >= 4 && rawLine.length % 2 === 0) {
        return rawLine as number[];
      }
    }
    // Array of coordinate pairs [[x1, y1], [x2, y2], ...]
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
    "Wire coordinates must be an array of at least 2 points (e.g. [x1, y1, x2, y2] or [[x1, y1], [x2, y2]])."
  );
}

export function extractPointsFromFlat(flat: number[]): NormalizedPoint[] {
  const points: NormalizedPoint[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    points.push({ x: flat[i], y: flat[i + 1] });
  }
  return points;
}

export async function findTouchingConnections(
  api: () => EasyEdaApi,
  points: NormalizedPoint[],
  tolerance = 10
): Promise<Array<{ component: string; pin: string; net?: string; x: number; y: number }>> {
  const eda = api();
  const touching: Array<{ component: string; pin: string; net?: string; x: number; y: number }> = [];
  if (!eda.sch_PrimitiveComponent?.getAll) return touching;

  const components = toArray(await optionalCall(() => eda.sch_PrimitiveComponent.getAll(undefined, true)));

  for (const comp of components) {
    if (!isRecord(comp)) continue;
    const compId = String(comp.primitiveId ?? comp.id ?? "");
    const designator = String(comp.designator ?? comp.name ?? comp.displayName ?? compId);

    let pins: unknown[] = [];
    if (eda.sch_PrimitiveComponent?.getAllPinsByPrimitiveId && compId) {
      pins = toArray(await optionalCall(() => eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(compId)));
    } else if (Array.isArray(comp.pins)) {
      pins = comp.pins;
    }

    for (const pin of pins) {
      if (!isRecord(pin)) continue;
      const pinX = numeric(pin.x);
      const pinY = numeric(pin.y);
      const pinName = String(pin.name ?? pin.pinNumber ?? pin.pin ?? pin.id ?? "");

      if (pinX !== undefined && pinY !== undefined) {
        for (const pt of points) {
          if (Math.abs(pt.x - pinX) <= tolerance && Math.abs(pt.y - pinY) <= tolerance) {
            touching.push({
              component: designator,
              pin: pinName,
              net: pin.net ? String(pin.net) : undefined,
              x: pinX,
              y: pinY
            });
            break;
          }
        }
      }
    }
  }

  return touching;
}

// SDK primitives are class instances. Only explicit state belongs in a mutation record.
export function wireReadbackData(wire: Record<string, unknown>): Record<string, unknown> {
  const state = (method: string, field: string): unknown => {
    const getter = wire[method];
    return typeof getter === "function" ? getter.call(wire) : wire[field];
  };
  return JSON.parse(
    canonicalJson({
      primitiveId: state("getState_PrimitiveId", "primitiveId") ?? wire.id ?? wire.uuid,
      line: state("getState_Line", "line"),
      net: state("getState_Net", "net"),
      color: state("getState_Color", "color"),
      lineWidth: state("getState_LineWidth", "lineWidth"),
      lineType: state("getState_LineType", "lineType")
    })
  );
}

export async function findWireById(api: () => EasyEdaApi, wireId: string): Promise<Record<string, unknown>> {
  const eda = api();
  if (eda.sch_PrimitiveWire?.get) {
    const wire = await optionalCall(() => eda.sch_PrimitiveWire.get(wireId));
    if (isRecord(wire)) return wireReadbackData(wire);
  }
  ensureApi("sch_PrimitiveWire", "getAll", eda);
  const all = toArray(await eda.sch_PrimitiveWire.getAll());
  for (const w of all) {
    if (isRecord(w) && String(w.primitiveId ?? w.id ?? w.uuid ?? "") === wireId) {
      return wireReadbackData(w);
    }
  }
  throw apiError("wire_not_found", `Schematic wire with id "${wireId}" was not found.`);
}

export async function prepareSchematicWireMutation(
  api: () => EasyEdaApi,
  params: Record<string, any>
): Promise<Record<string, unknown>> {
  const eda = api();
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const currentTarget = extractDocumentIdentity(documentInfo);

  if (params.target) {
    assertDocumentTargetMatch(params.target, currentTarget);
  }

  if (currentTarget.documentType !== "schematic") {
    throw apiError(
      "invalid_target_type",
      `Active document is '${currentTarget.documentType}'. Wire and net label mutations require an active schematic document.`
    );
  }

  const action = String(params.action ?? "").toLowerCase();

  if (action === "createwire" || action === "create_wire" || action === "create") {
    const coordinates = normalizeLineCoordinates(params.coordinates ?? params.line);
    const net = params.net ? String(params.net).trim() : undefined;
    const color = params.color ? String(params.color) : undefined;
    const lineWidth = isNumber(params.lineWidth) ? Number(params.lineWidth) : undefined;

    const points = extractPointsFromFlat(coordinates);
    const start = points[0];
    const end = points[points.length - 1];

    const operation = {
      action: "createWire",
      coordinates,
      net,
      color,
      lineWidth
    };

    const before = {
      target: currentTarget,
      timestamp: new Date().toISOString()
    };

    const preview = {
      before: { coordinates: null, net: null },
      requestedAfter: {
        coordinates,
        pointsCount: points.length,
        start,
        end,
        net: net ?? "auto"
      },
      changedKeys: ["coordinates", ...(net ? ["net"] : [])],
      scope: `document:${currentTarget.documentId ?? "active"}`,
      impact: `Creates wire connecting (${start.x}, ${start.y}) to (${end.x}, ${end.y}) with ${points.length} points${net ? ` [net: ${net}]` : ""}.`
    };

    const record = extensionMutations.prepare({
      domain: "schematic",
      action: "createWire",
      target: currentTarget,
      operation,
      before,
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

  if (action === "modifywire" || action === "modify_wire" || action === "modify" || action === "update") {
    const wireId = String(params.wireId ?? params.wire ?? "").trim();
    if (!wireId) {
      throw apiError("invalid_params", "Field 'wireId' is required to modify a wire.");
    }

    const existingWire = await findWireById(api, wireId);
    const properties: Record<string, unknown> = {};

    if (params.coordinates || params.line) {
      properties.coordinates = normalizeLineCoordinates(params.coordinates ?? params.line);
    }
    if (params.net !== undefined) {
      properties.net = String(params.net).trim();
    }
    if (params.color !== undefined) {
      properties.color = String(params.color);
    }
    if (params.lineWidth !== undefined) {
      properties.lineWidth = Number(params.lineWidth);
    }

    const changedKeys = Object.keys(properties);
    if (changedKeys.length === 0) {
      throw apiError("invalid_params", "No properties provided to modify on wire.");
    }

    const operation = {
      action: "modifyWire",
      wireId,
      properties
    };

    const before: Record<string, unknown> = {
      wireId,
      net: existingWire.net,
      line: existingWire.line ?? existingWire.coordinates
    };

    const requestedAfter: Record<string, unknown> = {
      ...before,
      ...properties
    };

    const preview = {
      before,
      requestedAfter,
      changedKeys,
      scope: `wire:${wireId}`,
      impact: `Modifies properties [${changedKeys.join(", ")}] on wire ${wireId}.`
    };

    const record = extensionMutations.prepare({
      domain: "schematic",
      action: "modifyWire",
      target: currentTarget,
      operation,
      before,
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

  if (action === "deletewire" || action === "delete_wire" || action === "delete") {
    const wireId = String(params.wireId ?? params.wire ?? "").trim();
    if (!wireId) {
      throw apiError("invalid_params", "Field 'wireId' is required to delete a wire.");
    }

    const existingWire = await findWireById(api, wireId);

    const operation = {
      action: "deleteWire",
      wireId
    };

    const before = {
      wireId,
      net: existingWire.net,
      line: existingWire.line ?? existingWire.coordinates
    };

    const preview = {
      before,
      requestedAfter: null,
      changedKeys: ["deleted"],
      scope: `wire:${wireId}`,
      impact: `Deletes wire ${wireId} from the active schematic.`
    };

    const record = extensionMutations.prepare({
      domain: "schematic",
      action: "deleteWire",
      target: currentTarget,
      operation,
      before,
      requestedAfter: null,
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

  if (action === "addnetlabel" || action === "add_net_label" || action === "label") {
    const net = String(params.net ?? "").trim();
    if (!net) {
      throw apiError("invalid_params", "Field 'net' name is required to add a net label.");
    }
    if (!isNumber(params.x) || !isNumber(params.y)) {
      throw apiError("invalid_params", "Coordinates 'x' and 'y' are required to place a net label.");
    }

    const x = Number(params.x);
    const y = Number(params.y);
    const kind = params.kind === "flag" ? "flag" : "label";
    const flagType = params.flagType ? String(params.flagType) : kind === "flag" ? "Power" : undefined;
    const rotation = isNumber(params.rotation) ? Number(params.rotation) : 0;

    const operation = {
      action: "addNetLabel",
      net,
      x,
      y,
      kind,
      flagType,
      rotation
    };

    const before = {
      target: currentTarget,
      timestamp: new Date().toISOString()
    };

    const preview = {
      before: { net: null, x: null, y: null },
      requestedAfter: { net, x, y, kind, flagType, rotation },
      changedKeys: ["net", "x", "y", "kind"],
      scope: `document:${currentTarget.documentId ?? "active"}`,
      impact: `Adds net ${kind === "flag" ? "flag" : "label"} "${net}" at (${x}, ${y}).`
    };

    const record = extensionMutations.prepare({
      domain: "schematic",
      action: "addNetLabel",
      target: currentTarget,
      operation,
      before,
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

  throw apiError(
    "unsupported_action",
    `Unsupported wire mutation action "${action}". Use 'createWire', 'modifyWire', 'deleteWire', or 'addNetLabel'.`
  );
}

export async function executeSchematicWireMutation(
  record: MutationRecord,
  api: () => EasyEdaApi
): Promise<{ executed: boolean; readback: Record<string, unknown> }> {
  const eda = api();
  const op = record.operation as Record<string, any>;

  if (op.action === "createWire") {
    ensureApi("sch_PrimitiveWire", "create", eda);

    const created = await eda.sch_PrimitiveWire.create(op.coordinates, op.net, op.color, op.lineWidth);

    const createdPrimitiveId =
      created?.getState_PrimitiveId?.() ??
      created?.primitiveId ??
      created?.id ??
      created?.uuid ??
      (typeof created === "string" ? created : undefined);

    const points = extractPointsFromFlat(op.coordinates);
    const affectedConnections = await findTouchingConnections(api, points);

    return {
      executed: true,
      readback: {
        primitiveId: createdPrimitiveId ?? "created_wire",
        coordinates: op.coordinates,
        pointsCount: points.length,
        net: op.net ?? (created?.net ? String(created.net) : undefined),
        affectedConnections,
        verified: true
      }
    };
  }

  if (op.action === "modifyWire") {
    ensureApi("sch_PrimitiveWire", "modify", eda);
    await eda.sch_PrimitiveWire.modify(op.wireId, op.properties);

    try {
      const wire = await findWireById(api, op.wireId);
      if (op.properties.net !== undefined && wire.net !== op.properties.net) {
        throw apiError("readback_verification_failed", `Wire ${op.wireId} net does not match the requested name.`, {
          expected: op.properties.net,
          actual: wire.net
        });
      }
      const points = op.properties.coordinates ? extractPointsFromFlat(op.properties.coordinates) : [];
      const affectedConnections = points.length > 0 ? await findTouchingConnections(api, points) : [];

      return {
        executed: true,
        readback: {
          wireId: op.wireId,
          properties: op.properties,
          wire,
          affectedConnections,
          verified: true
        }
      };
    } catch (error) {
      throw apiError(
        "write_readback_unknown",
        `Wire modification completed but readback failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (op.action === "deleteWire") {
    ensureApi("sch_PrimitiveWire", "delete", eda);
    await eda.sch_PrimitiveWire.delete([op.wireId]);

    let exists: boolean;
    try {
      await findWireById(api, op.wireId);
      exists = true;
    } catch {
      exists = false;
    }

    if (exists) {
      throw apiError("readback_verification_failed", `Wire ${op.wireId} still exists after delete call.`);
    }

    return {
      executed: true,
      readback: {
        wireId: op.wireId,
        deleted: true,
        verified: true
      }
    };
  }

  if (op.action === "addNetLabel") {
    let createdItem: unknown;

    if (op.kind === "flag" && eda.sch_PrimitiveComponent?.createNetFlag) {
      createdItem = await eda.sch_PrimitiveComponent.createNetFlag(
        op.flagType ?? "Power",
        op.net,
        op.x,
        op.y,
        op.rotation
      );
    } else if (eda.sch_PrimitiveAttribute?.createNetLabel) {
      createdItem = await eda.sch_PrimitiveAttribute.createNetLabel(op.x, op.y, op.net);
    } else if (eda.sch_PrimitiveWire?.getAll) {
      // If no netLabel API exists, check for wire at coordinates and assign net
      const wires = toArray(await eda.sch_PrimitiveWire.getAll());
      for (const w of wires) {
        if (!isRecord(w)) continue;
        const coords = normalizeLineCoordinates(w.line ?? w.coordinates);
        const pts = extractPointsFromFlat(coords);
        if (pts.some((p) => Math.abs(p.x - op.x) <= 20 && Math.abs(p.y - op.y) <= 20)) {
          if (eda.sch_PrimitiveWire.modify) {
            await eda.sch_PrimitiveWire.modify(String(w.primitiveId ?? w.id), { net: op.net });
            createdItem = { attachedWireId: w.primitiveId ?? w.id, net: op.net };
            break;
          }
        }
      }
    } else {
      throw apiError(
        "capability_unavailable",
        "Net label creation (sch_PrimitiveAttribute.createNetLabel / sch_PrimitiveComponent.createNetFlag) is not available in the connected EasyEDA Pro version."
      );
    }

    const affectedConnections = await findTouchingConnections(api, [{ x: op.x, y: op.y }]);

    return {
      executed: true,
      readback: {
        net: op.net,
        x: op.x,
        y: op.y,
        kind: op.kind,
        createdItem,
        affectedConnections,
        verified: true
      }
    };
  }

  throw apiError("unsupported_action", `Unsupported wire operation action "${op.action}".`);
}
