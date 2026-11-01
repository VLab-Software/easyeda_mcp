import { apiError, numeric, optionalCall, toArray } from "../helpers.js";
import { assertDocumentTargetMatch, extractDocumentIdentity } from "../identity.js";
import type { EasyEdaApi } from "../types.js";

export interface DeviceInfo {
  uuid: string;
  name: string;
  description?: string;
  lcscCode?: string;
  manufacturer?: string;
  mfrPartNumber?: string;
  datasheetUrl?: string;
  package?: string;
  isJlcBasic?: boolean;
  inStock?: boolean;
  stockCount?: number;
  price?: number;
}

export interface SymbolPinInfo {
  number: string;
  name: string;
  electricalType?: string;
  type?: string;
  orientation?: number;
  x?: number;
  y?: number;
}

export interface FootprintPadInfo {
  number: string;
  name?: string;
  shape?: string;
  width?: number;
  height?: number;
  holeDiameter?: number;
  x?: number;
  y?: number;
  layer?: number | string;
  padType?: "SMD" | "TH" | "OTHER";
}

export interface PinPadMappingItem {
  pinNumber: string;
  pinName: string;
  padNumber: string;
  padName?: string;
  matched: boolean;
  notes?: string;
}

export interface DeviceDetailsResult {
  device: DeviceInfo;
  symbol?: {
    uuid?: string;
    name?: string;
    pinsCount: number;
    pins: SymbolPinInfo[];
  };
  footprint?: {
    uuid?: string;
    name?: string;
    padsCount: number;
    dimensionsMm?: { width: number; length: number };
    pads: FootprintPadInfo[];
  };
  pinPadMapping: PinPadMappingItem[];
  mappingIntegrity: {
    complete: boolean;
    unmappedPins: string[];
    unmappedPads: string[];
    pinCount: number;
    padCount: number;
    issues: string[];
  };
  raw?: unknown;
}

export interface DeviceComparisonResult {
  deviceA: DeviceInfo;
  deviceB: DeviceInfo;
  summary: {
    compatible: boolean;
    pinoutMatch: "identical" | "compatible" | "incompatible";
    footprintMatch: "identical" | "compatible" | "incompatible";
    compatibilityScorePercent: number;
    dropInReplacement: boolean;
  };
  comparison: {
    manufacturer: { a?: string; b?: string; match: boolean };
    package: { a?: string; b?: string; match: boolean };
    pinCount: { a: number; b: number; match: boolean };
    padCount: { a: number; b: number; match: boolean };
    availability: {
      aInStock?: boolean;
      bInStock?: boolean;
      aJlcBasic?: boolean;
      bJlcBasic?: boolean;
      recommendedSupply: "deviceA" | "deviceB" | "either" | "neither";
    };
  };
  pinoutDiff: Array<{
    pinNumber: string;
    aPinName?: string;
    bPinName?: string;
    aType?: string;
    bType?: string;
    match: boolean;
    severity: "ok" | "warning" | "incompatible";
    difference?: string;
  }>;
  recommendation: string;
}

export interface PinPadVerificationItem {
  designator: string;
  componentTitle?: string;
  footprintName?: string;
  symbolPinsCount: number;
  footprintPadsCount: number;
  complete: boolean;
  unmappedPins: string[];
  unmappedPads: string[];
  duplicatePins?: string[];
  duplicatePads?: string[];
  severity: "ok" | "warning" | "error";
  suggestion?: string;
}

