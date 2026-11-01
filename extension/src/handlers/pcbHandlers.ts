import { apiError, ensureApi, numeric, optionalCall, sanitize, simplifyPrimitive, toArray } from "../helpers.js";
import { assertDocumentTargetMatch, extractDocumentIdentity } from "../identity.js";
import type { EasyEdaApi, RpcHandler } from "../types.js";

function getProp(obj: any, getterName: string, propNames: string[]): any {
  if (!obj || typeof obj !== "object") return undefined;
  if (typeof obj[getterName] === "function") {
    try {
      const val = obj[getterName]();
      if (val !== undefined && val !== null) return val;
    } catch {
      // ignore getter error
    }
  }
  for (const prop of propNames) {
    if (obj[prop] !== undefined && obj[prop] !== null) {
      return obj[prop];
    }
  }
  return undefined;
}

export function normalizePcbPad(pad: any, parentComp?: any, includeRaw = false): Record<string, unknown> {
  const primitiveId = String(getProp(pad, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ?? "");
  const padNumber = getProp(pad, "getState_PadNumber", ["padNumber", "number", "name", "pinNumber"]);
  const net = getProp(pad, "getState_Net", ["net", "netName"]);
  const x = numeric(getProp(pad, "getState_X", ["x", "centerX"]));
  const y = numeric(getProp(pad, "getState_Y", ["y", "centerY"]));
  const layer = getProp(pad, "getState_Layer", ["layer", "layerId"]);
  const width = numeric(getProp(pad, "getState_Width", ["width"]));
  const height = numeric(getProp(pad, "getState_Height", ["height"]));
  const holeDiameter = numeric(getProp(pad, "getState_HoleDiameter", ["holeDiameter", "hole", "diameter"]));
  const shape = getProp(pad, "getState_Shape", ["shape", "padShape"]);
  const rotation = numeric(getProp(pad, "getState_Rotation", ["rotation", "angle"])) ?? 0;
  const locked = Boolean(getProp(pad, "getState_PrimitiveLock", ["locked", "primitiveLock"]));

  const layerStr = String(layer ?? "").toLowerCase();
  const isThroughHole =
    (holeDiameter !== undefined && holeDiameter > 0) ||
    layerStr.includes("multi") ||
    layer === 11 ||
    layer === "MultiLayer";

  let side: "top" | "bottom" | "multi" | "unknown" = "unknown";
  if (isThroughHole) {
    side = "multi";
  } else if (layerStr.includes("top") || layer === 1 || layer === "TopLayer") {
    side = "top";
  } else if (layerStr.includes("bot") || layer === 2 || layer === "BottomLayer") {
    side = "bottom";
  }

  const compDesignator = parentComp
    ? getProp(parentComp, "getState_Designator", ["designator", "name", "displayName"])
    : undefined;
  const compId = parentComp
    ? getProp(parentComp, "getState_PrimitiveId", ["primitiveId", "id", "uuid"])
    : getProp(pad, "getState_ParentComponentPrimitiveId", ["parentComponentPrimitiveId", "componentId"]);

  return {
    primitiveId: primitiveId || undefined,
    padNumber: padNumber ? String(padNumber) : undefined,
    net: net ? String(net) : undefined,
    x,
    y,
    layer,
    side,
    shape: shape ? String(shape) : undefined,
    width,
    height,
    holeDiameter,
    rotation,
    isThroughHole,
    componentDesignator: compDesignator ? String(compDesignator) : undefined,
    componentPrimitiveId: compId ? String(compId) : undefined,
    locked,
    ...(includeRaw ? { raw: sanitize(pad) } : {})
  };
}

async function getComponentPads(comp: any, api: () => EasyEdaApi): Promise<unknown[]> {
  if (typeof comp.getAllPins === "function") {
    try {
      const pins = await comp.getAllPins();
      if (Array.isArray(pins)) return pins;
    } catch {
      // fallback
    }
  }
  const eda = api();
  const compId = getProp(comp, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]);
  if (compId && eda.pcb_PrimitiveComponent?.getAllPinsByPrimitiveId) {
    try {
      const pins = await eda.pcb_PrimitiveComponent.getAllPinsByPrimitiveId(compId);
      if (Array.isArray(pins)) return pins;
    } catch {
      // fallback
    }
  }
  return toArray(comp.pins ?? comp.pads ?? []);
}

