import { apiError, inferDocumentType, isRecord, optionalCall, sanitize, toArray } from "../helpers.js";
import { assertDocumentTargetMatch, extractDocumentIdentity, type DocumentIdentity } from "../identity.js";
import type { EasyEdaApi, RpcHandler } from "../types.js";

export type NormalizedDocumentItem = {
  documentId: string;
  documentName?: string;
  documentType: string;
  projectId?: string;
  projectName?: string;
  isOpen: boolean;
  isActive: boolean;
  tabId?: string;
  splitScreenId?: string;
  identity: DocumentIdentity;
};

export type OpenTabItem = {
  tabId: string;
  documentUuid: string;
  title?: string;
  documentType?: unknown;
  splitScreenId?: string;
};

export function collectTabsFromTree(node: unknown, splitScreenId?: string): OpenTabItem[] {
  const tabs: OpenTabItem[] = [];
  if (!isRecord(node)) return tabs;

  const currentSplitId = typeof node.id === "string" ? node.id : (splitScreenId ?? "root");

  if (Array.isArray(node.tabs)) {
    for (const tab of node.tabs) {
      if (isRecord(tab)) {
        const tabId = typeof tab.tabId === "string" ? tab.tabId : typeof tab.id === "string" ? tab.id : "";
        const documentUuid =
          typeof tab.documentUuid === "string" ? tab.documentUuid : typeof tab.uuid === "string" ? tab.uuid : "";
        tabs.push({
          tabId,
          documentUuid,
          title: typeof tab.title === "string" ? tab.title : typeof tab.name === "string" ? tab.name : undefined,
          documentType: tab.documentType,
          splitScreenId: currentSplitId
        });
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      tabs.push(...collectTabsFromTree(child, typeof child?.id === "string" ? child.id : currentSplitId));
    }
  }

  return tabs;
}

export function extractProjectDocuments(projectData: unknown): Record<string, unknown>[] {
  const docs: Record<string, unknown>[] = [];
  const items = toArray(projectData);

  for (const item of items) {
    if (!isRecord(item)) continue;
    const docUuid = item.uuid ?? item.documentUuid ?? item.id;
    if (docUuid) {
      docs.push(item);
    }
    if (Array.isArray(item.children)) {
      docs.push(...extractProjectDocuments(item.children));
    }
    if (Array.isArray(item.data)) {
      docs.push(...extractProjectDocuments(item.data));
    }
  }

  return docs;
}

export async function convertBlobToDataUrl(blob: unknown): Promise<{ dataUrl: string; base64: string }> {
  if (typeof blob === "string") {
    if (blob.startsWith("data:")) {
      const base64 = blob.split(",")[1] ?? "";
      return { dataUrl: blob, base64 };
    }
    return { dataUrl: `data:image/png;base64,${blob}`, base64: blob };
  }

  const anyBlob = blob as any;
  if (anyBlob && typeof anyBlob.arrayBuffer === "function") {
    const buffer = await anyBlob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
    const mime = anyBlob.type || "image/png";
    return { dataUrl: `data:${mime};base64,${base64}`, base64 };
  }

  if (typeof FileReader !== "undefined" && anyBlob instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1] ?? "";
        resolve({ dataUrl, base64 });
      };
      reader.onerror = reject;
      reader.readAsDataURL(anyBlob);
    });
  }

  throw apiError("invalid_image_blob", "Returned canvas image is not a valid Blob or string representation.");
}

