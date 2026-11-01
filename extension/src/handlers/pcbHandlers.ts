import { apiError, ensureApi, numeric, optionalCall, sanitize, simplifyPrimitive, toArray } from "../helpers.js";
import { extractDocumentIdentity } from "../identity.js";
import type { EasyEdaApi, RpcHandler } from "../types.js";

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

    const rawComponents = await getPcbComponents(api);
    const documentInfo = await optionalCall(() => api().dmt_SelectControl?.getCurrentDocumentInfo?.());
    const all = toArray(rawComponents).map((item: any) => {
      const simplified = simplifyPrimitive(item);
      const layerId =
        item?.layer ??
        item?.layerId ??
        (item?.layer === 1 ? "TopLayer" : item?.layer === 2 ? "BottomLayer" : undefined);
      const layerStr = String(layerId ?? "").toLowerCase();
      const side =
        layerStr.includes("top") || layerId === 1
          ? "top"
          : layerStr.includes("bot") || layerId === 2
            ? "bottom"
            : "unknown";
      const rotation = numeric(item?.rotation ?? item?.angle ?? 0) ?? 0;
      return {
        primitiveId: simplified.primitiveId,
        designator: simplified.designator,
        footprint: simplified.footprint,
        value: simplified.value,
        x: simplified.x,
        y: simplified.y,
        rotation,
        layer: layerId,
        side,
        ...(includeRaw ? { raw: item } : {})
      };
    });

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
      target: extractDocumentIdentity(documentInfo),
      total: all.length,
      count: items.length,
      layerFilter,
      components: items,
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
    highlightNet
  };
}
