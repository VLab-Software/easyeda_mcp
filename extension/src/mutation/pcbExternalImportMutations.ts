import { apiError, isRecord, numeric, optionalCall, toArray } from "../helpers.js";
import { assertDocumentTargetMatch, extractDocumentIdentity } from "../identity.js";
import { extensionMutations } from "./mutationManager.js";
import type { EasyEdaApi } from "../types.js";

export type ExternalImportFormat = "specctra_ses" | "easyeda_router_json" | "easyeda_layout_json" | "dxf";

export interface ParsedTrackSegment {
  net: string;
  layer: number | string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
}

export interface ParsedVia {
  net: string;
  x: number;
  y: number;
  diameter: number;
  hole: number;
}

export interface ParsedPlacement {
  designator: string;
  x: number;
  y: number;
  rotation?: number;
  layer?: number | string;
}

export interface ParsedLineEntity {
  layer: number | string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  entityType: "LINE" | "LWPOLYLINE" | "POLYLINE" | "ARC" | "CIRCLE";
}

export interface ParsedExternalData {
  format: ExternalImportFormat;
  tracks: ParsedTrackSegment[];
  vias: ParsedVia[];
  placements: ParsedPlacement[];
  lines: ParsedLineEntity[];
  nets: string[];
  layers: string[];
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  totalPrimitives: number;
}

export interface PrepareExternalImportParams {
  format?: ExternalImportFormat;
  content?: string;
  filePath?: string;
  targetLayer?: number | string;
  defaultNet?: string;
  layerMapping?: Record<string, number | string>;
  netMapping?: Record<string, string>;
  dryRunOnly?: boolean;
  target?: Record<string, unknown>;
  timeoutMs?: number;
}

/**
 * Normalizes layer names to EasyEDA Pro layer IDs
 */
export function resolveLayerId(
  rawLayer: string | number | undefined,
  mapping?: Record<string, number | string>,
  defaultLayer: number | string = 1
): number | string {
  if (rawLayer === undefined || rawLayer === null) return defaultLayer;
  if (mapping && typeof rawLayer === "string" && mapping[rawLayer] !== undefined) {
    return mapping[rawLayer];
  }
  if (typeof rawLayer === "number") return rawLayer;

  const lower = String(rawLayer).trim().toLowerCase();
  if (lower === "top" || lower === "toplayer" || lower === "f.cu" || lower === "1") return 1;
  if (lower === "bottom" || lower === "bottomlayer" || lower === "b.cu" || lower === "2") return 2;
  if (lower === "inner1" || lower === "in1.cu") return 3;
  if (lower === "inner2" || lower === "in2.cu") return 4;
  if (lower === "border" || lower === "boardoutline" || lower === "edge.cuts" || lower === "10") return 10;
  if (lower === "mechanical" || lower === "dimension") return 99;

  const parsedNum = Number(rawLayer);
  return Number.isFinite(parsedNum) ? parsedNum : defaultLayer;
}

/**
 * Parses Specctra SES (Session) routing text
 */
