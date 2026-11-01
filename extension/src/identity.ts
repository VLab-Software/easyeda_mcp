import {
  generateTargetFingerprint,
  validateDocumentTarget,
  assertDocumentTargetMatch,
  type DocumentIdentity,
  type DocumentType,
  type DataCompleteness,
  type DataSource,
  type TargetValidationResult
} from "../../src/protocol/identity.js";
import { inferDocumentType, isRecord, numeric, pickString } from "./helpers.js";
import type { EasyEdaApi } from "./types.js";

export {
  generateTargetFingerprint,
  validateDocumentTarget,
  assertDocumentTargetMatch,
  type DocumentIdentity,
  type DocumentType,
  type DataCompleteness,
  type DataSource,
  type TargetValidationResult
};

export function extractDocumentIdentity(
  documentInfo: unknown,
  pageInfo?: unknown,
  source: DataSource = "native_api"
): DocumentIdentity {
  const docRecord = isRecord(documentInfo) ? documentInfo : undefined;
  const pageRecord = isRecord(pageInfo) ? pageInfo : undefined;

  const documentId = pickString(docRecord, ["uuid", "documentUuid", "id", "docId"]);
  const documentName = pickString(docRecord, ["name", "title", "documentName"]);
  const projectId = pickString(docRecord, ["parentProjectUuid", "projectUuid", "projectId", "parentProjectId"]);
  const projectName = pickString(docRecord, ["projectName", "project", "parentProjectName", "parentName"]);
  const tabId = pickString(docRecord, ["tabId"]);

  const pageId =
    pickString(pageRecord, ["pageId", "sheetId", "id"]) ?? pickString(docRecord, ["activePageId", "pageId", "sheetId"]);
  const pageIndex =
    numeric(pageRecord?.pageIndex ?? pageRecord?.index) ?? numeric(docRecord?.activePageIndex ?? docRecord?.pageIndex);

  const documentType = inferDocumentType(documentInfo) as DocumentType;

  let completeness: DataCompleteness = "empty";
  if (documentId && projectId) {
    completeness = "full";
  } else if (documentId || projectId || documentName || (docRecord && Object.keys(docRecord).length > 0)) {
    completeness = "partial";
  }

  const identity: DocumentIdentity = {
    projectId,
    projectName,
    documentId,
    documentName,
    documentType,
    tabId,
    pageId,
    pageIndex,
    capturedAt: new Date().toISOString(),
    completeness,
    source,
    fingerprint: ""
  };

  identity.fingerprint = generateTargetFingerprint(identity);
  return identity;
}

export function detectMethodCapabilities(api: () => EasyEdaApi): Record<string, boolean> {
  const eda = api();
  return {
    // Document & selection control
    "dmt_SelectControl.getCurrentDocumentInfo": Boolean(eda.dmt_SelectControl?.getCurrentDocumentInfo),
    "dmt_SelectControl.getSelectedPrimitives": Boolean(
      eda.dmt_SelectControl?.getSelectedPrimitives ||
      eda.dmt_SelectControl?.getAllSelectedPrimitives ||
      eda.dmt_SelectControl?.getSelected
    ),
    "dmt_EditorControl.getSplitScreenTree": Boolean(eda.dmt_EditorControl?.getSplitScreenTree),
    "dmt_EditorControl.openDocument": Boolean(eda.dmt_EditorControl?.openDocument),
    "dmt_EditorControl.activateDocument": Boolean(eda.dmt_EditorControl?.activateDocument),
    "dmt_EditorControl.getCurrentRenderedAreaImage": Boolean(eda.dmt_EditorControl?.getCurrentRenderedAreaImage),
    "dmt_Project.getCurrentProjectInfo": Boolean(eda.dmt_Project?.getCurrentProjectInfo),

    // PCB APIs
    "pcb_Drc.getCurrentRuleConfiguration": Boolean(eda.pcb_Drc?.getCurrentRuleConfiguration),
    "pcb_Drc.overwriteCurrentRuleConfiguration": Boolean(eda.pcb_Drc?.overwriteCurrentRuleConfiguration),
    "pcb_Drc.check": Boolean(eda.pcb_Drc?.check),
    "pcb_Layer.getAllLayers": Boolean(eda.pcb_Layer?.getAllLayers),
    "pcb_Net.getAllNetsName": Boolean(eda.pcb_Net?.getAllNetsName || eda.pcb_Net?.getAllNetName),
    "pcb_Net.highlightNet": Boolean(eda.pcb_Net?.highlightNet),
    "pcb_ManufactureData.getPickAndPlaceFile": Boolean(eda.pcb_ManufactureData?.getPickAndPlaceFile),
    "pcb_ManufactureData.getGerberFile": Boolean(eda.pcb_ManufactureData?.getGerberFile),
    "pcb_ManufactureData.getBomFile": Boolean(eda.pcb_ManufactureData?.getBomFile),

    // Schematic APIs
    "sch_Document.getAllPrimitiveId": Boolean(eda.sch_Document?.getAllPrimitiveId),
    "sch_ManufactureData.getBomFile": Boolean(eda.sch_ManufactureData?.getBomFile),

    // Libraries & System
    "lib_Device.search": Boolean(eda.lib_Device?.search || eda.lib_Search?.search),
    "sys_WebSocket.register": Boolean(eda.sys_WebSocket?.register),
    "sys_WebSocket.send": Boolean(eda.sys_WebSocket?.send),
    "sys_FileSystem.saveFile": Boolean(eda.sys_FileSystem?.saveFile),
    "sys_Dialog.showInformationMessage": Boolean(eda.sys_Dialog?.showInformationMessage)
  };
}
