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
    "pcb_Drc.getErrors": Boolean(eda.pcb_Drc?.getErrors || (eda.pcb_Drc as any)?.getDrcErrors),
    "pcb_Drc.clearErrors": Boolean((eda.pcb_Drc as any)?.clearErrors),
    "pcb_Document.autoRouting": Boolean(eda.pcb_Document?.autoRouting),
    "pcb_Document.unRoute": Boolean(
      eda.pcb_Document?.unRoute || eda.pcb_Document?.unroute || eda.pcb_Document?.clearRouting
    ),
    "pcb_Document.autoLayout": Boolean(eda.pcb_Document?.autoLayout || eda.pcb_Document?.autoPlace),
    "pcb_Document.importAutoRouteJsonFile": Boolean(eda.pcb_Document?.importAutoRouteJsonFile),
    "pcb_Document.importAutoLayoutJsonFile": Boolean(eda.pcb_Document?.importAutoLayoutJsonFile),
    "pcb_Layer.getAllLayers": Boolean(eda.pcb_Layer?.getAllLayers),
    "pcb_Net.getAllNetsName": Boolean(eda.pcb_Net?.getAllNetsName || eda.pcb_Net?.getAllNetName),
    "pcb_Net.highlightNet": Boolean(eda.pcb_Net?.highlightNet),
    "pcb_PrimitiveComponent.getAll": Boolean(eda.pcb_PrimitiveComponent?.getAll),
    "pcb_PrimitiveComponent.get": Boolean(eda.pcb_PrimitiveComponent?.get),
    "pcb_PrimitiveComponent.modify": Boolean(eda.pcb_PrimitiveComponent?.modify),
    "pcb_PrimitiveComponent.delete": Boolean(eda.pcb_PrimitiveComponent?.delete),
    "pcb_PrimitiveComponent.flip": Boolean(eda.pcb_PrimitiveComponent?.flip),
    "pcb_PrimitivePad.getAll": Boolean(eda.pcb_PrimitivePad?.getAll),
    "pcb_PrimitivePad.get": Boolean(eda.pcb_PrimitivePad?.get),
    "pcb_PrimitiveLine.getAll": Boolean(eda.pcb_PrimitiveLine?.getAll),
    "pcb_PrimitiveLine.create": Boolean(eda.pcb_PrimitiveLine?.create),
    "pcb_PrimitiveLine.modify": Boolean(eda.pcb_PrimitiveLine?.modify),
    "pcb_PrimitiveLine.delete": Boolean(eda.pcb_PrimitiveLine?.delete),
    "pcb_PrimitiveArc.getAll": Boolean(eda.pcb_PrimitiveArc?.getAll),
    "pcb_PrimitivePolyline.getAll": Boolean(eda.pcb_PrimitivePolyline?.getAll),
    "pcb_PrimitiveRegion.getAll": Boolean(eda.pcb_PrimitiveRegion?.getAll),
    "pcb_ManufactureData.getPickAndPlaceFile": Boolean(eda.pcb_ManufactureData?.getPickAndPlaceFile),
    "pcb_ManufactureData.getGerberFile": Boolean(eda.pcb_ManufactureData?.getGerberFile),
    "pcb_ManufactureData.getBomFile": Boolean(eda.pcb_ManufactureData?.getBomFile),

    // Schematic APIs
    "sch_PrimitiveComponent.getAll": Boolean(eda.sch_PrimitiveComponent?.getAll),
    "sch_PrimitiveComponent.get": Boolean(eda.sch_PrimitiveComponent?.get),
    "sch_PrimitiveComponent.create": Boolean(eda.sch_PrimitiveComponent?.create),
    "sch_PrimitiveComponent.modify": Boolean(eda.sch_PrimitiveComponent?.modify),
    "sch_PrimitiveComponent.delete": Boolean(eda.sch_PrimitiveComponent?.delete),
    "sch_PrimitiveComponent.createNetFlag": Boolean(eda.sch_PrimitiveComponent?.createNetFlag),
    "sch_PrimitiveWire.create": Boolean(eda.sch_PrimitiveWire?.create),
    "sch_PrimitiveWire.modify": Boolean(eda.sch_PrimitiveWire?.modify),
    "sch_PrimitiveWire.delete": Boolean(eda.sch_PrimitiveWire?.delete),
    "sch_PrimitiveWire.getAll": Boolean(eda.sch_PrimitiveWire?.getAll),
    "sch_PrimitiveWire.get": Boolean(eda.sch_PrimitiveWire?.get),
    "sch_PrimitiveAttribute.createNetLabel": Boolean(eda.sch_PrimitiveAttribute?.createNetLabel),
    "sch_Document.getAllPrimitiveId": Boolean(eda.sch_Document?.getAllPrimitiveId),
    "sch_ManufactureData.getBomFile": Boolean(eda.sch_ManufactureData?.getBomFile),
    "sch_Net.getAllNetsName": Boolean(
      eda.sch_Net?.getAllNetsName || eda.sch_Net?.getAllNetName || eda.sch_Net?.getAllNets
    ),
    "sch_Drc.check": Boolean(eda.sch_Drc?.check),
    "sch_Netlist.getNetlist": Boolean(eda.sch_Netlist?.getNetlist),

    // Libraries & System
    "lib_Device.search": Boolean(eda.lib_Device?.search || eda.lib_Search?.search),
    "sys_WebSocket.register": Boolean(eda.sys_WebSocket?.register),
    "sys_WebSocket.send": Boolean(eda.sys_WebSocket?.send),
    "sys_FileSystem.saveFile": Boolean(eda.sys_FileSystem?.saveFile),
    "sys_Dialog.showInformationMessage": Boolean(eda.sys_Dialog?.showInformationMessage)
  };
}
