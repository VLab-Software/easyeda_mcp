import { apiError, numeric, optionalCall, toArray } from "../helpers.js";
import { assertDocumentTargetMatch, extractDocumentIdentity } from "../identity.js";
import type { EasyEdaApi } from "../types.js";

export interface Pcb3dInspectionParams {
  maxHeightMm?: number;
  enclosureHeightMm?: number;
  checkInterference?: boolean;
  target?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface Pcb3dViewParams {
  viewAngle?: "top" | "bottom" | "isometric_ne" | "isometric_sw" | "front" | "side";
  target?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface Component3dInfo {
  primitiveId: string;
  designator: string;
  footprint: string;
  layer: number | string;
  layerName: "Top" | "Bottom" | "Other";
  x: number;
  y: number;
  rotation: number;
  has3DModel: boolean;
  modelType: "STEP" | "OBJ" | "WRL" | "NONE";
  modelTitle?: string;
  modelUuid?: string;
  heightMm: number;
  elevationMm: number;
  heightSource: "native_3d" | "attribute" | "package_heuristic";
  boundingBox3d: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
}

export interface Board3dEnvelope {
  boardThicknessMm: number;
  maxHeightTopMm: number;
  maxHeightBottomMm: number;
  totalEnvelopeHeightMm: number;
  tallestComponentTop?: {
    designator: string;
    heightMm: number;
    footprint: string;
    x: number;
    y: number;
  };
  tallestComponentBottom?: {
    designator: string;
    heightMm: number;
    footprint: string;
    x: number;
    y: number;
  };
  enclosureClearanceMm?: number;
  enclosureStatus?: "FIT" | "TIGHT" | "EXCEEDED";
}

export interface Missing3dModel {
  designator: string;
  footprint: string;
  criticality: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
}

export interface InterferencePair3d {
  componentA: string;
  componentB: string;
  overlapVolumeMm3?: number;
  details: string;
}

export interface HeightViolation3d {
  designator: string;
  heightMm: number;
  maxPermittedMm: number;
  exceededByMm: number;
  layer: string;
}

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

/**
 * Heuristic height estimation based on footprint and package naming
 */
export function estimateComponentHeight(footprint: string, designator: string): number {
  const fp = (footprint || "").toUpperCase();
  const des = (designator || "").toUpperCase();

  // Connectors / Headers / USB
  if (des.startsWith("J") || fp.includes("CONN") || fp.includes("USB") || fp.includes("HEADER") || fp.includes("PIN")) {
    if (fp.includes("USB-C") || fp.includes("TYPE-C")) return 3.2;
    if (fp.includes("USB")) return 7.0;
    if (fp.includes("RJ45")) return 13.5;
    if (fp.includes("HEADER") || fp.includes("HDR")) return 8.5;
    return 6.0;
  }

  // Large electrolytic capacitors
  if (
    des.startsWith("C") &&
    (fp.includes("ALUM") || fp.includes("ELEC") || fp.includes("CAN") || fp.includes("CAP-D"))
  ) {
    return 11.0;
  }

  // Tantalum / Inductors / Transformers
  if (des.startsWith("T") || fp.includes("TRANS")) return 12.0;
  if (
    des.startsWith("L") &&
    (fp.includes("INDUCTOR") || fp.includes("COIL") || fp.includes("NR") || fp.includes("CD"))
  ) {
    return 4.5;
  }

  // Power packages
  if (fp.includes("TO-220") || fp.includes("TO-247")) return 15.0;
  if (fp.includes("TO-263") || fp.includes("D2PAK")) return 4.5;
  if (fp.includes("TO-252") || fp.includes("DPAK")) return 2.3;
  if (fp.includes("SOT-223")) return 1.8;
  if (fp.includes("SOT-23") || fp.includes("SOT23")) return 1.1;

  // IC packages
  if (fp.includes("DIP") || fp.includes("PDIP")) return 5.1;
  if (fp.includes("SOIC") || fp.includes("SOP")) return 1.75;
  if (fp.includes("TSSOP") || fp.includes("MSOP")) return 1.1;
  if (fp.includes("QFP") || fp.includes("LQFP")) return 1.6;
  if (fp.includes("QFN") || fp.includes("DFN")) return 0.9;
  if (fp.includes("BGA")) return 1.5;

  // Discrete SMD passives
  if (fp.includes("0402")) return 0.35;
  if (fp.includes("0603")) return 0.45;
  if (fp.includes("0805")) return 0.6;
  if (fp.includes("1206")) return 0.7;
  if (fp.includes("1210") || fp.includes("2512")) return 0.8;

  // Push buttons / switches
  if (des.startsWith("SW") || fp.includes("SWITCH") || fp.includes("KEY")) return 4.0;

  // Default passive / discrete height
  return 1.0;
}

export function classifyMissingModelCriticality(designator: string, footprint: string): "HIGH" | "MEDIUM" | "LOW" {
  const des = (designator || "").toUpperCase();
  const fp = (footprint || "").toUpperCase();

  if (
    des.startsWith("J") ||
    des.startsWith("T") ||
    des.startsWith("SW") ||
    des.startsWith("HS") ||
    fp.includes("CONN") ||
    fp.includes("USB") ||
    fp.includes("HEADER") ||
    fp.includes("TRANS") ||
    fp.includes("ELEC") ||
    fp.includes("ALUM") ||
    fp.includes("CAN") ||
    fp.includes("TO-220")
  ) {
    return "HIGH";
  }

  if (des.startsWith("U") || fp.includes("QFP") || fp.includes("BGA") || fp.includes("SOIC") || fp.includes("MODULE")) {
    return "MEDIUM";
  }

  return "LOW";
}

/**
 * Inspects 3D models and vertical spatial clearance on the active PCB
 */
export async function inspectPcb3d(
  api: () => EasyEdaApi,
  params: Pcb3dInspectionParams = {}
): Promise<Record<string, unknown>> {
  const eda = api();
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const currentTarget = extractDocumentIdentity(documentInfo, undefined, "native_api");

  if (params.target) {
    assertDocumentTargetMatch(params.target, currentTarget);
  }

  if (currentTarget.documentType && currentTarget.documentType !== "pcb" && currentTarget.documentType !== "unknown") {
    throw apiError("wrong_document", "3D PCB inspection requires an active PCB document.");
  }

  // Get raw components
  let rawComponents: any[] = [];
  if (eda.pcb_PrimitiveComponent?.getAll) {
    rawComponents = toArray(await optionalCall(() => eda.pcb_PrimitiveComponent.getAll()));
  }

  // Default board thickness nominal 1.6mm or check stackup
  let boardThicknessMm = 1.6;
  if (eda.pcb_Layer?.getAllLayers) {
    const layers = toArray(await optionalCall(() => eda.pcb_Layer.getAllLayers()));
    const thicknessAttr = layers.find((l: any) => l.totalThickness || l.boardThickness) as
      Record<string, any> | undefined;
    if (thicknessAttr) {
      boardThicknessMm = numeric(thicknessAttr.totalThickness ?? thicknessAttr.boardThickness) ?? 1.6;
    }
  }

  const component3dList: Component3dInfo[] = [];
  const missingModelsList: Missing3dModel[] = [];
  const heightViolations: HeightViolation3d[] = [];

  let maxHeightTopMm = 0;
  let maxHeightBottomMm = 0;
  let tallestTop: Component3dInfo | undefined;
  let tallestBottom: Component3dInfo | undefined;

  for (const comp of rawComponents) {
    const primitiveId = String(getProp(comp, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ?? "");
    const designator = String(getProp(comp, "getState_Designator", ["designator", "name", "prefix"]) ?? "");
    const footprint = String(getProp(comp, "getState_Footprint", ["footprint", "package", "packageName"]) ?? "");
    const x = numeric(getProp(comp, "getState_X", ["x", "centerX"])) ?? 0;
    const y = numeric(getProp(comp, "getState_Y", ["y", "centerY"])) ?? 0;
    const rotation = numeric(getProp(comp, "getState_Rotation", ["rotation", "angle"])) ?? 0;
    const rawLayer = getProp(comp, "getState_Layer", ["layer", "layerId"]) ?? 1;

    const layerNum = Number(rawLayer);
    const isBottom = layerNum === 2 || String(rawLayer).toLowerCase().includes("bottom");
    const layerName: "Top" | "Bottom" | "Other" = isBottom
      ? "Bottom"
      : layerNum === 1 || String(rawLayer).toLowerCase().includes("top")
        ? "Top"
        : "Other";

    // Inspect 3D model properties
    const model3d = getProp(comp, "getState_3DModel", ["3dModel", "model3D", "model3d", "model"]);
    let has3DModel = false;
    let modelType: "STEP" | "OBJ" | "WRL" | "NONE" = "NONE";
    let modelTitle: string | undefined;
    let modelUuid: string | undefined;
    let heightMm: number | undefined;
    let elevationMm = 0;
    let heightSource: "native_3d" | "attribute" | "package_heuristic" = "package_heuristic";

    if (model3d && typeof model3d === "object") {
      has3DModel = true;
      modelTitle = model3d.title ?? model3d.name ?? model3d.modelName;
      modelUuid = model3d.uuid ?? model3d.id;
      const typeStr = String(model3d.type ?? model3d.format ?? "").toUpperCase();
      if (typeStr.includes("STEP") || typeStr.includes("STP")) modelType = "STEP";
      else if (typeStr.includes("OBJ")) modelType = "OBJ";
      else if (typeStr.includes("WRL") || typeStr.includes("VRML")) modelType = "WRL";
      else modelType = "STEP";

      if (numeric(model3d.height) !== undefined) {
        heightMm = numeric(model3d.height);
        heightSource = "native_3d";
      }
      if (numeric(model3d.z ?? model3d.elevation ?? model3d.zOffset) !== undefined) {
        elevationMm = numeric(model3d.z ?? model3d.elevation ?? model3d.zOffset)!;
      }
    }

    // Check custom attributes
    if (heightMm === undefined) {
      const attrs = getProp(comp, "getState_Attributes", ["attributes", "properties", "customProperties"]);
      if (attrs && typeof attrs === "object") {
        const hVal = attrs["Height"] ?? attrs["HEIGHT"] ?? attrs["PackageHeight"] ?? attrs["Thickness"];
        if (numeric(hVal) !== undefined) {
          heightMm = numeric(hVal);
          heightSource = "attribute";
        }
      }
    }

    // Fallback heuristic
    if (heightMm === undefined) {
      heightMm = estimateComponentHeight(footprint, designator);
      heightSource = "package_heuristic";
    }

    // Dimensions for 3D bounding box
    const width =
      numeric(getProp(comp, "getState_Width", ["width", "w"])) ??
      (footprint.includes("0805") ? 1.25 : footprint.includes("0603") ? 0.8 : 5.0);
    const length =
      numeric(getProp(comp, "getState_Length", ["length", "l", "height"])) ??
      (footprint.includes("0805") ? 2.0 : footprint.includes("0603") ? 1.6 : 5.0);

    const minX = Math.round((x - width / 2) * 100) / 100;
    const maxX = Math.round((x + width / 2) * 100) / 100;
    const minY = Math.round((y - length / 2) * 100) / 100;
    const maxY = Math.round((y + length / 2) * 100) / 100;

    let minZ: number;
    let maxZ: number;

    if (isBottom) {
      // Bottom layer: hangs downwards below the PCB bottom plane (-boardThicknessMm)
      maxZ = -boardThicknessMm - elevationMm;
      minZ = maxZ - heightMm;
      if (heightMm > maxHeightBottomMm) {
        maxHeightBottomMm = heightMm;
        tallestBottom = {
          primitiveId,
          designator,
          footprint,
          layer: rawLayer,
          layerName,
          x,
          y,
          rotation,
          has3DModel,
          modelType,
          modelTitle,
          modelUuid,
          heightMm,
          elevationMm,
          heightSource,
          boundingBox3d: { minX, maxX, minY, maxY, minZ, maxZ }
        };
      }
    } else {
      // Top layer: extends upwards above 0 (top copper plane)
      minZ = elevationMm;
      maxZ = elevationMm + heightMm;
      if (heightMm > maxHeightTopMm) {
        maxHeightTopMm = heightMm;
        tallestTop = {
          primitiveId,
          designator,
          footprint,
          layer: rawLayer,
          layerName,
          x,
          y,
          rotation,
          has3DModel,
          modelType,
          modelTitle,
          modelUuid,
          heightMm,
          elevationMm,
          heightSource,
          boundingBox3d: { minX, maxX, minY, maxY, minZ, maxZ }
        };
      }
    }

    const compInfo: Component3dInfo = {
      primitiveId,
      designator,
      footprint,
      layer: rawLayer,
      layerName,
      x,
      y,
      rotation,
      has3DModel,
      modelType,
      modelTitle,
      modelUuid,
      heightMm: Math.round(heightMm * 100) / 100,
      elevationMm: Math.round(elevationMm * 100) / 100,
      heightSource,
      boundingBox3d: {
        minX,
        maxX,
        minY,
        maxY,
        minZ: Math.round(minZ * 100) / 100,
        maxZ: Math.round(maxZ * 100) / 100
      }
    };

    component3dList.push(compInfo);

    if (!has3DModel) {
      missingModelsList.push({
        designator,
        footprint,
        criticality: classifyMissingModelCriticality(designator, footprint),
        reason: "No STEP or OBJ 3D model assigned to footprint."
      });
    }

    if (params.maxHeightMm !== undefined && heightMm > params.maxHeightMm) {
      heightViolations.push({
        designator,
        heightMm,
        maxPermittedMm: params.maxHeightMm,
        exceededByMm: Math.round((heightMm - params.maxHeightMm) * 100) / 100,
        layer: layerName
      });
    }
  }

  // 3D Interference detection between components
  const interferencePairs: InterferencePair3d[] = [];
  if (params.checkInterference !== false && component3dList.length > 1) {
    for (let i = 0; i < component3dList.length; i++) {
      const a = component3dList[i];
      for (let j = i + 1; j < component3dList.length; j++) {
        const b = component3dList[j];
        if (a.layerName !== b.layerName) continue; // Different sides don't collide

        const xOverlap = a.boundingBox3d.minX < b.boundingBox3d.maxX && a.boundingBox3d.maxX > b.boundingBox3d.minX;
        const yOverlap = a.boundingBox3d.minY < b.boundingBox3d.maxY && a.boundingBox3d.maxY > b.boundingBox3d.minY;
        const zOverlap = a.boundingBox3d.minZ < b.boundingBox3d.maxZ && a.boundingBox3d.maxZ > b.boundingBox3d.minZ;

        if (xOverlap && yOverlap && zOverlap) {
          const overlapW =
            Math.min(a.boundingBox3d.maxX, b.boundingBox3d.maxX) - Math.max(a.boundingBox3d.minX, b.boundingBox3d.minX);
          const overlapL =
            Math.min(a.boundingBox3d.maxY, b.boundingBox3d.maxY) - Math.max(a.boundingBox3d.minY, b.boundingBox3d.minY);
          const overlapH =
            Math.min(a.boundingBox3d.maxZ, b.boundingBox3d.maxZ) - Math.max(a.boundingBox3d.minZ, b.boundingBox3d.minZ);
          const vol = Math.round(overlapW * overlapL * overlapH * 100) / 100;

          interferencePairs.push({
            componentA: a.designator,
            componentB: b.designator,
            overlapVolumeMm3: vol > 0 ? vol : undefined,
            details: `3D bounding boxes collide on ${a.layerName} layer (overlap: ${overlapW.toFixed(2)}x${overlapL.toFixed(2)}x${overlapH.toFixed(2)} mm).`
          });
        }
      }
    }
  }

  const totalEnvelopeHeightMm = Math.round((boardThicknessMm + maxHeightTopMm + maxHeightBottomMm) * 100) / 100;

  const envelope: Board3dEnvelope = {
    boardThicknessMm,
    maxHeightTopMm: Math.round(maxHeightTopMm * 100) / 100,
    maxHeightBottomMm: Math.round(maxHeightBottomMm * 100) / 100,
    totalEnvelopeHeightMm,
    tallestComponentTop: tallestTop
      ? {
          designator: tallestTop.designator,
          heightMm: tallestTop.heightMm,
          footprint: tallestTop.footprint,
          x: tallestTop.x,
          y: tallestTop.y
        }
      : undefined,
    tallestComponentBottom: tallestBottom
      ? {
          designator: tallestBottom.designator,
          heightMm: tallestBottom.heightMm,
          footprint: tallestBottom.footprint,
          x: tallestBottom.x,
          y: tallestBottom.y
        }
      : undefined
  };

  if (params.enclosureHeightMm !== undefined) {
    envelope.enclosureClearanceMm = Math.round((params.enclosureHeightMm - totalEnvelopeHeightMm) * 100) / 100;
    envelope.enclosureStatus =
      envelope.enclosureClearanceMm < 0 ? "EXCEEDED" : envelope.enclosureClearanceMm < 1.0 ? "TIGHT" : "FIT";
  }

  // Detect native 3D API availability
  const native3dAvailable = Boolean(
    (eda.pcb_Document as any)?.get3DView ||
    (eda.pcb_Document as any)?.export3D ||
    (eda.dmt_EditorControl as any)?.get3DCanvas
  );

  return {
    target: currentTarget,
    envelope,
    totalComponents: component3dList.length,
    componentsWith3dModel: component3dList.filter((c) => c.has3DModel).length,
    componentsMissing3dModel: missingModelsList.length,
    missing3dModels: missingModelsList,
    interferenceCollisions: interferencePairs,
    heightViolations,
    native3dAvailable,
    components: component3dList
  };
}

/**
 * Retrieves 3D view angles, rendering settings and export options
 */
export async function fetchPcb3dView(
  api: () => EasyEdaApi,
  params: Pcb3dViewParams = {}
): Promise<Record<string, unknown>> {
  const eda = api();
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const currentTarget = extractDocumentIdentity(documentInfo, undefined, "native_api");

  if (params.target) {
    assertDocumentTargetMatch(params.target, currentTarget);
  }

  const angle = params.viewAngle ?? "isometric_ne";

  const cameraAngles: Record<string, { pitch: number; yaw: number; roll: number; description: string }> = {
    top: { pitch: 90, yaw: 0, roll: 0, description: "Direct top-down vertical perspective" },
    bottom: { pitch: -90, yaw: 0, roll: 0, description: "Direct bottom-up underside perspective" },
    isometric_ne: { pitch: 45, yaw: 45, roll: 0, description: "Isometric view from North-East angle" },
    isometric_sw: { pitch: 45, yaw: 225, roll: 0, description: "Isometric view from South-West angle" },
    front: { pitch: 0, yaw: 0, roll: 0, description: "Front profile edge-on elevation" },
    side: { pitch: 0, yaw: 90, roll: 0, description: "Right side profile edge-on elevation" }
  };

  const selectedCamera = cameraAngles[angle] ?? cameraAngles["isometric_ne"];

  return {
    target: currentTarget,
    viewAngle: angle,
    camera: {
      ...selectedCamera,
      distanceMm: 120,
      targetPoint: { x: 0, y: 0, z: 0 }
    },
    renderingLayers: {
      topSilkscreen: true,
      topSoldermask: true,
      topCopper: true,
      coreSubstrateFr4: true,
      bottomCopper: true,
      bottomSoldermask: true,
      bottomSilkscreen: true,
      component3dModels: true
    },
    exportOptions: {
      stepSupported: Boolean((eda.pcb_Document as any)?.exportStep || (eda.pcb_ManufactureData as any)?.getStepFile),
      objSupported: Boolean((eda.pcb_Document as any)?.exportObj),
      vrmlSupported: false
    },
    quickActionNotice:
      "In EasyEDA Pro desktop or browser editor, press Alt+3 or navigate to View -> 3D View to open the real-time interactive 3D WebGL renderer."
  };
}
