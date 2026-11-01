import type { DrcRules } from "../drcRules.js";
import { apiError, ensureApi, optionalCall, pickString } from "../helpers.js";
import type { EasyEdaApi, RpcHandler } from "../types.js";

export function createActionHandlers(api: () => EasyEdaApi, drcRules: DrcRules): Record<string, RpcHandler> {
  async function confirmedAction(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    const action = String(params.action ?? "");
    if (action === "editDrcRules") return drcRules.apply(params.params, params.confirmation);
    const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const documentUuid = pickString(documentInfo, ["uuid", "documentUuid", "id"]);

    if (action === "save") {
      if (eda.pcb_Document?.save) {
        await eda.pcb_Document.save(documentUuid);
        return { action, saved: true, documentUuid };
      }
      if (eda.sch_Document?.save) {
        await eda.sch_Document.save(documentUuid);
        return { action, saved: true, documentUuid };
      }
    }

    if (action === "importChanges") {
      ensureApi("pcb_Document", "importChanges", eda);
      await eda.pcb_Document.importChanges(params.uuid ?? documentUuid);
      return { action, imported: true, documentUuid: params.uuid ?? documentUuid };
    }

    if (action === "autoroute") {
      ensureApi("pcb_Document", "importAutoRouteJsonFile", eda);
      if (!params.params?.file) {
        throw apiError(
          "missing_file",
          "autoroute requires params.file from an EasyEDA-compatible autoroute JSON/SES file."
        );
      }
      await eda.pcb_Document.importAutoRouteJsonFile(params.params.file);
      return { action, imported: true, betaApi: true };
    }

    if (action === "autolayout") {
      ensureApi("pcb_Document", "importAutoLayoutJsonFile", eda);
      if (!params.params?.file) {
        throw apiError(
          "missing_file",
          "autolayout requires params.file from an EasyEDA-compatible autolayout JSON file."
        );
      }
      await eda.pcb_Document.importAutoLayoutJsonFile(params.params.file);
      return { action, imported: true, betaApi: true };
    }

    throw apiError("unsupported_action", `Unsupported or unavailable confirmed action: ${action}.`);
  }

  return {
    confirmedAction
  };
}