export interface PinPadVerificationResult {
  target: Record<string, unknown>;
  totalComponentsChecked: number;
  perfectMatchesCount: number;
  mismatchesCount: number;
  verified: boolean;
  components: PinPadVerificationItem[];
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
 * Normalizes pin names for comparison (strips non-alphanumeric, uppercase, checks aliases)
 */
export function normalizePinName(name: string): string {
  if (!name) return "";
  const cleaned = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  // Standard power & ground aliases
  if (cleaned === "GND" || cleaned === "VSS" || cleaned === "GROUND" || cleaned === "0V") return "GND";
  if (cleaned === "VCC" || cleaned === "VDD" || cleaned === "VIN" || cleaned === "3V3" || cleaned === "5V")
    return "VCC";
  if (cleaned === "RESET" || cleaned === "RST" || cleaned === "NRST") return "RESET";
  if (cleaned === "NC" || cleaned === "DNC" || cleaned === "NOCONNECT") return "NC";
  return cleaned;
}

/**
 * Resolves a device from UUID, LCSC code, or active schematic/PCB designator
 */
export async function resolveDeviceOrComponent(
  api: () => EasyEdaApi,
  queryOrUuidOrDesignator: string
): Promise<{
  device?: DeviceInfo;
  pins: SymbolPinInfo[];
  pads: FootprintPadInfo[];
  pinMap?: Record<string, string>;
  raw?: unknown;
}> {
  const eda = api();
  const q = queryOrUuidOrDesignator.trim();

  // 1. Try finding in active schematic components by designator
  if (eda.sch_PrimitiveComponent?.getAll) {
    const schComps = toArray(await optionalCall(() => eda.sch_PrimitiveComponent.getAll()));
    const found = schComps.find((c: any) => {
      const des = String(getProp(c, "getState_Designator", ["designator", "name", "prefix"]) ?? "").toUpperCase();
      return des === q.toUpperCase();
    });

    if (found) {
      const designator = String(getProp(found, "getState_Designator", ["designator", "name", "prefix"]) ?? "");
      const title = String(getProp(found, "getState_Title", ["title", "value", "comment"]) ?? designator);
      const footprint = String(getProp(found, "getState_Footprint", ["footprint", "package"]) ?? "");
      const uuid = String(getProp(found, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ?? "");
      const lcsc = String(getProp(found, "getState_LcscCode", ["lcscCode", "code", "partNumber"]) ?? "");
      const mfr = String(getProp(found, "getState_Manufacturer", ["manufacturer", "mfr"]) ?? "");

      // Extract symbol pins
      const rawPins = toArray(getProp(found, "getState_Pins", ["pins", "pinList"]) ?? []);
      const pins: SymbolPinInfo[] = rawPins.map((p: any) => ({
        number: String(getProp(p, "getState_PinNumber", ["number", "pinNumber", "name"]) ?? ""),
        name: String(getProp(p, "getState_PinName", ["name", "pinName", "label"]) ?? ""),
        electricalType: String(getProp(p, "getState_PinType", ["type", "electricalType"]) ?? "passive")
      }));

      // Cross-reference with PCB footprint pads if available
      let pads: FootprintPadInfo[] = [];
      if (eda.pcb_PrimitiveComponent?.getAll) {
        const pcbComps = toArray(await optionalCall(() => eda.pcb_PrimitiveComponent.getAll()));
        const pcbComp = pcbComps.find(
          (c: any) =>
            String(getProp(c, "getState_Designator", ["designator", "name", "prefix"]) ?? "").toUpperCase() ===
            q.toUpperCase()
        );
        if (pcbComp) {
          const rawPads = toArray(getProp(pcbComp, "getState_Pads", ["pads", "padList"]) ?? []);
          pads = rawPads.map((pad: any) => ({
            number: String(getProp(pad, "getState_PadNumber", ["padNumber", "number", "name"]) ?? ""),
            shape: String(getProp(pad, "getState_Shape", ["shape", "padShape"]) ?? "RECTANGLE"),
            width: numeric(getProp(pad, "getState_Width", ["width", "w"])),
            height: numeric(getProp(pad, "getState_Height", ["height", "h"])),
            holeDiameter: numeric(getProp(pad, "getState_HoleDiameter", ["holeDiameter", "drill"])),
            x: numeric(getProp(pad, "getState_X", ["x", "centerX"])),
            y: numeric(getProp(pad, "getState_Y", ["y", "centerY"])),
            layer: getProp(pad, "getState_Layer", ["layer"]) ?? 1,
            padType: numeric(getProp(pad, "getState_HoleDiameter", ["holeDiameter", "drill"])) ? "TH" : "SMD"
          }));
        }
      }

      return {
        device: {
          uuid,
          name: title,
          package: footprint,
          lcscCode: lcsc || undefined,
          manufacturer: mfr || undefined
        },
        pins,
        pads,
        raw: found
      };
    }
  }

  // 2. Try direct device lookup in library by UUID
  if (eda.lib_Device?.get || eda.lib_Device?.getDevice) {
    const getFn = eda.lib_Device.get ?? eda.lib_Device.getDevice;
    const rawDev = await optionalCall(() => getFn(q));
    if (rawDev && typeof rawDev === "object") {
      const dev = rawDev as Record<string, any>;
      const pins = toArray(dev.pins ?? dev.symbol?.pins ?? []).map((p: any) => ({
        number: String(p.number ?? p.pinNumber ?? ""),
        name: String(p.name ?? p.pinName ?? ""),
        electricalType: p.type ?? p.electricalType
      }));
      const pads = toArray(dev.pads ?? dev.footprint?.pads ?? []).map((p: any) => ({
        number: String(p.number ?? p.padNumber ?? ""),
        shape: p.shape,
        width: numeric(p.width),
        height: numeric(p.height),
        holeDiameter: numeric(p.holeDiameter ?? p.drill),
        padType: (numeric(p.holeDiameter ?? p.drill) ? "TH" : "SMD") as "SMD" | "TH"
      }));

      return {
        device: {
          uuid: String(dev.uuid ?? dev.id ?? q),
          name: String(dev.name ?? dev.title ?? "Unknown Device"),
          description: dev.description ?? dev.comment,
          lcscCode: dev.lcscCode ?? dev.code,
          manufacturer: dev.manufacturer ?? dev.mfr,
          mfrPartNumber: dev.mfrPartNumber ?? dev.partNumber,
          datasheetUrl: dev.datasheet ?? dev.datasheetUrl,
          package: dev.package ?? dev.footprintName,
          isJlcBasic: Boolean(dev.isJlcBasic ?? dev.basicPart),
          inStock: Boolean(dev.inStock ?? dev.stock)
        },
        pins,
        pads,
        pinMap: dev.pinMap ?? dev.pinPadMap,
        raw: dev
      };
    }
  }

  // 3. Try library search by query / LCSC code
  if (eda.lib_Device?.search || eda.lib_Search?.search) {
    const searchFn = eda.lib_Device?.search ?? eda.lib_Search?.search;
    const rawList = toArray(await optionalCall(() => searchFn(q)));
    if (rawList.length > 0) {
      const dev = rawList[0] as Record<string, any>;
      const pins = toArray(dev.pins ?? []).map((p: any) => ({
        number: String(p.number ?? p.pinNumber ?? ""),
        name: String(p.name ?? p.pinName ?? "")
      }));
      const pads = toArray(dev.pads ?? []).map((p: any) => ({
        number: String(p.number ?? p.padNumber ?? "")
      }));

      return {
        device: {
          uuid: String(dev.uuid ?? dev.id ?? ""),
          name: String(dev.name ?? dev.title ?? q),
          description: dev.description ?? dev.comment,
          lcscCode: dev.lcscCode ?? dev.code ?? dev.orderCode,
          manufacturer: dev.manufacturer ?? dev.mfr,
          package: dev.package ?? dev.footprint ?? dev.packageName,
          isJlcBasic: Boolean(dev.isJlcBasic ?? dev.basicPart),
          inStock: Boolean(dev.inStock ?? dev.stock)
        },
        pins,
        pads,
        raw: dev
      };
    }
  }

  // Fallback: mock structure from query
  return {
    device: {
      uuid: q,
      name: q,
      description: `Device resolved from query '${q}'`
    },
    pins: [],
    pads: []
  };
}

/**
 * Fetches comprehensive device, symbol, footprint, and pin-to-pad correspondence details
 */
export async function fetchDeviceDetails(
  api: () => EasyEdaApi,
  params: {
    deviceUuid?: string;
    designator?: string;
    lcscCode?: string;
    includePinPadMap?: boolean;
    includeRaw?: boolean;
    target?: Record<string, unknown>;
    timeoutMs?: number;
  }
): Promise<DeviceDetailsResult> {
  const query = params.designator ?? params.deviceUuid ?? params.lcscCode;
  if (!query) {
    throw apiError("missing_parameter", "One of 'designator', 'deviceUuid', or 'lcscCode' is required.");
  }

  const { device, pins, pads, pinMap, raw } = await resolveDeviceOrComponent(api, query);

  if (!device) {
    throw apiError("device_not_found", `Device or component '${query}' could not be resolved.`);
  }

  // Construct pin-to-pad map
  const pinPadMapping: PinPadMappingItem[] = [];
  const padMap = new Map<string, FootprintPadInfo>();
  for (const pad of pads) {
    padMap.set(pad.number, pad);
  }

  const unmappedPins: string[] = [];
  const mappedPadNumbers = new Set<string>();

  for (const pin of pins) {
    // If device provides explicit pinMap, use it; otherwise match pin.number === pad.number
    const targetPadNum = pinMap?.[pin.number] ?? pin.number;
    const pad = padMap.get(targetPadNum);

    if (pad) {
      mappedPadNumbers.add(targetPadNum);
      pinPadMapping.push({
        pinNumber: pin.number,
        pinName: pin.name,
        padNumber: pad.number,
        padName: pad.name,
        matched: true
      });
    } else {
      unmappedPins.push(pin.number);
      pinPadMapping.push({
        pinNumber: pin.number,
        pinName: pin.name,
        padNumber: targetPadNum,
        matched: false,
        notes: `No matching pad found for pin ${pin.number} (${pin.name}).`
      });
    }
  }

  const unmappedPads: string[] = [];
  for (const pad of pads) {
    if (!mappedPadNumbers.has(pad.number)) {
      unmappedPads.push(pad.number);
    }
  }

  const issues: string[] = [];
  if (unmappedPins.length > 0) {
    issues.push(`${unmappedPins.length} symbol pins have no corresponding footprint pad (${unmappedPins.join(", ")}).`);
  }
  if (unmappedPads.length > 0) {
    issues.push(`${unmappedPads.length} footprint pads have no corresponding symbol pin (${unmappedPads.join(", ")}).`);
  }

  const complete = unmappedPins.length === 0 && unmappedPads.length === 0 && pins.length > 0;

  return {
    device,
    symbol: {
      uuid: (device as any).symbolUuid,
      name: device.name,
      pinsCount: pins.length,
      pins
    },
    footprint: {
      uuid: (device as any).footprintUuid,
      name: device.package,
      padsCount: pads.length,
      pads
    },
    pinPadMapping: params.includePinPadMap !== false ? pinPadMapping : [],
    mappingIntegrity: {
      complete,
      unmappedPins,
      unmappedPads,
      pinCount: pins.length,
      padCount: pads.length,
      issues
    },
    raw: params.includeRaw ? raw : undefined
  };
}

/**
 * Compares two components/devices for drop-in replacement and pinout compatibility
 */
export async function compareDevices(
  api: () => EasyEdaApi,
  params: {
    deviceA: string;
    deviceB: string;
    strictPinout?: boolean;
    target?: Record<string, unknown>;
    timeoutMs?: number;
  }
): Promise<DeviceComparisonResult> {
  if (!params.deviceA || !params.deviceB) {
    throw apiError("missing_parameter", "'deviceA' and 'deviceB' parameters are required for comparison.");
  }

  const [resA, resB] = await Promise.all([
    resolveDeviceOrComponent(api, params.deviceA),
    resolveDeviceOrComponent(api, params.deviceB)
  ]);

  if (!resA.device || !resB.device) {
    throw apiError("device_not_found", "Failed to resolve one or both devices for comparison.");
  }

  const devA = resA.device;
  const devB = resB.device;

  // Comparison metrics
  const mfrMatch = Boolean(
    devA.manufacturer && devB.manufacturer && devA.manufacturer.toUpperCase() === devB.manufacturer.toUpperCase()
  );
  const pkgMatch = Boolean(devA.package && devB.package && devA.package.toUpperCase() === devB.package.toUpperCase());
  const pinCountMatch = resA.pins.length === resB.pins.length;
  const padCountMatch = resA.pads.length === resB.pads.length;

  // Pinout comparison
  const pinoutDiff: DeviceComparisonResult["pinoutDiff"] = [];
  const mapB = new Map<string, SymbolPinInfo>();
  for (const p of resB.pins) {
    mapB.set(p.number, p);
  }

  let matchedPins = 0;
  let incompatiblePins = 0;

  for (const pinA of resA.pins) {
    const pinB = mapB.get(pinA.number);
    if (!pinB) {
      incompatiblePins++;
      pinoutDiff.push({
        pinNumber: pinA.number,
        aPinName: pinA.name,
        aType: pinA.electricalType,
        match: false,
        severity: "incompatible",
        difference: `Pin ${pinA.number} does not exist in Device B.`
      });
      continue;
    }

    const normA = normalizePinName(pinA.name);
    const normB = normalizePinName(pinB.name);
    const namesMatch = normA === normB || normA.includes(normB) || normB.includes(normA);
    const typesMatch = !pinA.electricalType || !pinB.electricalType || pinA.electricalType === pinB.electricalType;

    if (namesMatch && typesMatch) {
      matchedPins++;
      pinoutDiff.push({
        pinNumber: pinA.number,
        aPinName: pinA.name,
        bPinName: pinB.name,
        aType: pinA.electricalType,
        bType: pinB.electricalType,
        match: true,
        severity: "ok"
      });
    } else if (namesMatch) {
      matchedPins++;
      pinoutDiff.push({
        pinNumber: pinA.number,
        aPinName: pinA.name,
        bPinName: pinB.name,
        aType: pinA.electricalType,
        bType: pinB.electricalType,
        match: true,
        severity: "warning",
        difference: `Electrical type difference: '${pinA.electricalType}' vs '${pinB.electricalType}'.`
      });
    } else {
      incompatiblePins++;
      pinoutDiff.push({
        pinNumber: pinA.number,
        aPinName: pinA.name,
        bPinName: pinB.name,
        aType: pinA.electricalType,
        bType: pinB.electricalType,
        match: false,
        severity: "incompatible",
        difference: `Name mismatch: '${pinA.name}' vs '${pinB.name}'.`
      });
    }
  }

  const totalPins = Math.max(resA.pins.length, resB.pins.length);
  const pinoutScore = totalPins > 0 ? (matchedPins / totalPins) * 100 : 100;

  const pinoutMatch: "identical" | "compatible" | "incompatible" =
    incompatiblePins === 0 && matchedPins === totalPins
      ? "identical"
      : incompatiblePins === 0
        ? "compatible"
        : "incompatible";

  const footprintMatch: "identical" | "compatible" | "incompatible" =
    pkgMatch && padCountMatch ? "identical" : pkgMatch || padCountMatch ? "compatible" : "incompatible";

  const dropInReplacement = pinoutMatch === "identical" && footprintMatch === "identical";
  const compatible = pinoutMatch !== "incompatible" && footprintMatch !== "incompatible";

  // Score computation
  let score = 0;
  if (pkgMatch) score += 30;
  if (pinCountMatch) score += 20;
  if (padCountMatch) score += 20;
  score += Math.round((pinoutScore / 100) * 30);

  // Supply recommendation
  let recommendedSupply: "deviceA" | "deviceB" | "either" | "neither" = "either";
  if (devB.isJlcBasic && !devA.isJlcBasic) recommendedSupply = "deviceB";
  else if (devA.isJlcBasic && !devB.isJlcBasic) recommendedSupply = "deviceA";
  else if (devB.inStock && !devA.inStock) recommendedSupply = "deviceB";
  else if (devA.inStock && !devB.inStock) recommendedSupply = "deviceA";

  let recommendation: string;
  if (dropInReplacement) {
    recommendation = `Device '${devB.name}' is an exact drop-in replacement for '${devA.name}' with identical pinout and footprint.`;
  } else if (compatible) {
    recommendation = `Device '${devB.name}' is functionally compatible with '${devA.name}', but verify minor differences in naming or pad geometry.`;
  } else {
    recommendation = `Device '${devB.name}' is NOT a direct replacement for '${devA.name}' due to pinout or footprint incompatibilities (${incompatiblePins} pin conflicts).`;
  }

  return {
    deviceA: devA,
    deviceB: devB,
    summary: {
      compatible,
      pinoutMatch,
      footprintMatch,
      compatibilityScorePercent: score,
      dropInReplacement
    },
    comparison: {
      manufacturer: { a: devA.manufacturer, b: devB.manufacturer, match: mfrMatch },
      package: { a: devA.package, b: devB.package, match: pkgMatch },
      pinCount: { a: resA.pins.length, b: resB.pins.length, match: pinCountMatch },
      padCount: { a: resA.pads.length, b: resB.pads.length, match: padCountMatch },
      availability: {
        aInStock: devA.inStock,
        bInStock: devB.inStock,
        aJlcBasic: devA.isJlcBasic,
        bJlcBasic: devB.isJlcBasic,
        recommendedSupply
      }
    },
    pinoutDiff,
    recommendation
  };
}

/**
 * Validates pin-to-pad correspondence across all components in the active document
 */
export async function verifyPinPadMapping(
  api: () => EasyEdaApi,
  params: {
    designator?: string;
    deviceUuid?: string;
    target?: Record<string, unknown>;
    timeoutMs?: number;
  } = {}
): Promise<PinPadVerificationResult> {
  const eda = api();
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const currentTarget = extractDocumentIdentity(documentInfo, undefined, "native_api");

  if (params.target) {
    assertDocumentTargetMatch(params.target, currentTarget);
  }

  const componentsToCheck: string[] = [];

  if (params.designator) {
    componentsToCheck.push(params.designator);
  } else {
    // Gather all components from active schematic or PCB
    if (eda.sch_PrimitiveComponent?.getAll) {
      const schComps = toArray(await optionalCall(() => eda.sch_PrimitiveComponent.getAll()));
      for (const c of schComps) {
        const des = getProp(c, "getState_Designator", ["designator", "name", "prefix"]);
        if (des) componentsToCheck.push(String(des));
      }
    } else if (eda.pcb_PrimitiveComponent?.getAll) {
      const pcbComps = toArray(await optionalCall(() => eda.pcb_PrimitiveComponent.getAll()));
      for (const c of pcbComps) {
        const des = getProp(c, "getState_Designator", ["designator", "name", "prefix"]);
        if (des) componentsToCheck.push(String(des));
      }
    }
  }

  const results: PinPadVerificationItem[] = [];
  let perfectMatchesCount = 0;
  let mismatchesCount = 0;

  for (const des of componentsToCheck) {
    const details = await fetchDeviceDetails(api, { designator: des, includePinPadMap: true });
    const { complete, unmappedPins, unmappedPads, pinCount, padCount, issues } = details.mappingIntegrity;

    let severity: "ok" | "warning" | "error" = "ok";
    let suggestion: string | undefined;

    if (!complete) {
      mismatchesCount++;
      if (unmappedPins.length > 0 && unmappedPads.length > 0) {
        severity = "error";
        suggestion =
          "Mismatch between schematic symbol pinout and PCB footprint. Check component device library definition.";
      } else if (unmappedPads.length > 0) {
        severity = "warning";
        suggestion =
          "Footprint has extra pads (e.g. thermal ground pad or shield tabs). Consider mapping them to GND or NC in schematic.";
      } else {
        severity = "error";
        suggestion = "Schematic symbol has pins with no corresponding physical PCB pads.";
      }
    } else {
      perfectMatchesCount++;
    }

    results.push({
      designator: des,
      componentTitle: details.device.name,
      footprintName: details.device.package,
      symbolPinsCount: pinCount,
      footprintPadsCount: padCount,
      complete,
      unmappedPins,
      unmappedPads,
      severity,
      suggestion: suggestion ?? (issues.length > 0 ? issues.join("; ") : undefined)
    });
  }

  return {
    target: currentTarget as Record<string, unknown>,
    totalComponentsChecked: results.length,
    perfectMatchesCount,
    mismatchesCount,
    verified: mismatchesCount === 0,
    components: results
  };
}
