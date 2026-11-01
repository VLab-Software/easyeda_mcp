import { describe, expect, it, vi } from "vitest";
import {
  collectTabsFromTree,
  convertBlobToDataUrl,
  createDocumentHandlers,
  extractProjectDocuments
} from "./documentHandlers.js";

describe("Extension Document Handlers", () => {
  describe("collectTabsFromTree", () => {
    it("extracts tabs from nested split screen tree", () => {
      const tree = {
        id: "root-split",
        tabs: [{ tabId: "tab-1", documentUuid: "doc-1", title: "Main.PcbDoc", documentType: 3 }],
        children: [
          {
            id: "child-split",
            tabs: [{ id: "tab-2", uuid: "doc-2", name: "Power.SchDoc", documentType: 1 }]
          }
        ]
      };

      const tabs = collectTabsFromTree(tree);
      expect(tabs).toHaveLength(2);
      expect(tabs[0]).toEqual({
        tabId: "tab-1",
        documentUuid: "doc-1",
        title: "Main.PcbDoc",
        documentType: 3,
        splitScreenId: "root-split"
      });
      expect(tabs[1]).toEqual({
        tabId: "tab-2",
        documentUuid: "doc-2",
        title: "Power.SchDoc",
        documentType: 1,
        splitScreenId: "child-split"
      });
    });

    it("returns empty array for invalid tree", () => {
      expect(collectTabsFromTree(null)).toEqual([]);
      expect(collectTabsFromTree(undefined)).toEqual([]);
    });
  });

  describe("extractProjectDocuments", () => {
    it("recursively collects project documents", () => {
      const data = [
        {
          uuid: "sch-1",
          name: "Sheet1.SchDoc",
          documentType: 1,
          children: [{ uuid: "sch-2", name: "Sheet2.SchDoc", documentType: 1 }]
        },
        {
          uuid: "pcb-1",
          name: "Board.PcbDoc",
          documentType: 3
        }
      ];

      const docs = extractProjectDocuments(data);
      expect(docs.map((d) => d.uuid)).toEqual(["sch-1", "sch-2", "pcb-1"]);
    });
  });

  describe("convertBlobToDataUrl", () => {
    it("handles data url strings directly", async () => {
      const res = await convertBlobToDataUrl("data:image/png;base64,QUJD");
      expect(res.dataUrl).toBe("data:image/png;base64,QUJD");
      expect(res.base64).toBe("QUJD");
    });

    it("handles raw base64 strings", async () => {
      const res = await convertBlobToDataUrl("QUJD");
      expect(res.dataUrl).toBe("data:image/png;base64,QUJD");
      expect(res.base64).toBe("QUJD");
    });

    it("handles object with arrayBuffer", async () => {
      const bytes = new Uint8Array([65, 66, 67]); // "ABC"
      const blobLike = {
        type: "image/png",
        arrayBuffer: async () => bytes.buffer
      };
      const res = await convertBlobToDataUrl(blobLike);
      expect(res.base64).toBe("QUJD");
      expect(res.dataUrl).toBe("data:image/png;base64,QUJD");
    });
  });

  describe("createDocumentHandlers", () => {
    it("lists project documents and correlates open tabs and active document", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "doc-pcb",
            name: "Main.PcbDoc",
            documentType: 3,
            tabId: "tab-1",
            parentProjectUuid: "proj-1",
            projectName: "TestProject"
          }))
        },
        dmt_Project: {
          getCurrentProjectInfo: vi.fn(async () => ({
            uuid: "proj-1",
            name: "TestProject",
            data: [
              { uuid: "doc-pcb", name: "Main.PcbDoc", documentType: 3 },
              { uuid: "doc-sch", name: "Power.SchDoc", documentType: 1 }
            ]
          }))
        },
        dmt_EditorControl: {
          getSplitScreenTree: vi.fn(async () => ({
            id: "screen-1",
            tabs: [{ tabId: "tab-1", documentUuid: "doc-pcb", title: "Main.PcbDoc", documentType: 3 }]
          })),
          openDocument: vi.fn(),
          activateDocument: vi.fn(),
          getCurrentRenderedAreaImage: vi.fn()
        }
      });

      const handlers = createDocumentHandlers(api);
      const result = (await handlers.listDocuments({})) as any;

      expect(result.total).toBe(2);
      expect(result.openCount).toBe(1);
      expect(result.activeDocument.documentId).toBe("doc-pcb");
      expect(result.capabilities).toEqual({
        canOpenDocument: true,
        canActivateDocument: true,
        canRenderView: true
      });

      const pcb = result.documents.find((d: any) => d.documentId === "doc-pcb");
      const sch = result.documents.find((d: any) => d.documentId === "doc-sch");
      expect(pcb).toMatchObject({ isOpen: true, isActive: true, tabId: "tab-1" });
      expect(sch).toMatchObject({ isOpen: false, isActive: false });
    });

    it("activates an existing tab when opening an already open document", async () => {
      let activeDoc: any = {
        uuid: "doc-pcb",
        name: "Main.PcbDoc",
        documentType: 3,
        tabId: "tab-1"
      };

      const activateDocumentMock = vi.fn(async (tabId: string) => {
        if (tabId === "tab-2") {
          activeDoc = {
            uuid: "doc-sch",
            name: "Power.SchDoc",
            documentType: 1,
            tabId: "tab-2"
          };
        }
      });

      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => activeDoc)
        },
        dmt_EditorControl: {
          getSplitScreenTree: vi.fn(async () => ({
            id: "screen-1",
            tabs: [
              { tabId: "tab-1", documentUuid: "doc-pcb", title: "Main.PcbDoc", documentType: 3 },
              { tabId: "tab-2", documentUuid: "doc-sch", title: "Power.SchDoc", documentType: 1 }
            ]
          })),
          activateDocument: activateDocumentMock
        }
      });

      const handlers = createDocumentHandlers(api);
      const result = (await handlers.openDocument({ documentId: "doc-sch" })) as any;

      expect(activateDocumentMock).toHaveBeenCalledWith("tab-2");
      expect(result.opened).toBe(true);
      expect(result.methodUsed).toBe("activateDocument");
      expect(result.focusChanged).toBe(true);
      expect(result.readbackConfirmed).toBe(true);
      expect(result.currentTarget.documentId).toBe("doc-sch");
    });

    it("opens a new document tab when not currently open", async () => {
      let activeDoc: any = {
        uuid: "doc-pcb",
        name: "Main.PcbDoc",
        documentType: 3,
        tabId: "tab-1"
      };

      const openDocumentMock = vi.fn(async (uuid: string) => {
        activeDoc = {
          uuid,
          name: "NewSheet.SchDoc",
          documentType: 1,
          tabId: "tab-new"
        };
      });

      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => activeDoc)
        },
        dmt_EditorControl: {
          getSplitScreenTree: vi.fn(async () => ({
            id: "screen-1",
            tabs: [{ tabId: "tab-1", documentUuid: "doc-pcb", title: "Main.PcbDoc", documentType: 3 }]
          })),
          openDocument: openDocumentMock
        }
      });

      const handlers = createDocumentHandlers(api);
      const result = (await handlers.openDocument({ documentId: "doc-new-sheet" })) as any;

      expect(openDocumentMock).toHaveBeenCalledWith("doc-new-sheet", undefined);
      expect(result.opened).toBe(true);
      expect(result.methodUsed).toBe("openDocument");
      expect(result.focusChanged).toBe(true);
      expect(result.readbackConfirmed).toBe(true);
    });

    it("throws capability_unavailable when editor control lacks open and activate methods", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({ uuid: "doc-1" }))
        },
        dmt_EditorControl: {}
      });

      const handlers = createDocumentHandlers(api);
      await expect(handlers.openDocument({ documentId: "doc-2" })).rejects.toThrow(/not available/);
    });

    it("renders document view when capability is supported", async () => {
      const bytes = new Uint8Array([1, 2, 3]);
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "doc-1",
            name: "Main.PcbDoc",
            documentType: 3,
            tabId: "tab-1"
          }))
        },
        dmt_EditorControl: {
          getCurrentRenderedAreaImage: vi.fn(async () => ({
            type: "image/png",
            arrayBuffer: async () => bytes.buffer
          }))
        }
      });

      const handlers = createDocumentHandlers(api);
      const result = (await handlers.renderDocumentView({})) as any;

      expect(result.target.documentId).toBe("doc-1");
      expect(result.tabId).toBe("tab-1");
      expect(result.viewport.type).toBe("visible_canvas_area");
      expect(result.viewport.limits).toHaveLength(3);
      expect(result.dataUrl).toContain("data:image/png;base64,");
    });

    it("enforces target validation on renderDocumentView and rejects on target mismatch", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "doc-current",
            name: "Main.PcbDoc",
            documentType: 3
          }))
        },
        dmt_EditorControl: {
          getCurrentRenderedAreaImage: vi.fn()
        }
      });

      const handlers = createDocumentHandlers(api);
      await expect(
        handlers.renderDocumentView({
          target: { documentId: "expected-other-doc" }
        })
      ).rejects.toThrow(/Active document ID changed/);
    });

    it("throws capability_unavailable on renderDocumentView when getCurrentRenderedAreaImage is missing", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "doc-1",
            name: "Main.PcbDoc",
            documentType: 3
          }))
        },
        dmt_EditorControl: {}
      });

      const handlers = createDocumentHandlers(api);
      await expect(handlers.renderDocumentView({})).rejects.toThrow(/not supported/);
    });
  });
});
