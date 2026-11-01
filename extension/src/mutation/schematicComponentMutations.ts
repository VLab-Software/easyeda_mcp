import { apiError, ensureApi, isNumber, isRecord, numeric, optionalCall, toArray } from "../helpers.js";
import { assertDocumentTargetMatch, extractDocumentIdentity } from "../identity.js";
import { extensionMutations } from "./mutationManager.js";
import type { EasyEdaApi } from "../types.js";
import type { MutationRecord } from "../../../src/mutation/contracts.js";

export type ResolvedComponent = {
  primitiveId: string;
  designator: string;
  value?: string;
  footprint?: string;
  x: number;
  y: number;
  rotation?: number;
  mirror?: boolean;
  raw: Record<string, unknown>;
};

export async function findComponentInSchematic(api: () => EasyEdaApi, identifier: string): Promise<ResolvedComponent> {
  const eda = api();
  ensureApi("sch_PrimitiveComponent", "getAll", eda);
  const rawComponents = toArray(await eda.sch_PrimitiveComponent.getAll(undefined, true));

  const trimmed = identifier.trim();
  const upper = trimmed.toUpperCase();

  for (const raw of rawComponents) {
    if (!isRecord(raw)) continue;
    const primitiveId = String(raw.primitiveId ?? raw.id ?? raw.uuid ?? "").trim();
    const designator = String(raw.designator ?? raw.name ?? raw.displayName ?? raw.prefix ?? "").trim();

    if (primitiveId === trimmed || designator.toUpperCase() === upper) {
      const x = numeric(raw.x) ?? 0;
      const y = numeric(raw.y) ?? 0;
      const value = (raw.value ?? raw.comment ?? raw.title) ? String(raw.value ?? raw.comment ?? raw.title) : undefined;
      const footprint = (raw.footprint ?? raw.package) ? String(raw.footprint ?? raw.package) : undefined;
      const rotation = numeric(raw.rotation);
      const mirror = typeof raw.mirror === "boolean" ? raw.mirror : undefined;

      return {
        primitiveId,
        designator,
        value,
        footprint,
        x,
        y,
        rotation,
        mirror,
        raw
      };
    }
  }

  throw apiError("component_not_found", `Schematic component "${identifier}" was not found in the active schematic.`);
}

