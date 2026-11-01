import { apiError, isNumber, isRecord, numeric, optionalCall, sanitize, toArray } from "../helpers.js";
import { assertDocumentTargetMatch, extractDocumentIdentity } from "../identity.js";
import { extensionMutations } from "./mutationManager.js";
import type { EasyEdaApi } from "../types.js";

export type BoardOutlineSegment = {
  primitiveId: string;
  type: "line" | "arc" | "polyline" | "region";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  lineWidth?: number;
  layer: number | string;
  locked?: boolean;
  raw?: Record<string, unknown>;
};

export type BoardOutlineBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export type BoardOutlineSummary = {
  target: Record<string, unknown>;
  layer: { id: number | string; name: string };
  exists: boolean;
  segmentCount: number;
  bounds: BoardOutlineBounds;
  isClosed: boolean;
  estimatedArea: number;
  perimeter: number;
  segments: BoardOutlineSegment[];
  rawPrimitives?: Record<string, unknown>[];
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

export async function resolveBoardOutlineLayer(eda: EasyEdaApi): Promise<{ id: number | string; name: string }> {
  if (eda.pcb_Layer?.getAllLayers) {
    try {
      const layers = toArray(await eda.pcb_Layer.getAllLayers());
      for (const rawLayer of layers) {
        if (!isRecord(rawLayer)) continue;
        const l = rawLayer as Record<string, any>;
        const name = String(l.name ?? l.layerName ?? "");
        const type = String(l.type ?? l.layerType ?? "").toLowerCase();
        const id = l.id ?? l.layerId ?? l.layerNo;
        if (
          name.toLowerCase().includes("outline") ||
          name.toLowerCase().includes("boardoutline") ||
          type.includes("outline") ||
          type.includes("boardoutline") ||
          id === 10 ||
          id === "BoardOutline"
        ) {
          return { id, name: name || "BoardOutline" };
        }
      }
    } catch {
      // fallback
    }
  }
  return { id: 10, name: "BoardOutline" };
}

function checkSegmentsClosed(segments: BoardOutlineSegment[]): boolean {
  if (segments.length < 3) return false;

  const tolerance = 0.5; // 0.5 mm tolerance
  const pointsMatch = (x1: number, y1: number, x2: number, y2: number) =>
    Math.abs(x1 - x2) <= tolerance && Math.abs(y1 - y2) <= tolerance;

  // Verify that every segment endpoint connects to at least one other segment's endpoint
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    let startConnected = false;
    let endConnected = false;

    for (let j = 0; j < segments.length; j++) {
      if (i === j) continue;
      const other = segments[j];
      if (
        pointsMatch(seg.startX, seg.startY, other.startX, other.startY) ||
        pointsMatch(seg.startX, seg.startY, other.endX, other.endY)
      ) {
        startConnected = true;
      }
      if (
        pointsMatch(seg.endX, seg.endY, other.startX, other.startY) ||
        pointsMatch(seg.endX, seg.endY, other.endX, other.endY)
      ) {
        endConnected = true;
      }
    }

    if (!startConnected || !endConnected) {
      return false;
    }
  }

  return true;
}

