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
    "pcb_Document.importChanges": Boolean(eda.pcb_Document?.importChanges || (eda.sch_Document as any)?.updatePcb),
    "pcb_Document.createBoard": Boolean(
      (eda.pcb_Document as any)?.create ||
      (eda.sch_Document as any)?.createPcb ||
      (eda.dmt_Document as any)?.createBoard
    ),
    "pcb_Document.updateSchematic": Boolean(
      (eda.pcb_Document as any)?.updateSchematic || (eda.sch_Document as any)?.backAnnotate
    ),
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
    "pcb_PrimitiveTrack.getAll": Boolean(eda.pcb_PrimitiveTrack?.getAll),
    "pcb_PrimitiveTrack.create": Boolean(eda.pcb_PrimitiveTrack?.create),
    "pcb_PrimitiveTrack.modify": Boolean(eda.pcb_PrimitiveTrack?.modify),
    "pcb_PrimitiveTrack.delete": Boolean(eda.pcb_PrimitiveTrack?.delete),
    "pcb_PrimitiveVia.getAll": Boolean(eda.pcb_PrimitiveVia?.getAll),
    "pcb_PrimitiveVia.create": Boolean(eda.pcb_PrimitiveVia?.create),
    "pcb_PrimitiveVia.modify": Boolean(eda.pcb_PrimitiveVia?.modify),
    "pcb_PrimitiveVia.delete": Boolean(eda.pcb_PrimitiveVia?.delete),
    "pcb_PrimitiveLine.getAll": Boolean(eda.pcb_PrimitiveLine?.getAll),
    "pcb_PrimitiveLine.create": Boolean(eda.pcb_PrimitiveLine?.create),
    "pcb_PrimitiveLine.modify": Boolean(eda.pcb_PrimitiveLine?.modify),
    "pcb_PrimitiveLine.delete": Boolean(eda.pcb_PrimitiveLine?.delete),
    "pcb_PrimitiveArc.getAll": Boolean(eda.pcb_PrimitiveArc?.getAll),
    "pcb_PrimitivePolyline.getAll": Boolean(eda.pcb_PrimitivePolyline?.getAll),
    "pcb_PrimitiveRegion.getAll": Boolean(eda.pcb_PrimitiveRegion?.getAll),
    "pcb_PrimitiveCopperArea.getAll": Boolean((eda as any).pcb_PrimitiveCopperArea?.getAll),
    "pcb_PrimitiveCopperArea.create": Boolean((eda as any).pcb_PrimitiveCopperArea?.create),
    "pcb_PrimitiveCopperArea.modify": Boolean((eda as any).pcb_PrimitiveCopperArea?.modify),
    "pcb_PrimitiveCopperArea.delete": Boolean((eda as any).pcb_PrimitiveCopperArea?.delete),
    "pcb_PrimitiveCopperArea.rebuild": Boolean(
      (eda as any).pcb_PrimitiveCopperArea?.rebuild || (eda as any).pcb_PrimitiveCopperArea?.rebuildAll
    ),
    "pcb_PrimitiveKeepout.getAll": Boolean((eda as any).pcb_PrimitiveKeepout?.getAll),
    "pcb_PrimitiveKeepout.create": Boolean((eda as any).pcb_PrimitiveKeepout?.create),
    "pcb_PrimitiveKeepout.modify": Boolean((eda as any).pcb_PrimitiveKeepout?.modify),
    "pcb_PrimitiveKeepout.delete": Boolean((eda as any).pcb_PrimitiveKeepout?.delete),
    "pcb_PrimitiveRatsnest.getAll": Boolean(
      (eda as any).pcb_PrimitiveRatsnest?.getAll || (eda as any).pcb_PrimitiveAirwire?.getAll
    ),
    "pcb_NetClass.getAll": Boolean((eda as any).pcb_NetClass?.getAll),
    "pcb_NetClass.create": Boolean((eda as any).pcb_NetClass?.create),
    "pcb_NetClass.modify": Boolean((eda as any).pcb_NetClass?.modify),
    "pcb_NetClass.delete": Boolean((eda as any).pcb_NetClass?.delete),
    "pcb_DifferentialPair.getAll": Boolean((eda as any).pcb_DifferentialPair?.getAll),
    "pcb_DifferentialPair.create": Boolean((eda as any).pcb_DifferentialPair?.create),
    "pcb_DifferentialPair.modify": Boolean((eda as any).pcb_DifferentialPair?.modify),
    "pcb_DifferentialPair.delete": Boolean((eda as any).pcb_DifferentialPair?.delete),
    "pcb_LengthGroup.getAll": Boolean(
      (eda as any).pcb_LengthGroup?.getAll || (eda as any).pcb_EqualLengthGroup?.getAll
    ),
    "pcb_LengthGroup.create": Boolean(
      (eda as any).pcb_LengthGroup?.create || (eda as any).pcb_EqualLengthGroup?.create
    ),
    "pcb_LengthGroup.modify": Boolean(
      (eda as any).pcb_LengthGroup?.modify || (eda as any).pcb_EqualLengthGroup?.modify
    ),
    "pcb_LengthGroup.delete": Boolean(
      (eda as any).pcb_LengthGroup?.delete || (eda as any).pcb_EqualLengthGroup?.delete
    ),
    "pcb_Document.get3DView": Boolean((eda.pcb_Document as any)?.get3DView),
    "pcb_Document.export3D": Boolean(
      (eda.pcb_Document as any)?.export3D ||
      (eda.pcb_Document as any)?.exportStep ||
      (eda.pcb_ManufactureData as any)?.getStepFile
    ),
    "pcb_Document.rebuildCopper": Boolean(
      (eda.pcb_Document as any)?.rebuildAllCopperArea || (eda.pcb_Document as any)?.rebuildCopperArea
    ),
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
    "sch_PrimitiveNetPort.getAll": Boolean(eda.sch_PrimitiveNetPort?.getAll || eda.sch_PrimitivePort?.getAll),
    "sch_PrimitiveNetPort.create": Boolean(
      eda.sch_PrimitiveNetPort?.create || eda.sch_PrimitivePort?.create || eda.sch_PrimitiveComponent?.createNetFlag
    ),
    "sch_PrimitiveNetPort.modify": Boolean(eda.sch_PrimitiveNetPort?.modify || eda.sch_PrimitivePort?.modify),
    "sch_PrimitiveNetPort.delete": Boolean(eda.sch_PrimitiveNetPort?.delete || eda.sch_PrimitivePort?.delete),
    "sch_PrimitiveBus.getAll": Boolean(eda.sch_PrimitiveBus?.getAll),
    "sch_PrimitiveBus.create": Boolean(eda.sch_PrimitiveBus?.create),
    "sch_PrimitiveBus.modify": Boolean(eda.sch_PrimitiveBus?.modify),
    "sch_PrimitiveBus.delete": Boolean(eda.sch_PrimitiveBus?.delete),
    "sch_PrimitiveBusEntry.getAll": Boolean(eda.sch_PrimitiveBusEntry?.getAll),
    "sch_PrimitiveBusEntry.create": Boolean(eda.sch_PrimitiveBusEntry?.create),
    "sch_PrimitiveBusEntry.delete": Boolean(eda.sch_PrimitiveBusEntry?.delete),
    "sch_Document.getAllPrimitiveId": Boolean(eda.sch_Document?.getAllPrimitiveId),
    "sch_ManufactureData.getBomFile": Boolean(eda.sch_ManufactureData?.getBomFile),
    "sch_Net.getAllNetsName": Boolean(
      eda.sch_Net?.getAllNetsName || eda.sch_Net?.getAllNetName || eda.sch_Net?.getAllNets
    ),
    "sch_Drc.check": Boolean(eda.sch_Drc?.check),
    "sch_Netlist.getNetlist": Boolean(eda.sch_Netlist?.getNetlist),

    // Libraries & System
    "lib_Device.search": Boolean(eda.lib_Device?.search || eda.lib_Search?.search),
    "lib_Device.get": Boolean(eda.lib_Device?.get || eda.lib_Device?.getDevice),
    "lib_Symbol.get": Boolean(eda.lib_Symbol?.get || eda.lib_Symbol?.getSymbol),
    "lib_Footprint.get": Boolean(eda.lib_Footprint?.get || eda.lib_Footprint?.getFootprint),
    "sys_WebSocket.register": Boolean(eda.sys_WebSocket?.register),
    "sys_WebSocket.send": Boolean(eda.sys_WebSocket?.send),
    "sys_FileSystem.saveFile": Boolean(eda.sys_FileSystem?.saveFile),
    "sys_Dialog.showInformationMessage": Boolean(eda.sys_Dialog?.showInformationMessage)
  };
}
