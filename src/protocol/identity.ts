export type DocumentType = "schematic" | "pcb" | "symbol" | "footprint" | "unknown";

export type DataCompleteness = "full" | "partial" | "empty";

export type DataSource = "native_api" | "inferred" | "cache" | "simulated";

export type DocumentIdentity = {
  projectId?: string;
  projectName?: string;
  documentId?: string;
  documentName?: string;
  documentType: DocumentType;
  tabId?: string;
  pageId?: string;
  pageIndex?: number;
  capturedAt: string;
  completeness: DataCompleteness;
  source: DataSource;
  fingerprint: string;
};

export type TargetMatchFailureReason =
  | "missing_expected_target"
  | "missing_current_target"
  | "document_id_mismatch"
  | "project_id_mismatch"
  | "tab_id_mismatch"
  | "page_id_mismatch"
  | "document_type_mismatch"
  | "capture_expired";

export type TargetValidationResult = {
  valid: boolean;
  code?: TargetMatchFailureReason;
  reason?: string;
};

export function generateTargetFingerprint(
  identity: Partial<Pick<DocumentIdentity, "projectId" | "documentId" | "documentType" | "tabId" | "pageId">>
): string {
  const parts = [
    identity.projectId ?? "*",
    identity.documentId ?? "*",
    identity.documentType ?? "unknown",
    identity.tabId ?? "*",
    identity.pageId ?? "*"
  ];
  return parts.join("::");
}

export function validateDocumentTarget(
  expected: Partial<DocumentIdentity> | undefined,
  current: Partial<DocumentIdentity> | undefined,
  options?: {
    maxAgeMs?: number;
    nowMs?: number;
    requireTabMatch?: boolean;
    requirePageMatch?: boolean;
  }
): TargetValidationResult {
  if (!expected) {
    return {
      valid: false,
      code: "missing_expected_target",
      reason: "Expected document target was not provided."
    };
  }

  if (!current) {
    return {
      valid: false,
      code: "missing_current_target",
      reason: "Current document target is unavailable or no document is open."
    };
  }

  if (options?.maxAgeMs && expected.capturedAt) {
    const captureTime = Date.parse(expected.capturedAt);
    const now = options.nowMs ?? Date.now();
    if (!Number.isNaN(captureTime) && now - captureTime > options.maxAgeMs) {
      return {
        valid: false,
        code: "capture_expired",
        reason: `Target capture has expired (age: ${Math.round((now - captureTime) / 1000)}s, max: ${Math.round(options.maxAgeMs / 1000)}s).`
      };
    }
  }

  if (expected.documentId && current.documentId && expected.documentId !== current.documentId) {
    return {
      valid: false,
      code: "document_id_mismatch",
      reason: `Active document ID changed (expected: '${expected.documentId}', current: '${current.documentId}').`
    };
  }

  if (expected.projectId && current.projectId && expected.projectId !== current.projectId) {
    return {
      valid: false,
      code: "project_id_mismatch",
      reason: `Active project ID changed (expected: '${expected.projectId}', current: '${current.projectId}').`
    };
  }

  if (options?.requireTabMatch && expected.tabId && current.tabId && expected.tabId !== current.tabId) {
    return {
      valid: false,
      code: "tab_id_mismatch",
      reason: `Active editor tab changed (expected: '${expected.tabId}', current: '${current.tabId}').`
    };
  }

  if (options?.requirePageMatch && expected.pageId && current.pageId && expected.pageId !== current.pageId) {
    return {
      valid: false,
      code: "page_id_mismatch",
      reason: `Active schematic page changed (expected: '${expected.pageId}', current: '${current.pageId}').`
    };
  }

  if (
    expected.documentType &&
    expected.documentType !== "unknown" &&
    current.documentType &&
    current.documentType !== "unknown" &&
    expected.documentType !== current.documentType
  ) {
    return {
      valid: false,
      code: "document_type_mismatch",
      reason: `Document type changed (expected: '${expected.documentType}', current: '${current.documentType}').`
    };
  }

  return { valid: true };
}

export function assertDocumentTargetMatch(
  expected: Partial<DocumentIdentity> | undefined,
  current: Partial<DocumentIdentity> | undefined,
  options?: {
    maxAgeMs?: number;
    nowMs?: number;
    requireTabMatch?: boolean;
    requirePageMatch?: boolean;
  }
): void {
  const result = validateDocumentTarget(expected, current, options);
  if (!result.valid) {
    const error = new Error(result.reason ?? "Document target mismatch") as Error & {
      code: TargetMatchFailureReason;
    };
    error.code = result.code ?? "missing_expected_target";
    throw error;
  }
}
