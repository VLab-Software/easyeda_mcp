import type { DrcRules } from "../drcRules.js";
import { apiError, ensureApi, optionalCall, pickString } from "../helpers.js";
import { extractDocumentIdentity } from "../identity.js";
import { extensionMutations } from "../mutation/mutationManager.js";
import { executeBoardOutlineMutation } from "../mutation/pcbOutlineMutations.js";
import { executePcbComponentMutation } from "../mutation/pcbComponentMutations.js";
import { executePcbCopperKeepoutMutation } from "../mutation/pcbCopperKeepoutMutations.js";
import { executePcbExternalImportMutation } from "../mutation/pcbExternalImportMutations.js";
import { executePcbNetConstraintMutation } from "../mutation/pcbNetConstraintMutations.js";
import {
  executePcbLayoutMutation,
  executePcbRoutingMutation,
  fetchLayoutSummary,
  fetchRoutingSummary
} from "../mutation/pcbRoutingMutations.js";
import { executePcbTrackViaMutation } from "../mutation/pcbTrackViaMutations.js";
import { executeSchematicComponentMutation } from "../mutation/schematicComponentMutations.js";
import { executeSchematicWireMutation } from "../mutation/schematicWireMutations.js";
import type { EasyEdaApi, RpcHandler } from "../types.js";