export async function getPcbComponents(api: () => EasyEdaApi): Promise<unknown[]> {
  ensureApi("pcb_PrimitiveComponent", "getAll", api());
  return toArray(await api().pcb_PrimitiveComponent.getAll());
}

export async function getPcbNetNames(api: () => EasyEdaApi): Promise<unknown[]> {
  const eda = api();
  ensureApi("pcb_Net", "getAllNetsName", eda);
  if (eda.pcb_Net.getAllNetsName) {
    return toArray(await eda.pcb_Net.getAllNetsName());
  }
  return toArray(await eda.pcb_Net.getAllNetName());
}

export function createPcbHandlers(api: () => EasyEdaApi): Record<string, RpcHandler> {
  async function runDrc(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    if (
      documentInfo &&
      ![3, "pcb"].includes(documentInfo?.documentType ?? documentInfo?.doctype ?? documentInfo?.type)
    ) {
      throw apiError("wrong_document", "Open a PCB document before running DRC checks.");
    }
    ensureApi("pcb_Drc", "check", eda);
    const strict = params.strict !== false;
    const startedAt = Date.now();
    const rawResult = await eda.pcb_Drc.check(strict);
    const durationMs = Date.now() - startedAt;

    let errors: unknown[] = [];
    let passed = true;
    let errorsCount = 0;
    let warningsCount = 0;

    if (Array.isArray(rawResult)) {
      errors = rawResult;
      errorsCount = rawResult.length;
      passed = errorsCount === 0;
    } else if (rawResult && typeof rawResult === "object") {
      const rawObj = rawResult as Record<string, any>;
      if (Array.isArray(rawObj.errors)) {
        errors = rawObj.errors;
        errorsCount = rawObj.errors.length;
      }
      if (Array.isArray(rawObj.warnings)) {
        warningsCount = rawObj.warnings.length;
      }
      if (typeof rawObj.passed === "boolean") {
        passed = rawObj.passed;
      } else if (typeof rawObj.success === "boolean") {
        passed = rawObj.success;
      } else {
        passed = errorsCount === 0;
      }
    } else if (typeof rawResult === "boolean") {
      passed = rawResult;
      errorsCount = rawResult ? 0 : 1;
    }

    return {
      target: extractDocumentIdentity(documentInfo),
      passed,
      errorsCount,
      warningsCount,
      errors: sanitize(errors),
      durationMs,
      rawResult: sanitize(rawResult)
    };
  }

  async function getPcbLayers(): Promise<Record<string, unknown>> {
    const eda = api();
    ensureApi("pcb_Layer", "getAllLayers", eda);
    const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const rawLayers = toArray(await eda.pcb_Layer.getAllLayers());
    const layers = rawLayers.map((layer: any) => {
      if (!layer || typeof layer !== "object") return layer;
      const typeStr = String(layer.type ?? layer.layerType ?? "").toLowerCase();
      const isSignal = Boolean(
        layer.isSignal ??
        layer.isCopper ??
        (typeStr === "signal" || typeStr === "copper" || layer.type === 1 || layer.type === 2)
      );
      return {
        id: layer.id ?? layer.layerId ?? layer.layerNo,
        name: layer.name ?? layer.layerName,
        type: layer.type ?? layer.layerType,
        color: layer.color,
        visible: layer.visible ?? layer.isVisible,
        isSignal,
        copperThickness: layer.copperThickness ?? layer.thickness
      };
    });
    const copperLayers = layers.filter(
      (l: any) => l && (l.isSignal || ["signal", "copper", "plane"].includes(String(l.type).toLowerCase()))
    );
    return {
      target: extractDocumentIdentity(documentInfo),
      layerCount: layers.length,
      copperLayerCount: copperLayers.length,
      layers: sanitize(layers),
      rawLayers: sanitize(rawLayers)
    };
  }

  async function getRoutingStatus(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    const netNames = await getPcbNetNames(api);
    const names = netNames.map((n) => String(n)).filter(Boolean);
    const includeLengths = Boolean(params.includeNetLengths);
    let netLengths: Record<string, number> | undefined;

    if (includeLengths && eda.pcb_Net?.getNetLength) {
      netLengths = {};
      for (const name of names) {
        const len = await optionalCall(() => eda.pcb_Net.getNetLength(name));
        if (typeof len === "number") {
          netLengths[name] = len;
        }
      }
    }

    let allNetsDetails: any[] = [];
    if (eda.pcb_Net?.getAllNets) {
      allNetsDetails = toArray(await optionalCall(() => eda.pcb_Net.getAllNets()));
    }

    const unroutedNetNames: string[] = [];
    let routedCount = 0;

    if (allNetsDetails.length > 0) {
      for (const net of allNetsDetails) {
        const name = String(net.name ?? net.netName ?? "");
        const isRouted = Boolean(
          net.isRouted === true ||
          (net.unroutedCount === 0 && (net.trackCount > 0 || net.routedCount > 0)) ||
          (netLengths && (netLengths[name] ?? 0) > 0)
        );
        if (isRouted) {
          routedCount++;
        } else if (name) {
          unroutedNetNames.push(name);
        }
      }
    } else if (netLengths) {
      for (const [name, len] of Object.entries(netLengths)) {
        if (len > 0) {
          routedCount++;
        } else {
          unroutedNetNames.push(name);
        }
      }
    } else {
      routedCount = names.length;
    }

    const totalNets = names.length;
    const completionPercent = totalNets > 0 ? Math.round((routedCount / totalNets) * 1000) / 10 : 100;

    const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    return {
      target: extractDocumentIdentity(documentInfo),
      totalNets,
      routedNets: routedCount,
      unroutedNets: Math.max(0, totalNets - routedCount),
      completionPercent,
      unroutedNetNames: sanitize(unroutedNetNames),
      netNames: sanitize(names),
      ...(netLengths ? { netLengths } : {})
    };
  }

  async function listPcbComponents(params: Record<string, any>): Promise<Record<string, unknown>> {
    const query = String(params.query ?? "")
      .trim()
      .toLowerCase();
    const layerFilter = String(params.layer ?? "all").toLowerCase();
    const limit = Math.max(1, Math.min(500, Number(params.limit ?? 100)));
    const includeRaw = Boolean(params.includeRaw);
    const includePads = Boolean(params.includePads);
    const includeProperties = Boolean(params.includeProperties);

    const eda = api();
    const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const currentTarget = extractDocumentIdentity(documentInfo, undefined, "native_api");
    const expectedTarget = params.expectedTarget ?? params.target;
    if (expectedTarget) {
      assertDocumentTargetMatch(expectedTarget, currentTarget);
    }

    const rawComponents = await getPcbComponents(api);
    const all = [];
    for (const item of toArray(rawComponents)) {
      const comp = item as Record<string, any>;
      const simplified = simplifyPrimitive(comp);
      const layerId =
        comp?.layer ??
        comp?.layerId ??
        (comp?.layer === 1 ? "TopLayer" : comp?.layer === 2 ? "BottomLayer" : undefined);
      const layerStr = String(layerId ?? "").toLowerCase();
      const side =
        layerStr.includes("top") || layerId === 1
          ? "top"
          : layerStr.includes("bot") || layerId === 2
            ? "bottom"
            : "unknown";
      const rotation = numeric(comp?.rotation ?? comp?.angle ?? 0) ?? 0;
      const locked = Boolean(getProp(comp, "getState_PrimitiveLock", ["locked", "primitiveLock"]));

      let compPads: Record<string, unknown>[] | undefined;
      let padCount: number | undefined;
      if (includePads || comp.pins || comp.pads) {
        const rawPins = await getComponentPads(comp, api);
        padCount = rawPins.length;
        if (includePads) {
          compPads = rawPins.map((pin) => normalizePcbPad(pin, comp, includeRaw));
        }
      }

      let properties: Record<string, unknown> | undefined;
      if (includeProperties) {
        properties = sanitize(comp?.properties ?? comp?.attributes ?? comp?.customProperties) as
          Record<string, unknown> | undefined;
      }

      all.push({
        primitiveId: simplified.primitiveId,
        designator: simplified.designator,
        footprint: simplified.footprint,
        value: simplified.value,
        x: simplified.x,
        y: simplified.y,
        rotation,
        layer: layerId,
        side,
        locked,
        ...(padCount !== undefined ? { padCount } : {}),
        ...(compPads ? { pads: compPads } : {}),
        ...(properties ? { properties } : {}),
        ...(includeRaw ? { raw: item } : {})
      });
    }

    let filtered = all;
    if (layerFilter === "top") {
      filtered = filtered.filter((c) => c.side === "top");
    } else if (layerFilter === "bottom") {
      filtered = filtered.filter((c) => c.side === "bottom");
    }

    if (query) {
      filtered = filtered.filter((c) =>
        [c.designator, c.footprint, c.value, c.primitiveId].some((field) =>
          String(field ?? "")
            .toLowerCase()
            .includes(query)
        )
      );
    }

    const items = filtered.slice(0, limit);
    return {
      target: currentTarget,
      total: all.length,
      count: items.length,
      layerFilter,
      components: items,
      betaApi: true
    };
  }

  async function getPcbPads(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const currentTarget = extractDocumentIdentity(documentInfo, undefined, "native_api");
    const expectedTarget = params.expectedTarget ?? params.target;
    if (expectedTarget) {
      assertDocumentTargetMatch(expectedTarget, currentTarget);
    }

    const componentFilter = params.component ? String(params.component).trim().toLowerCase() : undefined;
    const netFilter = params.net ? String(params.net).trim().toLowerCase() : undefined;
    const layerFilter = String(params.layer ?? "all")
      .trim()
      .toLowerCase();
    const padNumberFilter = params.padNumber ? String(params.padNumber).trim() : undefined;
    const includeComponentPads = params.includeComponentPads !== false;
    const includeStandalonePads = params.includeStandalonePads !== false;
    const limit = Math.max(1, Math.min(1000, Number(params.limit ?? 200)));
    const includeRaw = Boolean(params.includeRaw);

    const pads: Record<string, unknown>[] = [];

    // Collect pads from components
    if (includeComponentPads && eda.pcb_PrimitiveComponent?.getAll) {
      const rawComponents = await getPcbComponents(api);
      for (const comp of toArray(rawComponents)) {
        const compDesignator = String(getProp(comp, "getState_Designator", ["designator", "name"]) ?? "").toLowerCase();
        const compId = String(getProp(comp, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ?? "").toLowerCase();

        if (componentFilter && compDesignator !== componentFilter && compId !== componentFilter) {
          continue;
        }

        const rawPins = await getComponentPads(comp, api);
        for (const pin of rawPins) {
          pads.push(normalizePcbPad(pin, comp, includeRaw));
        }
      }
    }

    // Collect standalone pads
    if (includeStandalonePads && !componentFilter && eda.pcb_PrimitivePad?.getAll) {
      const rawStandalone = toArray(await optionalCall(() => eda.pcb_PrimitivePad.getAll()));
      for (const pad of rawStandalone) {
        pads.push(normalizePcbPad(pad, undefined, includeRaw));
      }
    }

    let filtered = pads;
    if (netFilter) {
      filtered = filtered.filter(
        (p) =>
          String(p.net ?? "").toLowerCase() === netFilter ||
          String(p.net ?? "")
            .toLowerCase()
            .includes(netFilter)
      );
    }
    if (layerFilter !== "all") {
      filtered = filtered.filter((p) => p.side === layerFilter || String(p.layer ?? "").toLowerCase() === layerFilter);
    }
    if (padNumberFilter) {
      filtered = filtered.filter((p) => String(p.padNumber ?? "") === padNumberFilter);
    }

    const items = filtered.slice(0, limit);
    return {
      target: currentTarget,
      totalPads: pads.length,
      count: items.length,
      pads: items,
      componentFilter: params.component,
      netFilter: params.net,
      layerFilter,
      padNumberFilter: params.padNumber,
      betaApi: true
    };
  }

  async function highlightNet(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    const net = params.net ? String(params.net).trim() : undefined;
    const clear = Boolean(params.clear) || !net;

    if (clear) {
      if (eda.pcb_Net?.unhighlightAllNets) {
        await eda.pcb_Net.unhighlightAllNets();
      }
      return { cleared: true, message: "Cleared all net highlights." };
    }

    ensureApi("pcb_Net", "highlightNet", eda);
    await eda.pcb_Net.highlightNet(net);
    return {
      highlighted: true,
      net,
      message: `Highlighted net "${net}" on PCB.`
    };
  }

  return {
    runDrc,
    getPcbLayers,
    getRoutingStatus,
    listPcbComponents,
    getPcbPads,
    getPcbPadsTool: getPcbPads,
    highlightNet
  };
}
