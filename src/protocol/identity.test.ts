import { describe, expect, it } from "vitest";
import {
  assertDocumentTargetMatch,
  generateTargetFingerprint,
  validateDocumentTarget,
  type DocumentIdentity
} from "./identity.js";

describe("document identity and target validation", () => {
  const baseTarget: DocumentIdentity = {
    projectId: "proj-123",
    projectName: "Test Project",
    documentId: "doc-456",
    documentName: "MainBoard.PCB",
    documentType: "pcb",
    tabId: "tab-789",
    pageId: "page-1",
    capturedAt: new Date(1_000_000).toISOString(),
    completeness: "full",
    source: "native_api",
    fingerprint: "proj-123::doc-456::pcb::tab-789::page-1"
  };

  it("generates deterministic target fingerprints", () => {
    const fp1 = generateTargetFingerprint(baseTarget);
    expect(fp1).toBe("proj-123::doc-456::pcb::tab-789::page-1");

    const fpPartial = generateTargetFingerprint({ documentId: "doc-1", documentType: "schematic" });
    expect(fpPartial).toBe("*::doc-1::schematic::*::*");
  });

  it("validates identical targets successfully", () => {
    const result = validateDocumentTarget(baseTarget, { ...baseTarget });
    expect(result.valid).toBe(true);
    expect(() => assertDocumentTargetMatch(baseTarget, { ...baseTarget })).not.toThrow();
  });

  it("rejects when expected target is missing", () => {
    const result = validateDocumentTarget(undefined, baseTarget);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("missing_expected_target");
  });

  it("rejects when current target is missing", () => {
    const result = validateDocumentTarget(baseTarget, undefined);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("missing_current_target");
  });

  it("detects document ID mismatch", () => {
    const current = { ...baseTarget, documentId: "doc-other" };
    const result = validateDocumentTarget(baseTarget, current);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("document_id_mismatch");
    expect(() => assertDocumentTargetMatch(baseTarget, current)).toThrowError(/document ID changed/i);
  });

  it("detects project ID mismatch", () => {
    const current = { ...baseTarget, projectId: "proj-other" };
    const result = validateDocumentTarget(baseTarget, current);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("project_id_mismatch");
  });

  it("detects document type mismatch", () => {
    const current = { ...baseTarget, documentType: "schematic" as const };
    const result = validateDocumentTarget(baseTarget, current);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("document_type_mismatch");
  });

  it("detects tab and page mismatch when enabled", () => {
    const tabDiff = { ...baseTarget, tabId: "tab-new" };
    expect(validateDocumentTarget(baseTarget, tabDiff).valid).toBe(true);
    expect(validateDocumentTarget(baseTarget, tabDiff, { requireTabMatch: true }).code).toBe("tab_id_mismatch");

    const pageDiff = { ...baseTarget, pageId: "page-2" };
    expect(validateDocumentTarget(baseTarget, pageDiff).valid).toBe(true);
    expect(validateDocumentTarget(baseTarget, pageDiff, { requirePageMatch: true }).code).toBe("page_id_mismatch");
  });

  it("detects expired captures when maxAgeMs is specified", () => {
    const now = 1_000_000 + 60_000;
    const result = validateDocumentTarget(baseTarget, baseTarget, {
      maxAgeMs: 30_000,
      nowMs: now
    });
    expect(result.valid).toBe(false);
    expect(result.code).toBe("capture_expired");
  });
});
