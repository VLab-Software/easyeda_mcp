import { apiError, ensureApi, isNumber, isRecord, numeric, optionalCall, toArray } from "../helpers.js";
import { assertDocumentTargetMatch, extractDocumentIdentity } from "../identity.js";
import { extensionMutations } from "./mutationManager.js";
import type { EasyEdaApi } from "../types.js";

export type ResolvedPcbComponent = {
  primitiveId: string;
  designator: string;
  footprint?: string;
  value?: string;
  x: number;
  y: number;
  rotation: number;
  layer: number | string;
  side: "top" | "bottom" | "unknown";
  locked: boolean;
  raw: Record<string, unknown>;
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

export async function findComponentInPcb(api: () => EasyEdaApi, identifier: string): Promise<ResolvedPcbComponent> {
  const eda = api();
  ensureApi("pcb_PrimitiveComponent", "getAll", eda);
  const rawComponents = toArray(await eda.pcb_PrimitiveComponent.getAll());

  const trimmed = identifier.trim();
  const upper = trimmed.toUpperCase();

  for (const raw of rawComponents) {
    if (!isRecord(raw)) continue;
    const primitiveId = String(getProp(raw, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ?? "").trim();
    const designator = String(
      getProp(raw, "getState_Designator", ["designator", "name", "displayName", "prefix"]) ?? ""
    ).trim();

    if (primitiveId === trimmed || designator.toUpperCase() === upper) {
      const x = numeric(getProp(raw, "getState_X", ["x", "centerX"])) ?? 0;
      const y = numeric(getProp(raw, "getState_Y", ["y", "centerY"])) ?? 0;
      const rotation = numeric(getProp(raw, "getState_Rotation", ["rotation", "angle"])) ?? 0;
      const layer = getProp(raw, "getState_Layer", ["layer", "layerId"]) ?? 1;
      const layerStr = String(layer).toLowerCase();
      const side =
        layerStr.includes("top") || layer === 1
          ? "top"
          : layerStr.includes("bot") || layer === 2
            ? "bottom"
            : "unknown";
      const footprint = getProp(raw, "getState_Footprint", ["footprint", "package", "packageName"]);
      const value = getProp(raw, "getState_Value", ["value", "comment", "title"]);
      const locked = Boolean(getProp(raw, "getState_PrimitiveLock", ["locked", "primitiveLock"]));

      return {
        primitiveId,
        designator,
        footprint: footprint ? String(footprint) : undefined,
        value: value ? String(value) : undefined,
        x,
        y,
        rotation,
        layer,
        side,
        locked,
        raw
      };
    }
  }

  throw apiError("component_not_found", `PCB component "${identifier}" was not found on the active board.`);
}

export async function preparePcbComponentMutation(
  api: () => EasyEdaApi,
  params: Record<string, any>
): Promise<Record<string, unknown>> {
  const eda = api();
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const currentTarget = extractDocumentIdentity(documentInfo);

  if (params.target) {
    assertDocumentTargetMatch(params.target, currentTarget);
  }

  if (currentTarget.documentType && currentTarget.documentType !== "pcb") {
    throw apiError(
      "invalid_target_type",
      `Active document is '${currentTarget.documentType}'. PCB component mutations require an active PCB document.`
    );
  }

  const action = String(params.action ?? "").toLowerCase();
  const componentIdentifier = String(params.component ?? "").trim();
  if (!componentIdentifier) {
    throw apiError("missing_parameters", "PCB component mutation requires 'component' parameter (designator or ID).");
  }

  const comp = await findComponentInPcb(api, componentIdentifier);

  if (action === "move") {
    let toX = comp.x;
    let toY = comp.y;

    if (isNumber(params.x)) {
      toX = Number(params.x);
    } else if (isNumber(params.dx)) {
      toX = comp.x + Number(params.dx);
    }

    if (isNumber(params.y)) {
      toY = Number(params.y);
    } else if (isNumber(params.dy)) {
      toY = comp.y + Number(params.dy);
    }

    if (toX === comp.x && toY === comp.y) {
      throw apiError("no_effective_change", `Move operation for component ${comp.designator} results in no change.`);
    }

    const impact = `Moves PCB component ${comp.designator} (${comp.primitiveId}) from (${comp.x}, ${comp.y}) to (${toX}, ${toY}).`;
    const preview = {
      impact,
      scope: `document:${currentTarget.documentId ?? "active_pcb"}`,
      requestedBefore: { x: comp.x, y: comp.y },
      requestedAfter: { x: toX, y: toY },
      changedKeys: ["x", "y"]
    };

    const record = extensionMutations.prepare({
      domain: "pcb",
      action: "move",
      target: currentTarget,
      operation: {
        action: "move",
        primitiveId: comp.primitiveId,
        designator: comp.designator,
        fromX: comp.x,
        fromY: comp.y,
        toX,
        toY
      },
      before: preview.requestedBefore,
      requestedAfter: preview.requestedAfter,
      changedKeys: preview.changedKeys,
      scope: preview.scope,
      impact: preview.impact,
      ttlMs: 5 * 60_000
    });

    return {
      mutationId: record.mutationId,
      confirmation: record.confirmation,
      action: "move",
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  if (action === "rotate") {
    let toRotation: number;

    if (isNumber(params.rotation)) {
      toRotation = ((Number(params.rotation) % 360) + 360) % 360;
    } else if (isNumber(params.dRotation)) {
      toRotation = (((comp.rotation + Number(params.dRotation)) % 360) + 360) % 360;
    } else {
      throw apiError("missing_parameters", "Rotation mutation requires either 'rotation' or 'dRotation'.");
    }

    if (toRotation === comp.rotation) {
      throw apiError(
        "no_effective_change",
        `Rotate operation for component ${comp.designator} results in no rotation change (${comp.rotation}°).`
      );
    }

    const impact = `Rotates PCB component ${comp.designator} (${comp.primitiveId}) from ${comp.rotation}° to ${toRotation}°.`;
    const preview = {
      impact,
      scope: `document:${currentTarget.documentId ?? "active_pcb"}`,
      requestedBefore: { rotation: comp.rotation },
      requestedAfter: { rotation: toRotation },
      changedKeys: ["rotation"]
    };

    const record = extensionMutations.prepare({
      domain: "pcb",
      action: "rotate",
      target: currentTarget,
      operation: {
        action: "rotate",
        primitiveId: comp.primitiveId,
        designator: comp.designator,
        fromRotation: comp.rotation,
        toRotation
      },
      before: preview.requestedBefore,
      requestedAfter: preview.requestedAfter,
      changedKeys: preview.changedKeys,
      scope: preview.scope,
      impact: preview.impact,
      ttlMs: 5 * 60_000
    });

    return {
      mutationId: record.mutationId,
      confirmation: record.confirmation,
      action: "rotate",
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  if (action === "flip") {
    let toSide: "top" | "bottom";
    let toLayer: number | string;

    if (params.layer) {
      toSide = String(params.layer).toLowerCase() === "bottom" ? "bottom" : "top";
    } else {
      toSide = comp.side === "top" ? "bottom" : "top";
    }

    toLayer = toSide === "top" ? 1 : 2;

    if (toSide === comp.side) {
      throw apiError(
        "no_effective_change",
        `Flip operation for component ${comp.designator} specifies current side '${comp.side}'.`
      );
    }

    const impact = `Flips PCB component ${comp.designator} (${comp.primitiveId}) from ${comp.side} to ${toSide} layer.`;
    const preview = {
      impact,
      scope: `document:${currentTarget.documentId ?? "active_pcb"}`,
      requestedBefore: { layer: comp.layer, side: comp.side },
      requestedAfter: { layer: toLayer, side: toSide },
      changedKeys: ["layer", "side"]
    };

    const record = extensionMutations.prepare({
      domain: "pcb",
      action: "flip",
      target: currentTarget,
      operation: {
        action: "flip",
        primitiveId: comp.primitiveId,
        designator: comp.designator,
        fromLayer: comp.layer,
        fromSide: comp.side,
        toLayer,
        toSide
      },
      before: preview.requestedBefore,
      requestedAfter: preview.requestedAfter,
      changedKeys: preview.changedKeys,
      scope: preview.scope,
      impact: preview.impact,
      ttlMs: 5 * 60_000
    });

    return {
      mutationId: record.mutationId,
      confirmation: record.confirmation,
      action: "flip",
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  if (action === "delete") {
    const impact = `Deletes PCB component ${comp.designator} (${comp.primitiveId}) at (${comp.x}, ${comp.y}) from active PCB.`;
    const preview = {
      impact,
      scope: `document:${currentTarget.documentId ?? "active_pcb"}`,
      requestedBefore: { exists: true, primitiveId: comp.primitiveId, designator: comp.designator },
      requestedAfter: { exists: false },
      changedKeys: ["deleted"]
    };

    const record = extensionMutations.prepare({
      domain: "pcb",
      action: "delete",
      target: currentTarget,
      operation: {
        action: "delete",
        primitiveId: comp.primitiveId,
        designator: comp.designator
      },
      before: preview.requestedBefore,
      requestedAfter: preview.requestedAfter,
      changedKeys: preview.changedKeys,
      scope: preview.scope,
      impact: preview.impact,
      ttlMs: 5 * 60_000
    });

    return {
      mutationId: record.mutationId,
      confirmation: record.confirmation,
      action: "delete",
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  throw apiError(
    "unsupported_action",
    `Unsupported PCB component action '${action}'. Expected move, rotate, flip, or delete.`
  );
}

export async function executePcbComponentMutation(
  api: () => EasyEdaApi,
  op: Record<string, any>,
  _expectedBefore?: unknown
): Promise<{ executed: true; readback: Record<string, unknown> }> {
  const eda = api();

  if (op.action === "move") {
    if (eda.pcb_PrimitiveComponent?.modify) {
      await eda.pcb_PrimitiveComponent.modify(op.primitiveId, { x: op.toX, y: op.toY });
    } else if (eda.pcb_PrimitiveComponent?.get) {
      const comp = await eda.pcb_PrimitiveComponent.get(op.primitiveId);
      if (!comp) {
        throw apiError("component_not_found", `PCB component ${op.primitiveId} not found for move.`);
      }
      const asyncComp = comp.toAsync ? comp.toAsync() : comp;
      if (asyncComp.setState_X) await asyncComp.setState_X(op.toX);
      if (asyncComp.setState_Y) await asyncComp.setState_Y(op.toY);
      if (asyncComp.done) await asyncComp.done();
    } else {
      ensureApi("pcb_PrimitiveComponent", "modify", eda);
    }

    const updated = await findComponentInPcb(api, op.primitiveId);
    const verified = Math.abs(updated.x - op.toX) <= 1 && Math.abs(updated.y - op.toY) <= 1;

    if (!verified) {
      throw apiError(
        "readback_verification_failed",
        `Move readback failed for ${op.designator}. Expected (${op.toX}, ${op.toY}), got (${updated.x}, ${updated.y}).`
      );
    }

    return {
      executed: true,
      readback: {
        primitiveId: updated.primitiveId,
        designator: updated.designator,
        x: updated.x,
        y: updated.y,
        verified: true
      }
    };
  }

  if (op.action === "rotate") {
    if (eda.pcb_PrimitiveComponent?.modify) {
      await eda.pcb_PrimitiveComponent.modify(op.primitiveId, { rotation: op.toRotation });
    } else if (eda.pcb_PrimitiveComponent?.get) {
      const comp = await eda.pcb_PrimitiveComponent.get(op.primitiveId);
      if (!comp) {
        throw apiError("component_not_found", `PCB component ${op.primitiveId} not found for rotate.`);
      }
      const asyncComp = comp.toAsync ? comp.toAsync() : comp;
      if (asyncComp.setState_Rotation) await asyncComp.setState_Rotation(op.toRotation);
      if (asyncComp.done) await asyncComp.done();
    } else {
      ensureApi("pcb_PrimitiveComponent", "modify", eda);
    }

    const updated = await findComponentInPcb(api, op.primitiveId);
    const verified = Math.abs(updated.rotation - op.toRotation) <= 1;

    if (!verified) {
      throw apiError(
        "readback_verification_failed",
        `Rotate readback failed for ${op.designator}. Expected ${op.toRotation}°, got ${updated.rotation}°.`
      );
    }

    return {
      executed: true,
      readback: {
        primitiveId: updated.primitiveId,
        designator: updated.designator,
        rotation: updated.rotation,
        verified: true
      }
    };
  }

  if (op.action === "flip") {
    if (eda.pcb_PrimitiveComponent?.flip) {
      await eda.pcb_PrimitiveComponent.flip([op.primitiveId]);
    } else if (eda.pcb_PrimitiveComponent?.modify) {
      await eda.pcb_PrimitiveComponent.modify(op.primitiveId, { layer: op.toLayer });
    } else if (eda.pcb_PrimitiveComponent?.get) {
      const comp = await eda.pcb_PrimitiveComponent.get(op.primitiveId);
      if (!comp) {
        throw apiError("component_not_found", `PCB component ${op.primitiveId} not found for flip.`);
      }
      const asyncComp = comp.toAsync ? comp.toAsync() : comp;
      if (asyncComp.setState_Layer) await asyncComp.setState_Layer(op.toLayer);
      if (asyncComp.done) await asyncComp.done();
    } else {
      ensureApi("pcb_PrimitiveComponent", "flip", eda);
    }

    const updated = await findComponentInPcb(api, op.primitiveId);
    const verified = updated.side === op.toSide || String(updated.layer) === String(op.toLayer);

    if (!verified) {
      throw apiError(
        "readback_verification_failed",
        `Flip readback failed for ${op.designator}. Expected ${op.toSide} (${op.toLayer}), got ${updated.side} (${updated.layer}).`
      );
    }

    return {
      executed: true,
      readback: {
        primitiveId: updated.primitiveId,
        designator: updated.designator,
        side: updated.side,
        layer: updated.layer,
        verified: true
      }
    };
  }

  if (op.action === "delete") {
    ensureApi("pcb_PrimitiveComponent", "delete", eda);
    await eda.pcb_PrimitiveComponent.delete([op.primitiveId]);

    let exists: boolean;
    try {
      await findComponentInPcb(api, op.primitiveId);
      exists = true;
    } catch {
      exists = false;
    }

    if (exists) {
      throw apiError("readback_verification_failed", `PCB component ${op.primitiveId} still exists after deletion.`);
    }

    return {
      executed: true,
      readback: {
        primitiveId: op.primitiveId,
        deleted: true,
        verified: true
      }
    };
  }

  throw apiError("unsupported_action", `Unsupported execution action '${op.action}'.`);
}