export async function getBoardOutlineSummary(
  api: () => EasyEdaApi,
  options: {
    expectedTarget?: Record<string, unknown>;
    includeSegments?: boolean;
    includeRaw?: boolean;
  } = {}
): Promise<BoardOutlineSummary> {
  const eda = api();
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const currentTarget = extractDocumentIdentity(documentInfo);

  if (options.expectedTarget) {
    assertDocumentTargetMatch(options.expectedTarget, currentTarget);
  }

  if (currentTarget.documentType && currentTarget.documentType !== "pcb") {
    throw apiError(
      "invalid_target_type",
      `Active document is '${currentTarget.documentType}'. Board outline inspection requires an active PCB document.`
    );
  }

  const outlineLayer = await resolveBoardOutlineLayer(eda);
  const segments: BoardOutlineSegment[] = [];
  const rawPrimitives: Record<string, unknown>[] = [];

  const isOutlineLayerMatch = (raw: any): boolean => {
    const layer = getProp(raw, "getState_Layer", ["layer", "layerId", "layerNo"]);
    if (layer === outlineLayer.id) return true;
    const layerStr = String(layer ?? "").toLowerCase();
    return layerStr.includes("outline") || layerStr === "10" || layer === 10;
  };

  // 1. Line primitives
  if (eda.pcb_PrimitiveLine?.getAll) {
    try {
      const lines = toArray(await eda.pcb_PrimitiveLine.getAll());
      for (const line of lines) {
        if (!isRecord(line)) continue;
        if (!isOutlineLayerMatch(line)) continue;

        const primitiveId = String(getProp(line, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ?? "");
        const startX = numeric(getProp(line, "getState_StartX", ["startX", "x1"])) ?? 0;
        const startY = numeric(getProp(line, "getState_StartY", ["startY", "y1"])) ?? 0;
        const endX = numeric(getProp(line, "getState_EndX", ["endX", "x2"])) ?? 0;
        const endY = numeric(getProp(line, "getState_EndY", ["endY", "y2"])) ?? 0;
        const lineWidth = numeric(getProp(line, "getState_LineWidth", ["lineWidth", "width"]));
        const layer = getProp(line, "getState_Layer", ["layer", "layerId"]) ?? outlineLayer.id;
        const locked = Boolean(getProp(line, "getState_PrimitiveLock", ["locked", "primitiveLock"]));

        segments.push({
          primitiveId,
          type: "line",
          startX,
          startY,
          endX,
          endY,
          lineWidth,
          layer,
          locked,
          ...(options.includeRaw ? { raw: sanitize(line) as Record<string, unknown> } : {})
        });

        if (options.includeRaw) {
          rawPrimitives.push(sanitize(line) as Record<string, unknown>);
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Arc primitives
  if (eda.pcb_PrimitiveArc?.getAll) {
    try {
      const arcs = toArray(await eda.pcb_PrimitiveArc.getAll());
      for (const arc of arcs) {
        if (!isRecord(arc)) continue;
        if (!isOutlineLayerMatch(arc)) continue;

        const primitiveId = String(getProp(arc, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ?? "");
        const startX = numeric(getProp(arc, "getState_StartX", ["startX", "x1"])) ?? 0;
        const startY = numeric(getProp(arc, "getState_StartY", ["startY", "y1"])) ?? 0;
        const endX = numeric(getProp(arc, "getState_EndX", ["endX", "x2"])) ?? 0;
        const endY = numeric(getProp(arc, "getState_EndY", ["endY", "y2"])) ?? 0;
        const lineWidth = numeric(getProp(arc, "getState_LineWidth", ["lineWidth", "width"]));
        const layer = getProp(arc, "getState_Layer", ["layer", "layerId"]) ?? outlineLayer.id;
        const locked = Boolean(getProp(arc, "getState_PrimitiveLock", ["locked", "primitiveLock"]));

        segments.push({
          primitiveId,
          type: "arc",
          startX,
          startY,
          endX,
          endY,
          lineWidth,
          layer,
          locked,
          ...(options.includeRaw ? { raw: sanitize(arc) as Record<string, unknown> } : {})
        });

        if (options.includeRaw) {
          rawPrimitives.push(sanitize(arc) as Record<string, unknown>);
        }
      }
    } catch {
      // ignore
    }
  }

  // Calculate geometry & bounds
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  let perimeter = 0;

  if (segments.length > 0) {
    minX = Math.min(...segments.map((s) => Math.min(s.startX, s.endX)));
    maxX = Math.max(...segments.map((s) => Math.max(s.startX, s.endX)));
    minY = Math.min(...segments.map((s) => Math.min(s.startY, s.endY)));
    maxY = Math.max(...segments.map((s) => Math.max(s.startY, s.endY)));

    for (const s of segments) {
      const dx = s.endX - s.startX;
      const dy = s.endY - s.startY;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
  }

  const width = segments.length > 0 ? Number((maxX - minX).toFixed(4)) : 0;
  const height = segments.length > 0 ? Number((maxY - minY).toFixed(4)) : 0;
  const estimatedArea = Number((width * height).toFixed(4));
  const isClosed = checkSegmentsClosed(segments);

  return {
    target: currentTarget as Record<string, unknown>,
    layer: outlineLayer,
    exists: segments.length > 0,
    segmentCount: segments.length,
    bounds: {
      minX: Number(minX.toFixed(4)),
      minY: Number(minY.toFixed(4)),
      maxX: Number(maxX.toFixed(4)),
      maxY: Number(maxY.toFixed(4)),
      width,
      height
    },
    isClosed,
    estimatedArea,
    perimeter: Number(perimeter.toFixed(4)),
    segments: options.includeSegments !== false ? segments : [],
    ...(options.includeRaw ? { rawPrimitives } : {})
  };
}

export async function prepareBoardOutlineMutation(
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
      `Active document is '${currentTarget.documentType}'. Board outline mutations require an active PCB document.`
    );
  }

  const action = String(params.action ?? "set_rectangle").toLowerCase();
  const outlineLayer = await resolveBoardOutlineLayer(eda);
  const beforeSummary = await getBoardOutlineSummary(api);

  if (action === "set_rectangle" || action === "create") {
    const x = isNumber(params.x) ? Number(params.x) : 0;
    const y = isNumber(params.y) ? Number(params.y) : 0;
    const width = numeric(params.width);
    const height = numeric(params.height);

    if (width === undefined || width <= 0) {
      throw apiError("missing_parameters", "Board outline rectangle requires positive 'width'.");
    }
    if (height === undefined || height <= 0) {
      throw apiError("missing_parameters", "Board outline rectangle requires positive 'height'.");
    }

    const lineWidth = isNumber(params.lineWidth) ? Number(params.lineWidth) : 0.2;
    const clearExisting = params.clearExisting !== false;

    const requestedBounds = {
      minX: x,
      minY: y,
      maxX: x + width,
      maxY: y + height,
      width,
      height
    };

    const impact = `Sets rectangular board outline ${width}x${height}mm at (${x}, ${y}) on layer ${outlineLayer.name} (clearing existing: ${clearExisting}).`;
    const preview = {
      impact,
      scope: `document:${currentTarget.documentId ?? "active_pcb"}`,
      before: {
        exists: beforeSummary.exists,
        bounds: beforeSummary.bounds,
        segmentCount: beforeSummary.segmentCount,
        isClosed: beforeSummary.isClosed
      },
      requestedAfter: {
        exists: true,
        bounds: requestedBounds,
        segmentCount: 4,
        isClosed: true
      },
      changedKeys: ["bounds", "width", "height", "segmentCount", "isClosed"]
    };

    const record = extensionMutations.prepare({
      domain: "pcb",
      action: "setBoardOutline",
      target: currentTarget,
      operation: {
        action: "set_rectangle",
        x,
        y,
        width,
        height,
        lineWidth,
        clearExisting,
        layerId: outlineLayer.id
      },
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
      action: "setBoardOutline",
      target: record.target,
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  if (action === "set_polygon") {
    const rawPoints = toArray(params.points);
    if (rawPoints.length < 3) {
      throw apiError("missing_parameters", "Board outline polygon requires 'points' array with at least 3 vertices.");
    }

    const points = rawPoints.map((p: any) => ({
      x: numeric(p?.x) ?? 0,
      y: numeric(p?.y) ?? 0
    }));

    const lineWidth = isNumber(params.lineWidth) ? Number(params.lineWidth) : 0.2;
    const clearExisting = params.clearExisting !== false;

    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));

    const requestedBounds = {
      minX,
      minY,
      maxX,
      maxY,
      width: Number((maxX - minX).toFixed(4)),
      height: Number((maxY - minY).toFixed(4))
    };

    const impact = `Sets polygonal board outline with ${points.length} vertices on layer ${outlineLayer.name} (clearing existing: ${clearExisting}).`;
    const preview = {
      impact,
      scope: `document:${currentTarget.documentId ?? "active_pcb"}`,
      before: {
        exists: beforeSummary.exists,
        bounds: beforeSummary.bounds,
        segmentCount: beforeSummary.segmentCount,
        isClosed: beforeSummary.isClosed
      },
      requestedAfter: {
        exists: true,
        bounds: requestedBounds,
        segmentCount: points.length,
        isClosed: true
      },
      changedKeys: ["bounds", "vertices", "segmentCount", "isClosed"]
    };

    const record = extensionMutations.prepare({
      domain: "pcb",
      action: "setBoardOutline",
      target: currentTarget,
      operation: {
        action: "set_polygon",
        points,
        lineWidth,
        clearExisting,
        layerId: outlineLayer.id
      },
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
      action: "setBoardOutline",
      target: record.target,
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  if (action === "clear") {
    if (!beforeSummary.exists || beforeSummary.segmentCount === 0) {
      throw apiError("no_effective_change", "Active board already has no board outline to clear.");
    }

    const impact = `Clears all ${beforeSummary.segmentCount} board outline segments from layer ${outlineLayer.name}.`;
    const preview = {
      impact,
      scope: `document:${currentTarget.documentId ?? "active_pcb"}`,
      before: {
        exists: true,
        bounds: beforeSummary.bounds,
        segmentCount: beforeSummary.segmentCount
      },
      requestedAfter: {
        exists: false,
        segmentCount: 0
      },
      changedKeys: ["cleared"]
    };

    const record = extensionMutations.prepare({
      domain: "pcb",
      action: "clearBoardOutline",
      target: currentTarget,
      operation: {
        action: "clear",
        layerId: outlineLayer.id
      },
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
      action: "clearBoardOutline",
      target: record.target,
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  if (action === "modify_segment") {
    const primitiveId = String(params.primitiveId ?? "").trim();
    if (!primitiveId) {
      throw apiError("missing_parameters", "modify_segment action requires 'primitiveId'.");
    }

    const existingSeg = beforeSummary.segments.find((s) => s.primitiveId === primitiveId);
    if (!existingSeg) {
      throw apiError("segment_not_found", `Board outline segment "${primitiveId}" was not found.`);
    }

    const updates: Record<string, any> = {};
    if (isNumber(params.startX)) updates.startX = Number(params.startX);
    if (isNumber(params.startY)) updates.startY = Number(params.startY);
    if (isNumber(params.endX)) updates.endX = Number(params.endX);
    if (isNumber(params.endY)) updates.endY = Number(params.endY);
    if (isNumber(params.lineWidth)) updates.lineWidth = Number(params.lineWidth);

    if (Object.keys(updates).length === 0) {
      throw apiError("no_effective_change", "No coordinate or property changes provided for segment modification.");
    }

    const impact = `Modifies board outline segment ${primitiveId} with updates: ${JSON.stringify(updates)}.`;
    const preview = {
      impact,
      scope: `document:${currentTarget.documentId ?? "active_pcb"}`,
      before: {
        primitiveId,
        startX: existingSeg.startX,
        startY: existingSeg.startY,
        endX: existingSeg.endX,
        endY: existingSeg.endY
      },
      requestedAfter: {
        primitiveId,
        ...updates
      },
      changedKeys: Object.keys(updates)
    };

    const record = extensionMutations.prepare({
      domain: "pcb",
      action: "modifyBoardOutline",
      target: currentTarget,
      operation: {
        action: "modify_segment",
        primitiveId,
        updates
      },
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
      action: "modifyBoardOutline",
      target: record.target,
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  throw apiError(
    "unsupported_action",
    `Unsupported board outline action '${action}'. Expected set_rectangle, set_polygon, clear, or modify_segment.`
  );
}

export async function executeBoardOutlineMutation(
  api: () => EasyEdaApi,
  op: Record<string, any>,
  _expectedBefore?: unknown
): Promise<{ executed: true; readback: Record<string, unknown> }> {
  const eda = api();
  const outlineLayer = await resolveBoardOutlineLayer(eda);

  if (op.action === "clear") {
    const existing = await getBoardOutlineSummary(api);
    if (existing.segments.length > 0 && eda.pcb_PrimitiveLine?.delete) {
      const ids = existing.segments.map((s) => s.primitiveId).filter(Boolean);
      if (ids.length > 0) {
        await eda.pcb_PrimitiveLine.delete(ids);
      }
    }

    const readback = await getBoardOutlineSummary(api);
    if (readback.segmentCount > 0) {
      throw apiError("readback_verification_failed", "Board outline segments still present after clear.");
    }

    return {
      executed: true,
      readback: {
        cleared: true,
        segmentCount: 0,
        verified: true
      }
    };
  }

  if (op.action === "set_rectangle" || op.action === "set_polygon") {
    // 1. Clear existing segments if requested
    if (op.clearExisting) {
      const existing = await getBoardOutlineSummary(api);
      if (existing.segments.length > 0 && eda.pcb_PrimitiveLine?.delete) {
        const ids = existing.segments.map((s) => s.primitiveId).filter(Boolean);
        if (ids.length > 0) {
          await eda.pcb_PrimitiveLine.delete(ids);
        }
      }
    }

    // 2. Build vertices
    let points: { x: number; y: number }[];
    if (op.action === "set_rectangle") {
      const { x, y, width, height } = op;
      points = [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height }
      ];
    } else {
      points = op.points;
    }

    // 3. Create lines connecting consecutive vertices
    if (!eda.pcb_PrimitiveLine?.create) {
      throw apiError("unsupported_api", "EasyEDA Pro API method pcb_PrimitiveLine.create is unavailable.");
    }

    const layerId = op.layerId ?? outlineLayer.id;
    const lineWidth = op.lineWidth ?? 0.2;

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      await eda.pcb_PrimitiveLine.create("", layerId, p1.x, p1.y, p2.x, p2.y, lineWidth, false);
    }

    // 4. Zoom to board outline if supported
    if (eda.pcb_Document?.zoomToBoardOutline) {
      await optionalCall(() => eda.pcb_Document.zoomToBoardOutline());
    }

    // 5. Readback verification
    const readback = await getBoardOutlineSummary(api);
    if (readback.segmentCount !== points.length) {
      throw apiError(
        "readback_verification_failed",
        `Board outline segment count mismatch. Expected ${points.length}, found ${readback.segmentCount}.`
      );
    }

    if (op.action === "set_rectangle") {
      const widthMatch = Math.abs(readback.bounds.width - op.width) <= 1;
      const heightMatch = Math.abs(readback.bounds.height - op.height) <= 1;
      if (!widthMatch || !heightMatch) {
        throw apiError(
          "readback_verification_failed",
          `Board outline dimensions mismatch. Expected ${op.width}x${op.height}mm, got ${readback.bounds.width}x${readback.bounds.height}mm.`
        );
      }
    }

    return {
      executed: true,
      readback: {
        bounds: readback.bounds,
        segmentCount: readback.segmentCount,
        isClosed: readback.isClosed,
        perimeter: readback.perimeter,
        verified: true
      }
    };
  }

  if (op.action === "modify_segment") {
    if (!eda.pcb_PrimitiveLine?.modify) {
      throw apiError("unsupported_api", "EasyEDA Pro API method pcb_PrimitiveLine.modify is unavailable.");
    }

    await eda.pcb_PrimitiveLine.modify(op.primitiveId, op.updates);

    const readback = await getBoardOutlineSummary(api);
    const updated = readback.segments.find((s) => s.primitiveId === op.primitiveId);
    if (!updated) {
      throw apiError("readback_verification_failed", `Modified segment "${op.primitiveId}" not found in readback.`);
    }

    return {
      executed: true,
      readback: {
        primitiveId: op.primitiveId,
        updatedSegment: updated,
        verified: true
      }
    };
  }

  throw apiError("unsupported_action", `Unsupported execution action '${op.action}'.`);
}