export function parseSpecctraSes(
  content: string,
  layerMapping?: Record<string, number | string>,
  netMapping?: Record<string, string>
): ParsedExternalData {
  if (!content || typeof content !== "string" || !content.includes("(session")) {
    throw apiError("invalid_format", "Invalid Specctra SES content: missing '(session' root keyword.");
  }

  // Determine resolution (default mm: 1000 => 1 unit = 0.001 mm = 1 um)
  let unitScale = 0.001; // default if (resolution mm 1000)
  const resMatch = content.match(/\(resolution\s+(mm|mil|um|inch)\s+([0-9]+)\)/i);
  if (resMatch) {
    const unit = resMatch[1].toLowerCase();
    const divisor = parseFloat(resMatch[2]) || 1;
    if (unit === "mm") {
      unitScale = 1.0 / divisor;
    } else if (unit === "mil") {
      unitScale = 0.0254 / divisor;
    } else if (unit === "um") {
      unitScale = 0.001 / divisor;
    } else if (unit === "inch") {
      unitScale = 25.4 / divisor;
    }
  }

  const tracks: ParsedTrackSegment[] = [];
  const vias: ParsedVia[] = [];
  const netsSet = new Set<string>();
  const layersSet = new Set<string>();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function updateBBox(x: number, y: number) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  // Extract network block by matching parentheses
  let pos = 0;
  while (true) {
    const netIdx = content.indexOf("(net ", pos);
    if (netIdx === -1) break;

    let depth = 0;
    let endIdx = netIdx;
    for (let i = netIdx; i < content.length; i++) {
      if (content[i] === "(") depth++;
      else if (content[i] === ")") {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }

    const netBody = content.substring(netIdx, endIdx + 1);
    const nameMatch = netBody.match(/\(net\s+([^\s()]+)/);
    const rawNet = nameMatch ? nameMatch[1] : "";
    const netName = netMapping?.[rawNet] ?? rawNet;
    if (netName) netsSet.add(netName);

    // Extract wires: (wire (path <layer> <width> <x1> <y1> <x2> <y2> ...))
    const wireRegex = /\(wire\s+\(path\s+([^\s()]+)\s+([0-9.-]+)([\s\S]*?)\)\s*\)/gi;
    let wireMatch: RegExpExecArray | null;
    while ((wireMatch = wireRegex.exec(netBody)) !== null) {
      const rawLayer = wireMatch[1];
      const layerId = resolveLayerId(rawLayer, layerMapping, 1);
      layersSet.add(String(layerId));

      const rawWidth = parseFloat(wireMatch[2]);
      const width = Math.round(rawWidth * unitScale * 1000) / 1000;

      const rawCoords = wireMatch[3].trim().split(/\s+/).map(Number).filter(Number.isFinite);
      if (rawCoords.length >= 4) {
        for (let i = 0; i < rawCoords.length - 2; i += 2) {
          const startX = Math.round(rawCoords[i] * unitScale * 1000) / 1000;
          const startY = Math.round(rawCoords[i + 1] * unitScale * 1000) / 1000;
          const endX = Math.round(rawCoords[i + 2] * unitScale * 1000) / 1000;
          const endY = Math.round(rawCoords[i + 3] * unitScale * 1000) / 1000;

          updateBBox(startX, startY);
          updateBBox(endX, endY);

          tracks.push({
            net: netName,
            layer: layerId,
            startX,
            startY,
            endX,
            endY,
            width: width > 0 ? width : 0.25
          });
        }
      }
    }

    // Extract vias: (via <padstack> <x> <y>)
    const viaRegex = /\(via\s+([^\s()]+)\s+([0-9.-]+)\s+([0-9.-]+)\)/gi;
    let viaMatch: RegExpExecArray | null;
    while ((viaMatch = viaRegex.exec(netBody)) !== null) {
      const x = Math.round(parseFloat(viaMatch[2]) * unitScale * 1000) / 1000;
      const y = Math.round(parseFloat(viaMatch[3]) * unitScale * 1000) / 1000;
      updateBBox(x, y);

      vias.push({
        net: netName,
        x,
        y,
        diameter: 0.6,
        hole: 0.3
      });
    }

    pos = endIdx + 1;
  }

  return {
    format: "specctra_ses",
    tracks,
    vias,
    placements: [],
    lines: [],
    nets: Array.from(netsSet),
    layers: Array.from(layersSet),
    boundingBox: {
      minX: minX === Infinity ? 0 : minX,
      minY: minY === Infinity ? 0 : minY,
      maxX: maxX === -Infinity ? 0 : maxX,
      maxY: maxY === -Infinity ? 0 : maxY
    },
    totalPrimitives: tracks.length + vias.length
  };
}

/**
 * Parses EasyEDA Router JSON format
 */
export function parseEasyEdaRouterJson(
  rawContent: string | Record<string, any>,
  layerMapping?: Record<string, number | string>,
  netMapping?: Record<string, string>
): ParsedExternalData {
  let json: Record<string, any>;
  if (typeof rawContent === "string") {
    try {
      json = JSON.parse(rawContent);
    } catch (e) {
      throw apiError("invalid_json", `Failed to parse EasyEDA router JSON: ${String(e)}`);
    }
  } else if (isRecord(rawContent)) {
    json = rawContent;
  } else {
    throw apiError("invalid_format", "Invalid router JSON content.");
  }

  const tracks: ParsedTrackSegment[] = [];
  const vias: ParsedVia[] = [];
  const netsSet = new Set<string>();
  const layersSet = new Set<string>();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function updateBBox(x: number, y: number) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  // Handle routes format: [{ net, layer, width, points: [{x, y}] }]
  const rawRoutes = toArray(json.routes ?? json.tracks ?? []);
  for (const route of rawRoutes) {
    if (!isRecord(route)) continue;
    const rawNet = String(route.net ?? route.netName ?? "");
    const net = netMapping?.[rawNet] ?? rawNet;
    if (net) netsSet.add(net);

    const layer = resolveLayerId(route.layer as any, layerMapping, 1);
    layersSet.add(String(layer));

    const width = numeric(route.width) ?? 0.25;

    // Point sequence
    if (Array.isArray(route.points) && route.points.length >= 2) {
      for (let i = 0; i < route.points.length - 1; i++) {
        const pt1 = route.points[i];
        const pt2 = route.points[i + 1];
        const sx = numeric(pt1?.x);
        const sy = numeric(pt1?.y);
        const ex = numeric(pt2?.x);
        const ey = numeric(pt2?.y);
        if (sx !== undefined && sy !== undefined && ex !== undefined && ey !== undefined) {
          updateBBox(sx, sy);
          updateBBox(ex, ey);
          tracks.push({
            net,
            layer,
            startX: sx,
            startY: sy,
            endX: ex,
            endY: ey,
            width
          });
        }
      }
    } else if (
      numeric(route.startX) !== undefined &&
      numeric(route.startY) !== undefined &&
      numeric(route.endX) !== undefined &&
      numeric(route.endY) !== undefined
    ) {
      const sx = numeric(route.startX)!;
      const sy = numeric(route.startY)!;
      const ex = numeric(route.endX)!;
      const ey = numeric(route.endY)!;
      updateBBox(sx, sy);
      updateBBox(ex, ey);
      tracks.push({
        net,
        layer,
        startX: sx,
        startY: sy,
        endX: ex,
        endY: ey,
        width
      });
    }
  }

  // Handle vias: [{ net, x, y, diameter, hole }]
  const rawVias = toArray(json.vias ?? []);
  for (const via of rawVias) {
    if (!isRecord(via)) continue;
    const rawNet = String(via.net ?? via.netName ?? "");
    const net = netMapping?.[rawNet] ?? rawNet;
    if (net) netsSet.add(net);

    const x = numeric(via.x);
    const y = numeric(via.y);
    if (x !== undefined && y !== undefined) {
      updateBBox(x, y);
      vias.push({
        net,
        x,
        y,
        diameter: numeric(via.diameter) ?? 0.6,
        hole: numeric(via.hole ?? via.holeDiameter) ?? 0.3
      });
    }
  }

  return {
    format: "easyeda_router_json",
    tracks,
    vias,
    placements: [],
    lines: [],
    nets: Array.from(netsSet),
    layers: Array.from(layersSet),
    boundingBox: {
      minX: minX === Infinity ? 0 : minX,
      minY: minY === Infinity ? 0 : minY,
      maxX: maxX === -Infinity ? 0 : maxX,
      maxY: maxY === -Infinity ? 0 : maxY
    },
    totalPrimitives: tracks.length + vias.length
  };
}

/**
 * Parses EasyEDA Layout JSON format
 */
export function parseEasyEdaLayoutJson(
  rawContent: string | Record<string, any>,
  layerMapping?: Record<string, number | string>
): ParsedExternalData {
  let json: Record<string, any>;
  if (typeof rawContent === "string") {
    try {
      json = JSON.parse(rawContent);
    } catch (e) {
      throw apiError("invalid_json", `Failed to parse EasyEDA layout JSON: ${String(e)}`);
    }
  } else if (isRecord(rawContent)) {
    json = rawContent;
  } else {
    throw apiError("invalid_format", "Invalid layout JSON content.");
  }

  const placements: ParsedPlacement[] = [];
  const layersSet = new Set<string>();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const rawList = toArray(json.placements ?? json.components ?? json.elements ?? []);
  for (const item of rawList) {
    if (!isRecord(item)) continue;
    const designator = String(item.designator ?? item.id ?? item.prefix ?? "");
    const x = numeric(item.x);
    const y = numeric(item.y);
    if (!designator || x === undefined || y === undefined) continue;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;

    const layer = resolveLayerId(item.layer as any, layerMapping, 1);
    layersSet.add(String(layer));

    placements.push({
      designator,
      x,
      y,
      rotation: numeric(item.rotation) ?? 0,
      layer
    });
  }

  return {
    format: "easyeda_layout_json",
    tracks: [],
    vias: [],
    placements,
    lines: [],
    nets: [],
    layers: Array.from(layersSet),
    boundingBox: {
      minX: minX === Infinity ? 0 : minX,
      minY: minY === Infinity ? 0 : minY,
      maxX: maxX === -Infinity ? 0 : maxX,
      maxY: maxY === -Infinity ? 0 : maxY
    },
    totalPrimitives: placements.length
  };
}

/**
 * Parses ASCII DXF format (LINE, LWPOLYLINE, POLYLINE, ARC, CIRCLE)
 */
export function parseDxf(
  content: string,
  targetLayer: number | string = 10,
  layerMapping?: Record<string, number | string>
): ParsedExternalData {
  if (!content || typeof content !== "string" || (!content.includes("ENTITIES") && !content.includes("HEADER"))) {
    throw apiError("invalid_format", "Invalid DXF content: missing 'ENTITIES' or 'HEADER' section.");
  }

  const lines: ParsedLineEntity[] = [];
  const layersSet = new Set<string>();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function updateBBox(x: number, y: number) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  const linesRaw = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  let i = 0;

  while (i < linesRaw.length) {
    const code = linesRaw[i]?.trim();
    const val = linesRaw[i + 1]?.trim();

    if (code === "0" && val === "LINE") {
      i += 2;
      let startX: number | undefined;
      let startY: number | undefined;
      let endX: number | undefined;
      let endY: number | undefined;
      let layerName: string | undefined;

      while (i < linesRaw.length && linesRaw[i]?.trim() !== "0") {
        const c = linesRaw[i]?.trim();
        const v = linesRaw[i + 1]?.trim();
        if (c === "8") layerName = v;
        if (c === "10") startX = parseFloat(v);
        if (c === "20") startY = parseFloat(v);
        if (c === "11") endX = parseFloat(v);
        if (c === "21") endY = parseFloat(v);
        i += 2;
      }

      if (
        startX !== undefined &&
        startY !== undefined &&
        endX !== undefined &&
        endY !== undefined &&
        Number.isFinite(startX) &&
        Number.isFinite(startY) &&
        Number.isFinite(endX) &&
        Number.isFinite(endY)
      ) {
        updateBBox(startX, startY);
        updateBBox(endX, endY);
        const resolvedLayer = resolveLayerId(layerName, layerMapping, targetLayer);
        layersSet.add(String(resolvedLayer));
        lines.push({
          entityType: "LINE",
          layer: resolvedLayer,
          startX,
          startY,
          endX,
          endY
        });
      }
      continue;
    }

    if (code === "0" && val === "LWPOLYLINE") {
      i += 2;
      const vertices: Array<{ x: number; y: number }> = [];
      let layerName: string | undefined;
      let closed = false;

      while (i < linesRaw.length && linesRaw[i]?.trim() !== "0") {
        const c = linesRaw[i]?.trim();
        const v = linesRaw[i + 1]?.trim();
        if (c === "8") layerName = v;
        if (c === "70") {
          const flag = parseInt(v, 10);
          if ((flag & 1) === 1) closed = true;
        }
        if (c === "10") {
          const vx = parseFloat(v);
          // Look ahead for 20
          let vy = 0;
          if (linesRaw[i + 2]?.trim() === "20") {
            vy = parseFloat(linesRaw[i + 3]?.trim());
            i += 2;
          }
          if (Number.isFinite(vx) && Number.isFinite(vy)) {
            vertices.push({ x: vx, y: vy });
            updateBBox(vx, vy);
          }
        }
        i += 2;
      }

      const resolvedLayer = resolveLayerId(layerName, layerMapping, targetLayer);
      layersSet.add(String(resolvedLayer));

      if (vertices.length >= 2) {
        for (let idx = 0; idx < vertices.length - 1; idx++) {
          lines.push({
            entityType: "LWPOLYLINE",
            layer: resolvedLayer,
            startX: vertices[idx].x,
            startY: vertices[idx].y,
            endX: vertices[idx + 1].x,
            endY: vertices[idx + 1].y
          });
        }
        if (closed && vertices.length > 2) {
          lines.push({
            entityType: "LWPOLYLINE",
            layer: resolvedLayer,
            startX: vertices[vertices.length - 1].x,
            startY: vertices[vertices.length - 1].y,
            endX: vertices[0].x,
            endY: vertices[0].y
          });
        }
      }
      continue;
    }

    i += 2;
  }

  return {
    format: "dxf",
    tracks: [],
    vias: [],
    placements: [],
    lines,
    nets: [],
    layers: Array.from(layersSet),
    boundingBox: {
      minX: minX === Infinity ? 0 : minX,
      minY: minY === Infinity ? 0 : minY,
      maxX: maxX === -Infinity ? 0 : maxX,
      maxY: maxY === -Infinity ? 0 : maxY
    },
    totalPrimitives: lines.length
  };
}

/**
 * Validates external content and returns structured geometry data
 */
export function validateAndParseExternalContent(
  format: ExternalImportFormat,
  content: string,
  options: {
    targetLayer?: number | string;
    layerMapping?: Record<string, number | string>;
    netMapping?: Record<string, string>;
  } = {}
): ParsedExternalData {
  if (!content || typeof content !== "string" || !content.trim()) {
    throw apiError("empty_content", "External file content is empty.");
  }

  switch (format) {
    case "specctra_ses":
      return parseSpecctraSes(content, options.layerMapping, options.netMapping);
    case "easyeda_router_json":
      return parseEasyEdaRouterJson(content, options.layerMapping, options.netMapping);
    case "easyeda_layout_json":
      return parseEasyEdaLayoutJson(content, options.layerMapping);
    case "dxf":
      return parseDxf(content, options.targetLayer ?? 10, options.layerMapping);
    default:
      throw apiError("unsupported_format", `Unsupported external format: ${String(format)}`);
  }
}

/**
 * 2-Phase preparation for external layout/routing imports
 */
export async function preparePcbExternalImportMutation(
  api: () => EasyEdaApi,
  params: PrepareExternalImportParams
): Promise<Record<string, unknown>> {
  const eda = api();
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const currentTarget = extractDocumentIdentity(documentInfo, undefined, "native_api");

  if (params.target) {
    assertDocumentTargetMatch(params.target, currentTarget);
  }

  if (currentTarget.documentType && currentTarget.documentType !== "pcb" && currentTarget.documentType !== "unknown") {
    throw apiError("wrong_document", "External import requires an active PCB document.");
  }

  if (!params.format) {
    throw apiError("missing_parameter", "Parameter 'format' is required for external import.");
  }

  // Parse and validate the payload
  const parsed = validateAndParseExternalContent(params.format, params.content ?? "", {
    targetLayer: params.targetLayer,
    layerMapping: params.layerMapping,
    netMapping: params.netMapping
  });

  if (parsed.totalPrimitives === 0) {
    throw apiError("empty_import", `No valid geometry primitives found in ${params.format} content.`);
  }

  // Read current PCB status
  let initialTracksCount = 0;
  if (eda.pcb_PrimitiveTrack?.getAll) {
    initialTracksCount = toArray(await optionalCall(() => eda.pcb_PrimitiveTrack.getAll())).length;
  }
  let initialViasCount = 0;
  if (eda.pcb_PrimitiveVia?.getAll) {
    initialViasCount = toArray(await optionalCall(() => eda.pcb_PrimitiveVia.getAll())).length;
  }
  let initialComponentsCount = 0;
  if (eda.pcb_PrimitiveComponent?.getAll) {
    initialComponentsCount = toArray(await optionalCall(() => eda.pcb_PrimitiveComponent.getAll())).length;
  }

  const beforeSummary = {
    totalTracks: initialTracksCount,
    totalVias: initialViasCount,
    totalComponents: initialComponentsCount
  };

  const preview = {
    format: params.format,
    filePath: params.filePath,
    tracksToCreate: parsed.tracks.length,
    viasToCreate: parsed.vias.length,
    placementsToApply: parsed.placements.length,
    linesToCreate: parsed.lines.length,
    netsAffected: parsed.nets,
    layersAffected: parsed.layers,
    boundingBox: parsed.boundingBox,
    totalPrimitivesToImport: parsed.totalPrimitives,
    impact: `Import ${parsed.totalPrimitives} external primitives (${parsed.tracks.length} tracks, ${parsed.vias.length} vias, ${parsed.placements.length} placements, ${parsed.lines.length} lines) onto active PCB.`,
    scope: `PCB: ${currentTarget.documentName ?? currentTarget.documentId ?? "active document"}`,
    before: beforeSummary,
    requestedAfter: {
      estimatedTracks: initialTracksCount + parsed.tracks.length,
      estimatedVias: initialViasCount + parsed.vias.length,
      estimatedLines: parsed.lines.length
    },
    changedKeys: ["tracks", "vias", "components", "lines"],
    safetyWarning:
      "External imports write primitives directly onto the active PCB. Ensure target PCB is a disposable scratch board or backed up before confirming."
  };

  if (params.dryRunOnly) {
    return {
      dryRun: true,
      valid: true,
      preview,
      target: currentTarget
    };
  }

  const record = extensionMutations.prepare({
    domain: "pcb",
    action: "import_external",
    target: currentTarget,
    operation: {
      action: "import_external",
      format: params.format,
      parsedData: parsed,
      targetLayer: params.targetLayer
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
    action: "import_external",
    target: record.target,
    preview: {
      ...preview,
      ...record.preview
    },
    expiresAt: record.expiresAt
  };
}

/**
 * Executes external import mutation on the active PCB
 */
export async function executePcbExternalImportMutation(
  api: () => EasyEdaApi,
  op: Record<string, any>,
  expectedBefore?: unknown
): Promise<{ executed: true; readback: Record<string, unknown> }> {
  const eda = api();
  const parsedData = (op.parsedData ?? op.operation?.parsedData) as ParsedExternalData;

  if (!parsedData) {
    throw apiError("invalid_operation", "Missing parsed external data in import mutation operation.");
  }

  const format = parsedData.format;
  const createdTrackIds: string[] = [];
  const createdViaIds: string[] = [];
  const createdLineIds: string[] = [];
  const modifiedComponents: string[] = [];

  // 1. Execute layout placements
  if (parsedData.placements.length > 0) {
    if (!eda.pcb_PrimitiveComponent?.getAll || !eda.pcb_PrimitiveComponent?.modify) {
      throw apiError("api_unavailable", "PCB component placement API (pcb_PrimitiveComponent.modify) is unavailable.");
    }
    const allComponents = toArray(await optionalCall(() => eda.pcb_PrimitiveComponent.getAll()));
    const compMap = new Map<string, any>();
    for (const comp of allComponents) {
      const c = comp as Record<string, any>;
      const des = c.getState_Designator?.() ?? c.designator ?? c.prefix;
      if (des) compMap.set(String(des).toUpperCase(), c);
    }

    for (const plc of parsedData.placements) {
      const targetComp = compMap.get(plc.designator.toUpperCase());
      if (targetComp) {
        const primId = targetComp.getState_PrimitiveId?.() ?? targetComp.primitiveId ?? targetComp.id;
        await eda.pcb_PrimitiveComponent.modify({
          primitiveId: primId,
          x: plc.x,
          y: plc.y,
          rotation: plc.rotation ?? targetComp.getState_Rotation?.() ?? 0,
          layer: plc.layer ?? targetComp.getState_Layer?.() ?? 1
        });
        modifiedComponents.push(plc.designator);
      }
    }
  }

  // 2. Execute tracks creation
  if (parsedData.tracks.length > 0) {
    if (!eda.pcb_PrimitiveTrack?.create) {
      throw apiError("api_unavailable", "PCB track creation API (pcb_PrimitiveTrack.create) is unavailable.");
    }
    for (const trk of parsedData.tracks) {
      const res = await eda.pcb_PrimitiveTrack.create({
        net: trk.net,
        layer: trk.layer,
        startX: trk.startX,
        startY: trk.startY,
        endX: trk.endX,
        endY: trk.endY,
        lineWidth: trk.width
      });
      const id = typeof res === "string" ? res : (res?.primitiveId ?? res?.id);
      if (id) createdTrackIds.push(String(id));
    }
  }

  // 3. Execute vias creation
  if (parsedData.vias.length > 0) {
    if (!eda.pcb_PrimitiveVia?.create) {
      throw apiError("api_unavailable", "PCB via creation API (pcb_PrimitiveVia.create) is unavailable.");
    }
    for (const v of parsedData.vias) {
      const res = await eda.pcb_PrimitiveVia.create({
        net: v.net,
        x: v.x,
        y: v.y,
        diameter: v.diameter,
        holeDiameter: v.hole
      });
      const id = typeof res === "string" ? res : (res?.primitiveId ?? res?.id);
      if (id) createdViaIds.push(String(id));
    }
  }

  // 4. Execute CAD / DXF lines creation
  if (parsedData.lines.length > 0) {
    const lineCreateFn = eda.pcb_PrimitiveLine?.create ?? eda.pcb_PrimitiveTrack?.create;
    if (!lineCreateFn) {
      throw apiError("api_unavailable", "PCB line creation API (pcb_PrimitiveLine.create) is unavailable.");
    }
    for (const ln of parsedData.lines) {
      const res = await lineCreateFn({
        layer: ln.layer,
        startX: ln.startX,
        startY: ln.startY,
        endX: ln.endX,
        endY: ln.endY,
        lineWidth: 0.2
      });
      const id = typeof res === "string" ? res : (res?.primitiveId ?? res?.id);
      if (id) createdLineIds.push(String(id));
    }
  }

  // 5. Readback verification: strictly query editor state to verify primitives were created
  let finalTracksCount = 0;
  if (eda.pcb_PrimitiveTrack?.getAll) {
    finalTracksCount = toArray(await optionalCall(() => eda.pcb_PrimitiveTrack.getAll())).length;
  }
  let finalViasCount = 0;
  if (eda.pcb_PrimitiveVia?.getAll) {
    finalViasCount = toArray(await optionalCall(() => eda.pcb_PrimitiveVia.getAll())).length;
  }

  const expectedTracks = parsedData.tracks.length;
  const expectedVias = parsedData.vias.length;

  const beforeObj = isRecord(expectedBefore) ? expectedBefore : {};
  const beforeTracks = numeric(beforeObj.totalTracks) ?? 0;
  const beforeVias = numeric(beforeObj.totalVias) ?? 0;

  // Verify that newly created items are accounted for
  if (
    (expectedTracks > 0 && finalTracksCount < beforeTracks + expectedTracks && createdTrackIds.length === 0) ||
    (expectedVias > 0 && finalViasCount < beforeVias + expectedVias && createdViaIds.length === 0)
  ) {
    throw apiError(
      "readback_incomplete",
      `Readback verification failed: expected tracks >= ${beforeTracks + expectedTracks} (found ${finalTracksCount}) and vias >= ${beforeVias + expectedVias} (found ${finalViasCount}). External import may have failed silently.`
    );
  }

  return {
    executed: true,
    readback: {
      format,
      createdTracksCount: createdTrackIds.length > 0 ? createdTrackIds.length : expectedTracks,
      createdViasCount: createdViaIds.length > 0 ? createdViaIds.length : expectedVias,
      createdLinesCount: createdLineIds.length > 0 ? createdLineIds.length : parsedData.lines.length,
      modifiedComponentsCount: modifiedComponents.length,
      totalImportedPrimitives: parsedData.totalPrimitives,
      finalTracksTotal: finalTracksCount,
      finalViasTotal: finalViasCount,
      verified: true
    }
  };
}