export function createActionHandlers(
  api: () => EasyEdaApi,
  drcRules: DrcRules,
  mutations = extensionMutations
): Record<string, RpcHandler> {
  async function confirmedAction(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    const action = String(params.action ?? "");
    if (action === "editDrcRules") return drcRules.apply(params.params, params.confirmation);

    if (action === "mutation" && params.params?.mutationId) {
      const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
      const currentTarget = extractDocumentIdentity(documentInfo);
      const record = mutations.get(params.params.mutationId);

      let executeFn: () => Promise<boolean | void> = async () => true;
      let readbackFn: () => Promise<unknown> = async () => record.before;

      if (record.domain === "schematic") {
        let resultReadback: Record<string, unknown> = {};
        executeFn = async () => {
          let res: { executed: boolean; readback: Record<string, unknown> };
          if (["createWire", "modifyWire", "deleteWire", "addNetLabel"].includes(record.action)) {
            res = await executeSchematicWireMutation(record, api);
          } else {
            res = await executeSchematicComponentMutation(record, api);
          }
          resultReadback = res.readback;
          return res.executed;
        };
        readbackFn = async () => resultReadback;
      } else if (record.domain === "pcb") {
        let resultReadback: Record<string, unknown> = {};
        executeFn = async () => {
          let res: { executed: boolean; readback: Record<string, unknown> };
          if (["autoroute", "unroute"].includes(record.action)) {
            res = await executePcbRoutingMutation(api, (record as any).operation ?? record, record.before);
          } else if (record.action === "autolayout") {
            res = await executePcbLayoutMutation(api, (record as any).operation ?? record, record.before);
          } else if (["setBoardOutline", "clearBoardOutline", "modifyBoardOutline"].includes(record.action)) {
            res = await executeBoardOutlineMutation(api, (record as any).operation ?? record, record.before);
          } else if (
            [
              "createCopperZone",
              "modifyCopperZone",
              "deleteCopperZone",
              "rebuildCopper",
              "createKeepout",
              "modifyKeepout",
              "deleteKeepout"
            ].includes(record.action)
          ) {
            res = await executePcbCopperKeepoutMutation(api, (record as any).operation ?? record, record.before);
          } else if (
            [
              "createNetClass",
              "modifyNetClass",
              "deleteNetClass",
              "createDifferentialPair",
              "modifyDifferentialPair",
              "deleteDifferentialPair",
              "createLengthGroup",
              "modifyLengthGroup",
              "deleteLengthGroup"
            ].includes(record.action)
          ) {
            res = await executePcbNetConstraintMutation(api, (record as any).operation ?? record, record.before);
          } else if (record.action === "import_external") {
            res = await executePcbExternalImportMutation(api, (record as any).operation ?? record, record.before);
          } else if (
            ["createTrack", "modifyTrack", "deleteTrack", "createVia", "modifyVia", "deleteVia"].includes(record.action)
          ) {
            res = await executePcbTrackViaMutation(api, (record as any).operation ?? record, record.before);
          } else {
            res = await executePcbComponentMutation(api, (record as any).operation ?? record, record.before);
          }
          resultReadback = res.readback;
          return res.executed;
        };
        readbackFn = async () => resultReadback;
      }

      return mutations.apply({
        mutationId: params.params.mutationId,
        confirmation: String(params.confirmation ?? ""),
        currentTarget,
        currentBefore: record.before,
        execute: executeFn,
        readback: readbackFn,
        readbackTarget: currentTarget
      });
    }

    const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const documentUuid = pickString(documentInfo, ["uuid", "documentUuid", "id"]);

    if (action === "save") {
      if (eda.pcb_Document?.save) {
        await eda.pcb_Document.save(documentUuid);
        return { action, saved: true, documentUuid, target: extractDocumentIdentity(documentInfo) };
      }
      if (eda.sch_Document?.save) {
        await eda.sch_Document.save(documentUuid);
        return { action, saved: true, documentUuid, target: extractDocumentIdentity(documentInfo) };
      }
    }

    if (action === "importChanges") {
      ensureApi("pcb_Document", "importChanges", eda);
      await eda.pcb_Document.importChanges(params.uuid ?? documentUuid);
      return {
        action,
        imported: true,
        documentUuid: params.uuid ?? documentUuid,
        target: extractDocumentIdentity(documentInfo)
      };
    }

    if (action === "autoroute" || action === "nativeAutoRoute") {
      if (params.params?.file) {
        ensureApi("pcb_Document", "importAutoRouteJsonFile", eda);
        await eda.pcb_Document.importAutoRouteJsonFile(params.params.file);
        return {
          action: "autoroute",
          method: "external_import",
          imported: true,
          betaApi: true,
          target: extractDocumentIdentity(documentInfo)
        };
      }

      if (!eda.pcb_Document?.autoRouting && !eda.pcb_Document?.autoRoute) {
        ensureApi("pcb_Document", "autoRouting", eda);
      }
      const routeFn = eda.pcb_Document.autoRouting ?? eda.pcb_Document.autoRoute;
      await routeFn(params.params ?? {});
      const routingStatus = await fetchRoutingSummary(api);
      return {
        action: "autoroute",
        method: "native",
        routed: true,
        routingStatus,
        target: extractDocumentIdentity(documentInfo)
      };
    }

    if (action === "autolayout" || action === "nativeAutoLayout") {
      if (params.params?.file) {
        ensureApi("pcb_Document", "importAutoLayoutJsonFile", eda);
        await eda.pcb_Document.importAutoLayoutJsonFile(params.params.file);
        return {
          action: "autolayout",
          method: "external_import",
          imported: true,
          betaApi: true,
          target: extractDocumentIdentity(documentInfo)
        };
      }

      const layoutFn = eda.pcb_Document?.autoLayout ?? eda.pcb_Document?.autoPlace;
      if (!layoutFn) {
        ensureApi("pcb_Document", "autoLayout", eda);
      }
      await layoutFn(params.params ?? {});
      const layoutStatus = await fetchLayoutSummary(api);
      return {
        action: "autolayout",
        method: "native",
        arranged: true,
        layoutStatus,
        target: extractDocumentIdentity(documentInfo)
      };
    }

    if (action === "unroute") {
      const unrouteFn = eda.pcb_Document?.unRoute ?? eda.pcb_Document?.unroute ?? eda.pcb_Document?.clearRouting;
      if (!unrouteFn) {
        ensureApi("pcb_Document", "unRoute", eda);
      }
      await unrouteFn(params.params ?? {});
      const routingStatus = await fetchRoutingSummary(api);
      return {
        action: "unroute",
        method: "native",
        unrouted: true,
        routingStatus,
        target: extractDocumentIdentity(documentInfo)
      };
    }

    if (action === "importAutoRouteFile") {
      ensureApi("pcb_Document", "importAutoRouteJsonFile", eda);
      if (!params.params?.file) {
        throw apiError(
          "missing_file",
          "importAutoRouteFile requires params.file from an EasyEDA-compatible autoroute JSON/SES file."
        );
      }
      await eda.pcb_Document.importAutoRouteJsonFile(params.params.file);
      return {
        action: "importAutoRouteFile",
        method: "external_import",
        imported: true,
        betaApi: true,
        target: extractDocumentIdentity(documentInfo)
      };
    }

    if (action === "importAutoLayoutFile") {
      ensureApi("pcb_Document", "importAutoLayoutJsonFile", eda);
      if (!params.params?.file) {
        throw apiError(
          "missing_file",
          "importAutoLayoutFile requires params.file from an EasyEDA-compatible autolayout JSON file."
        );
      }
      await eda.pcb_Document.importAutoLayoutJsonFile(params.params.file);
      return {
        action: "importAutoLayoutFile",
        method: "external_import",
        imported: true,
        betaApi: true,
        target: extractDocumentIdentity(documentInfo)
      };
    }

    throw apiError("unsupported_action", `Unsupported or unavailable confirmed action: ${action}.`);
  }

  function getMutationResult(params: Record<string, any>): Record<string, unknown> {
    const mutationId = String(params.mutationId ?? "");
    return mutations.get(mutationId);
  }

  return {
    confirmedAction,
    getMutationResult
  };
}
