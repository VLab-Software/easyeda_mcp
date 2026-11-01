declare const eda: Record<string, any>;

export type BridgeErrorMessage = {
  kind: "error";
  requestId: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function simplifyPrimitive(value: unknown): Record<string, unknown> {
  const item = sanitize(value) as Record<string, unknown>;
  return {
    primitiveId: item.primitiveId ?? item.id ?? item.uuid,
    designator: item.designator ?? item.name ?? item.displayName ?? item.prefix,
    value: item.value ?? item.comment ?? item.title,
    footprint: item.footprint ?? item.package ?? item.packageName,
    x: item.x,
    y: item.y,
    layer: item.layer,
    raw: item
  };
}

export function normalizeBBox(value: unknown): { left: number; right: number; top: number; bottom: number } | undefined {
  const item = Array.isArray(value) ? value[0] : value;
  if (!item || typeof item !== "object") {
    return undefined;
  }
  const box = item as Record<string, unknown>;
  const left = numeric(box.left ?? box.minX ?? box.x1);
  const right = numeric(box.right ?? box.maxX ?? box.x2);
  const top = numeric(box.top ?? box.minY ?? box.y1);
  const bottom = numeric(box.bottom ?? box.maxY ?? box.y2);
  if ([left, right, top, bottom].every((num) => num !== undefined)) {
    return { left, right, top, bottom } as { left: number; right: number; top: number; bottom: number };
  }
  return undefined;
}

export function ensureApi(objectName: string, methodName: string): void {
  if (!eda[objectName]?.[methodName]) {
    throw apiError("api_unavailable", `EasyEDA Pro API eda.${objectName}.${methodName} is unavailable in this context.`);
  }
}

export function apiError(code: string, message: string, details?: unknown): Error & { code: string; details?: unknown } {
  const error = new Error(message) as Error & { code: string; details?: unknown };
  error.code = code;
  error.details = details;
  return error;
}

export function normalizeError(error: unknown): BridgeErrorMessage["error"] {
  if (error instanceof Error) {
    const coded = error as Error & { code?: string; details?: unknown };
    return {
      code: coded.code ?? "easyeda_extension_error",
      message: error.message,
      details: sanitize(coded.details)
    };
  }
  return {
    code: "easyeda_extension_error",
    message: String(error)
  };
}

export async function optionalCall<T>(fn: () => T | Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    log("warn", "Optional EasyEDA API call failed", error);
    return undefined;
  }
}

export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) {
    return "[MaxDepth]";
  }
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  if (typeof File !== "undefined" && value instanceof File) {
    return {
      name: value.name,
      size: value.size,
      type: value.type
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 200).map((item) => sanitize(item, depth + 1));
  }
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
    if (typeof item !== "function") {
      output[key] = sanitize(item, depth + 1);
    }
  }
  return output;
}

export function pickString(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string") {
      return record[key] as string;
    }
  }
  return undefined;
}

export function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function inferDocumentType(documentInfo: unknown): string {
  const record = isRecord(documentInfo) ? documentInfo : undefined;
  const numericType = record
    ? [
      record.documentType,
      record.doctype,
      record.type
    ].find((value) => typeof value === "number")
    : undefined;

  if (numericType === 1) return "schematic";
  if (numericType === 3) return "pcb";
  if (numericType === 2) return "symbol";
  if (numericType === 4) return "footprint";

  const raw = JSON.stringify(documentInfo ?? {}).toLowerCase();
  if (raw.includes("pcb")) return "pcb";
  if (raw.includes("sch") || raw.includes("schematic")) return "schematic";
  if (raw.includes("footprint")) return "footprint";
  if (raw.includes("symbol")) return "symbol";
  return "unknown";
}

export function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function numeric(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function log(level: "warn" | "error", message: string, details?: unknown): void {
  if (eda.sys_Log?.[level]) {
    eda.sys_Log[level](`[easyeda-mcp] ${message}`, details);
    return;
  }
  console[level](`[easyeda-mcp] ${message}`, details);
}

export function showMessage(title: string, message: string): void {
  if (eda.sys_Dialog?.showInformationMessage) {
    eda.sys_Dialog.showInformationMessage(message, title);
    return;
  }
  log("warn", `${title}: ${message}`);
}