export function createDocumentHandlers(api: () => EasyEdaApi): Record<string, RpcHandler> {
  async function listDocuments(): Promise<Record<string, unknown>> {
    const eda = api();
    const activeDocInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const activeIdentity = extractDocumentIdentity(activeDocInfo);

    const projectInfo = await optionalCall(() => eda.dmt_Project?.getCurrentProjectInfo?.());
    const splitScreenTree = await optionalCall(() => eda.dmt_EditorControl?.getSplitScreenTree?.());
    const openTabs = collectTabsFromTree(splitScreenTree);

    const docMap = new Map<string, NormalizedDocumentItem>();

    // 1. Ingest documents from project structure
    if (isRecord(projectInfo)) {
      const rawProjectDocs = extractProjectDocuments(projectInfo.data);
      for (const rawDoc of rawProjectDocs) {
        const docId = String(rawDoc.uuid ?? rawDoc.documentUuid ?? rawDoc.id ?? "");
        if (!docId) continue;

        const docIdentity = extractDocumentIdentity({
          ...rawDoc,
          parentProjectUuid: projectInfo.uuid ?? rawDoc.parentProjectUuid,
          projectName: projectInfo.name ?? rawDoc.projectName
        });

        docMap.set(docId, {
          documentId: docId,
          documentName: docIdentity.documentName,
          documentType: docIdentity.documentType,
          projectId: docIdentity.projectId,
          projectName: docIdentity.projectName,
          isOpen: false,
          isActive: false,
          identity: docIdentity
        });
      }
    }

    // 2. Correlate with open tabs
    for (const tab of openTabs) {
      if (!tab.documentUuid) continue;
      const existing = docMap.get(tab.documentUuid);
      const isCurrentActive =
        activeIdentity.documentId === tab.documentUuid ||
        (Boolean(activeIdentity.tabId) && activeIdentity.tabId === tab.tabId);

      if (existing) {
        existing.isOpen = true;
        existing.isActive = isCurrentActive;
        existing.tabId = tab.tabId;
        existing.splitScreenId = tab.splitScreenId;
        if (isCurrentActive) {
          existing.identity = activeIdentity;
        }
      } else {
        const docIdentity = extractDocumentIdentity({
          uuid: tab.documentUuid,
          name: tab.title,
          documentType: tab.documentType,
          tabId: tab.tabId,
          parentProjectUuid: activeIdentity.projectId,
          projectName: activeIdentity.projectName
        });
        docMap.set(tab.documentUuid, {
          documentId: tab.documentUuid,
          documentName: tab.title ?? docIdentity.documentName,
          documentType: inferDocumentType({ documentType: tab.documentType }) as string,
          projectId: activeIdentity.projectId,
          projectName: activeIdentity.projectName,
          isOpen: true,
          isActive: isCurrentActive,
          tabId: tab.tabId,
          splitScreenId: tab.splitScreenId,
          identity: isCurrentActive ? activeIdentity : docIdentity
        });
      }
    }

    // 3. Ensure active document is present if not already added
    if (activeIdentity.documentId && !docMap.has(activeIdentity.documentId)) {
      docMap.set(activeIdentity.documentId, {
        documentId: activeIdentity.documentId,
        documentName: activeIdentity.documentName,
        documentType: activeIdentity.documentType,
        projectId: activeIdentity.projectId,
        projectName: activeIdentity.projectName,
        isOpen: true,
        isActive: true,
        tabId: activeIdentity.tabId,
        identity: activeIdentity
      });
    }

    const documents = Array.from(docMap.values());

    return {
      activeDocument: activeIdentity,
      project: isRecord(projectInfo)
        ? {
            uuid: projectInfo.uuid,
            name: projectInfo.name
          }
        : undefined,
      total: documents.length,
      openCount: documents.filter((d) => d.isOpen).length,
      documents: sanitize(documents),
      capabilities: {
        canOpenDocument: Boolean(eda.dmt_EditorControl?.openDocument),
        canActivateDocument: Boolean(eda.dmt_EditorControl?.activateDocument),
        canRenderView: Boolean(eda.dmt_EditorControl?.getCurrentRenderedAreaImage)
      }
    };
  }

  async function openDocument(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    const targetDocId = String(params.documentId ?? params.target?.documentId ?? params.uuid ?? "");
    const targetTabId = String(params.tabId ?? params.target?.tabId ?? "");
    const splitScreenId = params.splitScreenId ? String(params.splitScreenId) : undefined;
    const activate = params.activate !== false;

    if (!targetDocId && !targetTabId) {
      throw apiError("invalid_params", "Either documentId or tabId must be provided to open a document.");
    }

    const previousDocInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const previousTarget = extractDocumentIdentity(previousDocInfo);

    // Look for existing tab
    const splitScreenTree = await optionalCall(() => eda.dmt_EditorControl?.getSplitScreenTree?.());
    const openTabs = collectTabsFromTree(splitScreenTree);
    const existingTab = openTabs.find(
      (t) => (targetTabId && t.tabId === targetTabId) || (targetDocId && t.documentUuid === targetDocId)
    );

    let methodUsed: string;

    if (existingTab && activate && eda.dmt_EditorControl?.activateDocument) {
      methodUsed = "activateDocument";
      await eda.dmt_EditorControl.activateDocument(existingTab.tabId);
    } else if (eda.dmt_EditorControl?.openDocument) {
      methodUsed = "openDocument";
      const docUuidToOpen = targetDocId || existingTab?.documentUuid;
      if (!docUuidToOpen) {
        throw apiError("document_not_found", `Could not resolve document UUID for tabId ${targetTabId}.`);
      }
      await eda.dmt_EditorControl.openDocument(docUuidToOpen, splitScreenId);
    } else if (existingTab && eda.dmt_EditorControl?.activateDocument) {
      methodUsed = "activateDocument";
      await eda.dmt_EditorControl.activateDocument(existingTab.tabId);
    } else {
      throw apiError(
        "capability_unavailable",
        "Document opening or tab switching (dmt_EditorControl.openDocument / activateDocument) is not available in the connected EasyEDA Pro version."
      );
    }

    // Readback verification
    const currentDocInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const currentTarget = extractDocumentIdentity(currentDocInfo);

    const focusChanged =
      previousTarget.documentId !== currentTarget.documentId ||
      (Boolean(previousTarget.tabId) && Boolean(currentTarget.tabId) && previousTarget.tabId !== currentTarget.tabId);

    const readbackConfirmed = Boolean(
      currentTarget.documentId && (!targetDocId || currentTarget.documentId === targetDocId)
    );

    return {
      opened: true,
      methodUsed,
      documentId: targetDocId || currentTarget.documentId,
      tabId: currentTarget.tabId ?? existingTab?.tabId,
      previousTarget,
      currentTarget,
      focusChanged,
      readbackConfirmed,
      viewport: {
        note: "Opening or activating a document alters editor input focus and displays the document canvas viewport."
      }
    };
  }

  async function renderDocumentView(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    const currentDocInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const currentTarget = extractDocumentIdentity(currentDocInfo);

    // Validate target if caller specified target expectation
    if (params.target) {
      assertDocumentTargetMatch(params.target, currentTarget);
    }

    if (!eda.dmt_EditorControl?.getCurrentRenderedAreaImage) {
      throw apiError(
        "capability_unavailable",
        "Canvas viewport rendering (dmt_EditorControl.getCurrentRenderedAreaImage) is not supported by the connected EasyEDA Pro version."
      );
    }

    const targetTabId = params.tabId ?? currentTarget.tabId;
    const rawImageBlob = await eda.dmt_EditorControl.getCurrentRenderedAreaImage(targetTabId);

    if (!rawImageBlob) {
      throw apiError("capture_empty", "getCurrentRenderedAreaImage returned no image data.");
    }

    const { dataUrl, base64 } = await convertBlobToDataUrl(rawImageBlob);

    return {
      target: currentTarget,
      tabId: targetTabId,
      mimeType: "image/png",
      base64,
      dataUrl,
      viewport: {
        type: "visible_canvas_area",
        limits: [
          "Captures only the currently rendered area of the active canvas viewport, not off-screen primitives.",
          "Resolution and scale correspond directly to the current zoom and viewport dimensions in EasyEDA Pro.",
          "Requires the editor canvas engine to have completed paint execution."
        ]
      }
    };
  }

  return {
    listDocuments,
    openDocument,
    renderDocumentView
  };
}
