import { describe, expect, it } from "vitest";
import { detectMethodCapabilities, extractDocumentIdentity } from "./identity.js";
import type { EasyEdaApi } from "./types.js";

describe("extension document identity and capabilities", () => {
  it("extracts full document identity when project and document are identified", () => {
    const docInfo = {
      uuid: "doc-abc-123",
      name: "PowerSupply.PCB",
      documentType: 3,
      parentProjectUuid: "proj-xyz-789",
      projectName: "Switching Regulator",
      tabId: "tab-main"
    };

    const identity = extractDocumentIdentity(docInfo);
    expect(identity.documentId).toBe("doc-abc-123");
    expect(identity.documentName).toBe("PowerSupply.PCB");
    expect(identity.documentType).toBe("pcb");
    expect(identity.projectId).toBe("proj-xyz-789");
    expect(identity.projectName).toBe("Switching Regulator");
    expect(identity.tabId).toBe("tab-main");
    expect(identity.completeness).toBe("full");
    expect(identity.source).toBe("native_api");
    expect(identity.fingerprint).toBe("proj-xyz-789::doc-abc-123::pcb::tab-main::*");
  });

  it("extracts page information for multipage schematics", () => {
    const docInfo = {
      uuid: "doc-sch-01",
      name: "CPU.SCH",
      documentType: 1,
      parentProjectUuid: "proj-cpu"
    };
    const pageInfo = {
      pageId: "sheet-2",
      pageIndex: 1
    };

    const identity = extractDocumentIdentity(docInfo, pageInfo);
    expect(identity.documentType).toBe("schematic");
    expect(identity.pageId).toBe("sheet-2");
    expect(identity.pageIndex).toBe(1);
    expect(identity.fingerprint).toBe("proj-cpu::doc-sch-01::schematic::*::sheet-2");
  });

  it("marks empty completeness when document info is null or undefined", () => {
    const identity = extractDocumentIdentity(undefined);
    expect(identity.completeness).toBe("empty");
    expect(identity.documentType).toBe("unknown");
    expect(identity.fingerprint).toBe("*::*::unknown::*::*");
  });

  it("marks partial completeness when only partial fields are available", () => {
    const identity = extractDocumentIdentity({ name: "Untitled.SCH" });
    expect(identity.completeness).toBe("partial");
    expect(identity.documentName).toBe("Untitled.SCH");
  });

  it("detects method capabilities accurately from api object", () => {
    const fakeApi: EasyEdaApi = {
      dmt_SelectControl: {
        getCurrentDocumentInfo: async () => ({})
      },
      pcb_Drc: {
        getCurrentRuleConfiguration: async () => ({}),
        overwriteCurrentRuleConfiguration: async () => true
      },
      sys_WebSocket: {
        register: () => {},
        send: () => {}
      }
    };

    const caps = detectMethodCapabilities(() => fakeApi);
    expect(caps["dmt_SelectControl.getCurrentDocumentInfo"]).toBe(true);
    expect(caps["pcb_Drc.getCurrentRuleConfiguration"]).toBe(true);
    expect(caps["pcb_Drc.overwriteCurrentRuleConfiguration"]).toBe(true);
    expect(caps["pcb_Drc.check"]).toBe(false);
    expect(caps["pcb_Drc.getErrors"]).toBe(false);
    expect(caps["pcb_Drc.clearErrors"]).toBe(false);
    expect(caps["pcb_PrimitiveComponent.getAll"]).toBe(false);
    expect(caps["pcb_PrimitivePad.getAll"]).toBe(false);
    expect(caps["sch_Document.getAllPrimitiveId"]).toBe(false);
    expect(caps["sch_Net.getAllNetsName"]).toBe(false);
    expect(caps["sch_Drc.check"]).toBe(false);
    expect(caps["sys_WebSocket.register"]).toBe(true);
  });
});
