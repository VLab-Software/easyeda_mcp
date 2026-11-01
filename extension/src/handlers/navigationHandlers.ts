import {
  apiError,
  ensureApi,
  isNumber,
  normalizeBBox,
  optionalCall
} from "../helpers.js";
import type { EasyEdaApi, RpcHandler } from "../types.js";

export async function zoomToRegion(
  api: () => EasyEdaApi,
  left: number,
  right: number,
  top: number,
  bottom: number
): Promise<void> {
  const eda = api();
  if (eda.pcb_Document?.navigateToRegion) {
    await eda.pcb_Document.navigateToRegion(left, right, top, bottom);
    return;
  }
  ensureApi("dmt_EditorControl", "zoomToRegion", eda);
  await eda.dmt_EditorControl.zoomToRegion(left, right, top, bottom);
}

export function createNavigationHandlers(
  api: () => EasyEdaApi,
  findComponentFn: (params: Record<string, any>) => Promise<Record<string, unknown>>
): Record<string, RpcHandler> {
  async function navigateComponent(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    const result = await findComponentFn({ query: params.query, limit: 1 });
    const first = (result.matches as any[])?.[0];
    if (!first) {
      throw apiError("component_not_found", `No component matched "${params.query}".`);
    }

    const primitiveId = first.component.primitiveId ?? first.component.id ?? first.component.uuid;
    if (!primitiveId) {
      return {
        navigated: false,
        reason: "Matched component did not expose a primitive id.",
        match: first,
        betaApi: true
      };
    }

    const primitiveApi = first.source === "pcb" ? eda.pcb_Primitive : eda.sch_Primitive;
    const bbox = await optionalCall(() => (primitiveApi?.getPrimitivesBBox ? primitiveApi.getPrimitivesBBox([primitiveId]) : undefined));
    const region = normalizeBBox(bbox);
    if (region) {
      await zoomToRegion(api, region.left, region.right, region.top, region.bottom);
    }

    return {
      navigated: Boolean(region),
      primitiveId,
      region,
      match: first,
      betaApi: true
    };
  }

  async function navigateRegion(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    if (isNumber(params.x) && isNumber(params.y)) {
      if (eda.pcb_Document?.navigateToCoordinates) {
        await eda.pcb_Document.navigateToCoordinates(params.x, params.y);
        return { navigated: true, mode: "coordinates", x: params.x, y: params.y };
      }
      if (eda.dmt_EditorControl?.zoomTo) {
        await eda.dmt_EditorControl.zoomTo(params.x, params.y, params.scaleRatio ?? 1);
        return { navigated: true, mode: "zoomTo", x: params.x, y: params.y, betaApi: true };
      }
    }

    for (const key of ["left", "right", "top", "bottom"]) {
      if (!isNumber(params[key])) {
        throw apiError("invalid_region", "Provide either x/y coordinates or left/right/top/bottom region values.");
      }
    }

    await zoomToRegion(api, params.left, params.right, params.top, params.bottom);
    return {
      navigated: true,
      mode: "region",
      region: {
        left: params.left,
        right: params.right,
        top: params.top,
        bottom: params.bottom
      },
      betaApi: true
    };
  }

  async function zoomBoard(): Promise<Record<string, unknown>> {
    const eda = api();
    ensureApi("pcb_Document", "zoomToBoardOutline", eda);
    await eda.pcb_Document.zoomToBoardOutline();
    return {
      zoomed: true,
      betaApi: true
    };
  }

  return {
    navigateComponent,
    navigateRegion,
    zoomBoard
  };
}
