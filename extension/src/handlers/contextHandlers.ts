import { optionalCall, sanitize, toArray } from "../helpers.js";
import { detectMethodCapabilities, extractDocumentIdentity } from "../identity.js";
import type { EasyEdaApi, RpcHandler } from "../types.js";
import { getPcbComponents, getPcbNetNames } from "./pcbHandlers.js";
import { getSchematicComponents } from "./schematicHandlers.js";

export function createContextHandlers(
  api: () => EasyEdaApi,
  getStatus: () => Promise<Record<string, unknown>>
): Record<string, RpcHandler> {
  async function getContext(): Promise<Record<string, unknown>> {
    const eda = api();
    const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const documentIdentity = extractDocumentIdentity(documentInfo);
    const methodCapabilities = detectMethodCapabilities(api);
    const splitScreenTree = await optionalCall(() => eda.dmt_EditorControl?.getSplitScreenTree?.());
    const pcbNets = await optionalCall(() => getPcbNetNames(api));
    const pcbComponents = await optionalCall(() => getPcbComponents(api));
    const schComponents = await optionalCall(() => getSchematicComponents(api));

    return {
      status: await getStatus(),
      documentIdentity,
      documentInfo: sanitize(documentInfo),
      methodCapabilities,
      splitScreenTree: sanitize(splitScreenTree),
      counts: {
        pcbNets: Array.isArray(pcbNets) ? pcbNets.length : undefined,
        pcbComponents: Array.isArray(pcbComponents) ? pcbComponents.length : undefined,
        schematicComponents: Array.isArray(schComponents) ? schComponents.length : undefined
      },
      betaApi: true
    };
  }

  async function getSelection(): Promise<Record<string, unknown>> {
    const eda = api();
    const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const documentIdentity = extractDocumentIdentity(documentInfo);
    let selectedPrimitives: unknown[] = [];

    if (eda.dmt_SelectControl?.getSelectedPrimitives) {
      selectedPrimitives = toArray(await optionalCall(() => eda.dmt_SelectControl.getSelectedPrimitives()));
    } else if (eda.dmt_SelectControl?.getAllSelectedPrimitives) {
      selectedPrimitives = toArray(await optionalCall(() => eda.dmt_SelectControl.getAllSelectedPrimitives()));
    } else if (eda.dmt_SelectControl?.getSelected) {
      selectedPrimitives = toArray(await optionalCall(() => eda.dmt_SelectControl.getSelected()));
    }

    const items = selectedPrimitives.map((item: any) => {
      if (!item || typeof item !== "object") return item;
      return {
        id: item.primitiveId ?? item.id ?? item.uuid,
        type: item.type ?? item.primitiveType ?? item.sourceType,
        name: item.designator ?? item.name ?? item.title,
        layer: item.layer ?? item.layerId
      };
    });

    return {
      documentIdentity,
      document: {
        uuid: documentIdentity.documentId,
        type: documentIdentity.documentType,
        name: documentIdentity.documentName
      },
      count: items.length,
      selection: sanitize(items),
      raw: sanitize(selectedPrimitives)
    };
  }

  return {
    getContext,
    getSelection
  };
}