export async function prepareSchematicComponentMutation(
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
      `Active document is '${currentTarget.documentType}'. Schematic component mutations require an active schematic document.`
    );
  }

  const action = String(params.action ?? "").toLowerCase();

  if (action === "create") {
    if (!params.device) {
      throw apiError(
        "invalid_params",
        "Field 'device' (search query or device object) is required to create a component."
      );
    }
    if (!isNumber(params.x) || !isNumber(params.y)) {
      throw apiError("invalid_params", "Numeric coordinates 'x' and 'y' are required to place a component.");
    }

    const x = Number(params.x);
    const y = Number(params.y);
    const designator = params.designator ? String(params.designator).trim() : undefined;
    const rotation = isNumber(params.rotation) ? Number(params.rotation) : 0;
    const mirror = Boolean(params.mirror);

    const operation = {
      action: "createComponent",
      device: params.device,
      x,
      y,
      designator,
      subPartName: params.subPartName ? String(params.subPartName) : undefined,
      rotation,
      mirror,
      addIntoBom: params.addIntoBom !== false,
      addIntoPcb: params.addIntoPcb !== false
    };

    const before = {
      target: currentTarget,
      timestamp: new Date().toISOString()
    };

    const preview = {
      before: { device: null, x: null, y: null },
      requestedAfter: {
        device: typeof params.device === "string" ? params.device : (params.device.name ?? "device_object"),
        x,
        y,
        designator,
        rotation,
        mirror
      },
      changedKeys: ["device", "x", "y", ...(designator ? ["designator"] : [])],
      scope: `document:${currentTarget.documentId ?? "active"}`,
      impact: `Creates new component at (${x}, ${y}) with device "${typeof params.device === "string" ? params.device : "custom"}"${designator ? ` designator ${designator}` : ""}.`
    };

    const record = extensionMutations.prepare({
      domain: "schematic",
      action: "createComponent",
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

  if (action === "move") {
    const componentId = String(params.component ?? "").trim();
    if (!componentId) {
      throw apiError(
        "invalid_params",
        "Field 'component' (designator or primitiveId) is required to move a component."
      );
    }

    const comp = await findComponentInSchematic(api, componentId);
    let targetX: number;
    let targetY: number;

    if (isNumber(params.x) && isNumber(params.y)) {
      targetX = Number(params.x);
      targetY = Number(params.y);
    } else if (isNumber(params.dx) && isNumber(params.dy)) {
      targetX = comp.x + Number(params.dx);
      targetY = comp.y + Number(params.dy);
    } else {
      throw apiError(
        "invalid_params",
        "Provide either absolute coordinates ('x', 'y') or relative deltas ('dx', 'dy')."
      );
    }

    const operation = {
      action: "moveComponent",
      primitiveId: comp.primitiveId,
      designator: comp.designator,
      fromX: comp.x,
      fromY: comp.y,
      toX: targetX,
      toY: targetY
    };

    const before = {
      primitiveId: comp.primitiveId,
      designator: comp.designator,
      x: comp.x,
      y: comp.y
    };

    const preview = {
      before: { x: comp.x, y: comp.y },
      requestedAfter: { x: targetX, y: targetY },
      changedKeys: ["x", "y"],
      scope: `component:${comp.designator || comp.primitiveId}`,
      impact: `Moves component ${comp.designator || comp.primitiveId} from (${comp.x}, ${comp.y}) to (${targetX}, ${targetY}).`
    };

    const record = extensionMutations.prepare({
      domain: "schematic",
      action: "moveComponent",
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

  if (action === "update") {
    const componentId = String(params.component ?? "").trim();
    if (!componentId) {
      throw apiError(
        "invalid_params",
        "Field 'component' (designator or primitiveId) is required to update a component."
      );
    }

    const comp = await findComponentInSchematic(api, componentId);
    const properties = isRecord(params.properties) ? { ...params.properties } : {};

    if (params.designator !== undefined) properties.designator = String(params.designator).trim();
    if (params.value !== undefined) properties.value = String(params.value).trim();
    if (params.footprint !== undefined) properties.footprint = String(params.footprint).trim();
    if (isNumber(params.rotation)) properties.rotation = Number(params.rotation);
    if (typeof params.mirror === "boolean") properties.mirror = params.mirror;

    const changedKeys = Object.keys(properties);
    if (changedKeys.length === 0) {
      throw apiError("invalid_params", "No properties provided to update.");
    }

    const operation = {
      action: "updateComponent",
      primitiveId: comp.primitiveId,
      designator: comp.designator,
      properties
    };

    const before: Record<string, unknown> = {
      primitiveId: comp.primitiveId,
      designator: comp.designator,
      value: comp.value,
      footprint: comp.footprint,
      rotation: comp.rotation,
      mirror: comp.mirror
    };

    const requestedAfter: Record<string, unknown> = {
      ...before,
      ...properties
    };

    const preview = {
      before,
      requestedAfter,
      changedKeys,
      scope: `component:${comp.designator || comp.primitiveId}`,
      impact: `Updates properties [${changedKeys.join(", ")}] on component ${comp.designator || comp.primitiveId}.`
    };

    const record = extensionMutations.prepare({
      domain: "schematic",
      action: "updateComponent",
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

  if (action === "delete") {
    const componentId = String(params.component ?? "").trim();
    if (!componentId) {
      throw apiError(
        "invalid_params",
        "Field 'component' (designator or primitiveId) is required to delete a component."
      );
    }

    const comp = await findComponentInSchematic(api, componentId);

    const operation = {
      action: "deleteComponent",
      primitiveId: comp.primitiveId,
      designator: comp.designator
    };

    const before = {
      primitiveId: comp.primitiveId,
      designator: comp.designator,
      x: comp.x,
      y: comp.y,
      value: comp.value,
      footprint: comp.footprint
    };

    const preview = {
      before,
      requestedAfter: null,
      changedKeys: ["deleted"],
      scope: `component:${comp.designator || comp.primitiveId}`,
      impact: `Deletes component ${comp.designator || comp.primitiveId} (${comp.primitiveId}) from the schematic.`
    };

    const record = extensionMutations.prepare({
      domain: "schematic",
      action: "deleteComponent",
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

  throw apiError(
    "unsupported_action",
    `Unsupported schematic component mutation action "${action}". Use 'create', 'move', 'update', or 'delete'.`
  );
}

export async function executeSchematicComponentMutation(
  record: MutationRecord,
  api: () => EasyEdaApi
): Promise<{ executed: boolean; readback: Record<string, unknown> }> {
  const eda = api();
  const op = record.operation as Record<string, any>;

  if (op.action === "createComponent") {
    ensureApi("sch_PrimitiveComponent", "create", eda);

    let deviceObj: unknown = op.device;
    if (typeof op.device === "string") {
      const searchFn = eda.lib_Device?.search ?? eda.lib_Search?.search;
      if (!searchFn) {
        throw apiError("capability_unavailable", "Device search (lib_Device.search) is unavailable to resolve device.");
      }
      const searchResult = toArray(await searchFn(op.device));
      if (searchResult.length === 0) {
        throw apiError("device_not_found", `Device matching query "${op.device}" was not found in library.`);
      }
      deviceObj = searchResult[0];
    }

    const comp = await eda.sch_PrimitiveComponent.create(
      deviceObj,
      op.x,
      op.y,
      op.subPartName,
      op.rotation,
      op.mirror,
      op.addIntoBom,
      op.addIntoPcb
    );

    const createdPrimitiveId =
      comp?.getState_PrimitiveId?.() ??
      comp?.primitiveId ??
      comp?.id ??
      comp?.uuid ??
      (typeof comp === "string" ? comp : undefined);

    if (!createdPrimitiveId) {
      throw apiError("creation_failed", "Component create call completed without returning a valid primitive ID.");
    }

    if (op.designator && eda.sch_PrimitiveComponent.modify) {
      await eda.sch_PrimitiveComponent.modify(createdPrimitiveId, { designator: op.designator });
    }

    // Readback verification
    let readbackComp: ResolvedComponent | undefined;
    try {
      readbackComp = await findComponentInSchematic(api, createdPrimitiveId);
    } catch {
      // If findComponentInSchematic doesn't find it yet, check eda.sch_PrimitiveComponent.get
      if (eda.sch_PrimitiveComponent.get) {
        const raw = await eda.sch_PrimitiveComponent.get(createdPrimitiveId);
        if (raw) {
          readbackComp = {
            primitiveId: createdPrimitiveId,
            designator: String(raw.designator ?? raw.name ?? op.designator ?? ""),
            x: numeric(raw.x) ?? op.x,
            y: numeric(raw.y) ?? op.y,
            raw
          };
        }
      }
    }

    if (!readbackComp) {
      throw apiError(
        "readback_verification_failed",
        `Component ${createdPrimitiveId} could not be verified on readback.`
      );
    }

    return {
      executed: true,
      readback: {
        primitiveId: readbackComp.primitiveId,
        designator: readbackComp.designator,
        x: readbackComp.x,
        y: readbackComp.y,
        verified: true
      }
    };
  }

  if (op.action === "moveComponent") {
    ensureApi("sch_PrimitiveComponent", "modify", eda);
    await eda.sch_PrimitiveComponent.modify(op.primitiveId, { x: op.toX, y: op.toY });

    // Readback verification
    const readback = await findComponentInSchematic(api, op.primitiveId);
    const verified = readback.x === op.toX && readback.y === op.toY;
    if (!verified) {
      throw apiError(
        "readback_verification_failed",
        `Move readback position mismatch: expected (${op.toX}, ${op.toY}), got (${readback.x}, ${readback.y}).`
      );
    }

    return {
      executed: true,
      readback: {
        primitiveId: readback.primitiveId,
        designator: readback.designator,
        x: readback.x,
        y: readback.y,
        verified: true
      }
    };
  }

  if (op.action === "updateComponent") {
    ensureApi("sch_PrimitiveComponent", "modify", eda);
    await eda.sch_PrimitiveComponent.modify(op.primitiveId, op.properties);

    // Readback verification
    const readback = await findComponentInSchematic(api, op.primitiveId);
    if (op.properties.designator && readback.designator !== op.properties.designator) {
      throw apiError(
        "readback_verification_failed",
        `Designator update mismatch: expected '${op.properties.designator}', got '${readback.designator}'.`
      );
    }

    return {
      executed: true,
      readback: {
        primitiveId: readback.primitiveId,
        designator: readback.designator,
        properties: op.properties,
        verified: true
      }
    };
  }

  if (op.action === "deleteComponent") {
    ensureApi("sch_PrimitiveComponent", "delete", eda);
    await eda.sch_PrimitiveComponent.delete([op.primitiveId]);

    // Readback verification: ensure primitive no longer exists
    let exists: boolean;
    try {
      await findComponentInSchematic(api, op.primitiveId);
      exists = true;
    } catch {
      exists = false;
    }

    if (exists) {
      throw apiError("readback_verification_failed", `Component ${op.primitiveId} still exists after delete call.`);
    }

    return {
      executed: true,
      readback: {
        primitiveId: op.primitiveId,
        designator: op.designator,
        deleted: true,
        verified: true
      }
    };
  }

  throw apiError("unsupported_action", `Unsupported schematic operation action "${op.action}".`);
}
