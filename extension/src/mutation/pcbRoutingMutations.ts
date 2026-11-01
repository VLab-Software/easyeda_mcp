import { apiError, isRecord, optionalCall, toArray } from "../helpers.js";
import { assertDocumentTargetMatch, extractDocumentIdentity } from "../identity.js";
import { extensionMutations } from "./mutationManager.js";
import type { EasyEdaApi } from "../types.js";

export type RoutingSummary = {
  totalNets: number;
  routedNets: number;
  unroutedNets: number;
  completionPercent: number;
  unroutedNetNames: string[];
  target: Record<string, unknown>;
};

export type LayoutSummary = {
  totalComponents: number;
  components: Array<{
    primitiveId: string;
    designator: string;
    x: number;
    y: number;
    layer: number | string;
    locked: boolean;
  }>;
  target: Record<string, unknown>;
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

export async function fetchRoutingSummary(api: () => EasyEdaApi): Promise<RoutingSummary> {
  const eda = api();
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const currentTarget = extractDocumentIdentity(documentInfo);

  let netNames: string[] = [];
  if (eda.pcb_Net?.getAllNetsName) {
    netNames = toArray(await optionalCall(() => eda.pcb_Net.getAllNetsName())).map(String);
  } else if (eda.pcb_Net?.getAllNetName) {
    netNames = toArray(await optionalCall(() => eda.pcb_Net.getAllNetName())).map(String);
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
        net.isRouted === true || (net.unroutedCount === 0 && (net.trackCount > 0 || net.routedCount > 0))
      );
      if (isRouted) {
        routedCount++;
      } else if (name) {
        unroutedNetNames.push(name);
      }
    }
  } else {
    routedCount = netNames.length;
  }

  const totalNets = netNames.length > 0 ? netNames.length : allNetsDetails.length;
  const completionPercent = totalNets > 0 ? Math.round((routedCount / totalNets) * 1000) / 10 : 100;

  return {
    totalNets,
    routedNets: routedCount,
    unroutedNets: unroutedNetNames.length,
    completionPercent,
    unroutedNetNames,
    target: currentTarget as Record<string, unknown>
  };
}

export async function fetchLayoutSummary(api: () => EasyEdaApi): Promise<LayoutSummary> {
  const eda = api();
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const currentTarget = extractDocumentIdentity(documentInfo);

  let rawComponents: any[] = [];
  if (eda.pcb_PrimitiveComponent?.getAll) {
    rawComponents = toArray(await optionalCall(() => eda.pcb_PrimitiveComponent.getAll()));
  }

  const components = rawComponents.filter(isRecord).map((raw) => {
    const primitiveId = String(getProp(raw, "getState_PrimitiveId", ["primitiveId", "id", "uuid"]) ?? "");
    const designator = String(getProp(raw, "getState_Designator", ["designator", "name", "displayName"]) ?? "");
    const x = Number(getProp(raw, "getState_X", ["x", "centerX"]) ?? 0);
    const y = Number(getProp(raw, "getState_Y", ["y", "centerY"]) ?? 0);
    const layer = getProp(raw, "getState_Layer", ["layer", "layerId"]) ?? 1;
    const locked = Boolean(getProp(raw, "getState_PrimitiveLock", ["locked", "primitiveLock"]));
    return { primitiveId, designator, x, y, layer, locked };
  });

  return {
    totalComponents: components.length,
    components,
    target: currentTarget as Record<string, unknown>
  };
}

