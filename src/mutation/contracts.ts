import * as z from "zod/v4";
import type { DocumentIdentity } from "../protocol/identity.js";

export type MutationStatus = "prepared" | "running" | "applied" | "failed" | "expired" | "invalidated" | "unknown";

export function canonicalJson(value: unknown, maxDepth = 40): string {
  function visit(item: unknown, depth: number): unknown {
    if (depth > maxDepth) throw new Error("JSON structure exceeds maximum depth");
    if (item === undefined) return undefined;
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (Array.isArray(item)) return item.map((v) => visit(v, depth + 1));
    if (typeof item !== "object" || !item || ![Object.prototype, null].includes(Object.getPrototypeOf(item))) {
      throw new Error("Payload must contain only finite plain JSON data");
    }
    const result: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(item).sort()) {
      if (["__proto__", "prototype", "constructor"].includes(key)) {
        throw new Error("Unsafe property name detected in mutation payload");
      }
      const visited = visit((item as Record<string, unknown>)[key], depth + 1);
      if (visited !== undefined) {
        result[key] = visited;
      }
    }
    return result;
  }
  const normalized = visit(value, 0);
  const text = JSON.stringify(normalized === undefined ? null : normalized);
  if (text.length > 2_000_000) throw new Error("Serialized mutation JSON exceeds 2,000,000 characters");
  return text;
}

export type MutationPreview<TBefore = unknown, TAfter = unknown> = {
  before: TBefore;
  requestedAfter: TAfter;
  changedKeys?: string[];
  scope: string;
  impact?: string;
};

export type MutationRecord<TOperation = Record<string, unknown>, TData = unknown> = {
  mutationId: string;
  domain: string;
  action: string;
  confirmation: string;
  operation: TOperation;
  target: DocumentIdentity;
  before: TData;
  preview: MutationPreview;
  status: MutationStatus;
  generation: number;
  createdAt: string;
  expiresAt: string;
  after?: TData;
  error?: string;
  startedAt?: string;
  timedOutAt?: string;
  settledAt?: string;
  phase?: "execute" | "readback" | "settled";
  execution?: { timeoutMs: number; elapsedMs: number; lockHeld: boolean; recovery: string };
  documentSaved: false;
};

export function formatMutationConfirmation(domain: string, action: string, mutationId: string): string {
  return `CONFIRM ${domain}:${action} ${mutationId}`;
}

export const MutationQuerySchema = z.strictObject({
  mutationId: z.string().min(1)
});

export const MutationExecutionSchema = z.strictObject({
  mutationId: z.string().min(1),
  confirmation: z.string().min(1)
});