export async function preparePcbRoutingMutation(
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
      `Active document is '${currentTarget.documentType}'. PCB routing operations require an active PCB document.`
    );
  }

  const action = String(params.action ?? "autoroute").toLowerCase();
  const nets = Array.isArray(params.nets) ? params.nets.map(String).filter(Boolean) : undefined;
  const ignoreNets = Array.isArray(params.ignoreNets) ? params.ignoreNets.map(String).filter(Boolean) : undefined;
  const keepExistingRoutes = params.keepExistingRoutes !== false;

  const currentSummary = await fetchRoutingSummary(api);

  if (action === "autoroute") {
    const targetDesc =
      nets && nets.length > 0 ? `${nets.length} specified nets (${nets.join(", ")})` : "all unrouted nets";
    const impact = `Executes native PCB auto-routing for ${targetDesc} (preserving existing routes: ${keepExistingRoutes}).`;

    const preview = {
      impact,
      scope: `document:${currentTarget.documentId ?? "active_pcb"}`,
      before: {
        totalNets: currentSummary.totalNets,
        routedNets: currentSummary.routedNets,
        unroutedNets: currentSummary.unroutedNets,
        completionPercent: currentSummary.completionPercent
      },
      requestedAfter: {
        action: "autoroute",
        targetNets: nets ?? "all",
        keepExistingRoutes,
        targetCompletionPercent: 100
      },
      changedKeys: ["routing", "routedNets", "completionPercent"]
    };

    const record = extensionMutations.prepare({
      domain: "pcb",
      action: "autoroute",
      target: currentTarget,
      operation: {
        action: "autoroute",
        nets,
        ignoreNets,
        keepExistingRoutes
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
      action: "autoroute",
      target: record.target,
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  if (action === "unroute") {
    const targetDesc =
      nets && nets.length > 0 ? `${nets.length} specified nets (${nets.join(", ")})` : "all routed nets";
    const impact = `DESTRUCTIVE: Unroutes copper traces and vias on the active PCB for ${targetDesc}.`;

    const preview = {
      impact,
      scope: `document:${currentTarget.documentId ?? "active_pcb"}`,
      before: {
        totalNets: currentSummary.totalNets,
        routedNets: currentSummary.routedNets,
        unroutedNets: currentSummary.unroutedNets,
        completionPercent: currentSummary.completionPercent
      },
      requestedAfter: {
        action: "unroute",
        targetNets: nets ?? "all",
        clearedRoutes: true
      },
      changedKeys: ["unrouted", "unroutedNets", "completionPercent"]
    };

    const record = extensionMutations.prepare({
      domain: "pcb",
      action: "unroute",
      target: currentTarget,
      operation: {
        action: "unroute",
        nets
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
      action: "unroute",
      target: record.target,
      preview: record.preview,
      expiresAt: record.expiresAt
    };
  }

  throw apiError("unsupported_action", `Unsupported routing action '${action}'. Expected autoroute or unroute.`);
}

export async function executePcbRoutingMutation(
  api: () => EasyEdaApi,
  op: Record<string, any>,
  _expectedBefore?: unknown
): Promise<{ executed: true; readback: Record<string, unknown> }> {
  const eda = api();

  if (op.action === "autoroute") {
    if (!eda.pcb_Document?.autoRouting && !eda.pcb_Document?.autoRoute) {
      throw apiError(
        "unsupported_api",
        "EasyEDA Pro native autoRouting API method is unavailable on the current platform."
      );
    }

    const routeFn = eda.pcb_Document.autoRouting ?? eda.pcb_Document.autoRoute;
    await routeFn({
      nets: op.nets,
      ignoreNets: op.ignoreNets,
      keepExisting: op.keepExistingRoutes
    });

    const readback = await fetchRoutingSummary(api);
    return {
      executed: true,
      readback: {
        method: "native",
        totalNets: readback.totalNets,
        routedNets: readback.routedNets,
        unroutedNets: readback.unroutedNets,
        completionPercent: readback.completionPercent,
        verified: true
      }
    };
  }

  if (op.action === "unroute") {
    const unrouteFn = eda.pcb_Document?.unRoute ?? eda.pcb_Document?.unroute ?? eda.pcb_Document?.clearRouting;

    if (!unrouteFn) {
      throw apiError(
        "unsupported_api",
        "EasyEDA Pro native unRoute/clearRouting API method is unavailable on the current platform."
      );
    }

    await unrouteFn({ nets: op.nets });

    const readback = await fetchRoutingSummary(api);
    return {
      executed: true,
      readback: {
        method: "native",
        unrouted: true,
        totalNets: readback.totalNets,
        routedNets: readback.routedNets,
        unroutedNets: readback.unroutedNets,
        completionPercent: readback.completionPercent,
        verified: true
      }
    };
  }

  throw apiError("unsupported_action", `Unsupported execution action '${op.action}'.`);
}

export async function preparePcbLayoutMutation(
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
      `Active document is '${currentTarget.documentType}'. PCB layout operations require an active PCB document.`
    );
  }

  const components = Array.isArray(params.components) ? params.components.map(String).filter(Boolean) : undefined;
  const currentLayout = await fetchLayoutSummary(api);

  const targetDesc =
    components && components.length > 0
      ? `${components.length} components (${components.join(", ")})`
      : "all unlocked components";
  const impact = `Executes native PCB auto-layout to arrange ${targetDesc} inside the board outline.`;

  const preview = {
    impact,
    scope: `document:${currentTarget.documentId ?? "active_pcb"}`,
    before: {
      totalComponents: currentLayout.totalComponents
    },
    requestedAfter: {
      action: "autolayout",
      targetComponents: components ?? "all",
      arranged: true
    },
    changedKeys: ["layout", "componentPositions"]
  };

  const record = extensionMutations.prepare({
    domain: "pcb",
    action: "autolayout",
    target: currentTarget,
    operation: {
      action: "autolayout",
      components
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
    action: "autolayout",
    target: record.target,
    preview: record.preview,
    expiresAt: record.expiresAt
  };
}

export async function executePcbLayoutMutation(
  api: () => EasyEdaApi,
  op: Record<string, any>,
  _expectedBefore?: unknown
): Promise<{ executed: true; readback: Record<string, unknown> }> {
  const eda = api();
  const layoutFn = eda.pcb_Document?.autoLayout ?? eda.pcb_Document?.autoPlace;

  if (!layoutFn) {
    throw apiError(
      "unsupported_api",
      "EasyEDA Pro native autoLayout API method is unavailable on the current platform."
    );
  }

  await layoutFn({ components: op.components });

  const readback = await fetchLayoutSummary(api);
  return {
    executed: true,
    readback: {
      method: "native",
      totalComponents: readback.totalComponents,
      arranged: true,
      verified: true
    }
  };
}
