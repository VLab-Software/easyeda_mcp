import { assertDocumentTargetMatch, type DocumentIdentity } from "../protocol/identity.js";
import { canonicalJson, formatMutationConfirmation, type MutationPreview, type MutationRecord } from "./contracts.js";

function copy<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

export type PrepareMutationOptions<TOperation = Record<string, unknown>, TData = unknown> = {
  domain: string;
  action: string;
  target: DocumentIdentity;
  operation: TOperation;
  before: TData;
  requestedAfter: unknown;
  changedKeys?: string[];
  scope: string;
  impact?: string;
  ttlMs?: number;
};

export type ApplyMutationOptions<TData = unknown> = {
  mutationId: string;
  confirmation: string;
  currentTarget: DocumentIdentity;
  currentBefore: TData;
  execute: () => Promise<boolean | void>;
  readback: () => Promise<TData>;
  readbackTarget?: DocumentIdentity;
};

export class MutationLifecycle {
  private mutations = new Map<string, MutationRecord<any, any>>();
  private busy = false;
  private activeMutationId?: string;

  constructor(private readonly executionTimeoutMs = 45_000) {
    if (!Number.isFinite(executionTimeoutMs) || executionTimeoutMs <= 0) {
      throw new Error("Mutation execution timeout must be positive and finite");
    }
  }

  private busyError(): Error & { code: string; details: unknown } {
    const active = this.activeMutationId ? this.mutations.get(this.activeMutationId) : undefined;
    return Object.assign(new Error("Another mutation is still pending; query its result without replaying it"), {
      code: "mutation_busy",
      details: active ? this.public(active) : undefined
    });
  }
  private generation = 0;

  getGeneration(): number {
    return this.generation;
  }

  invalidateAll(): void {
    this.generation++;
    for (const record of this.mutations.values()) {
      if (record.status === "prepared") {
        record.status = "invalidated";
      }
    }
  }

  prepare<TOperation = Record<string, unknown>, TData = unknown>(
    options: PrepareMutationOptions<TOperation, TData>
  ): MutationRecord<TOperation, TData> {
    if (this.busy) {
      throw this.busyError();
    }

    const mutationId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `mut_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const beforeCopy = copy(options.before);
    const afterCopy = copy(options.requestedAfter);
    const operationCopy = copy(options.operation);
    const targetCopy = copy(options.target);

    let changedKeys: string[] | undefined = options.changedKeys ? [...options.changedKeys] : undefined;
    if (
      !changedKeys &&
      beforeCopy &&
      afterCopy &&
      typeof beforeCopy === "object" &&
      typeof afterCopy === "object" &&
      !Array.isArray(beforeCopy) &&
      !Array.isArray(afterCopy)
    ) {
      const beforeRec = beforeCopy as Record<string, unknown>;
      const afterRec = afterCopy as Record<string, unknown>;
      changedKeys = Object.keys({ ...beforeRec, ...afterRec }).filter(
        (key) =>
          !(key in beforeRec) || !(key in afterRec) || canonicalJson(beforeRec[key]) !== canonicalJson(afterRec[key])
      );
    }

    const preview: MutationPreview = {
      before: beforeCopy,
      requestedAfter: afterCopy,
      ...(changedKeys ? { changedKeys } : {}),
      scope: options.scope,
      ...(options.impact ? { impact: options.impact } : {})
    };

    const ttlMs = options.ttlMs ?? 15 * 60_000;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

    const record: MutationRecord<TOperation, TData> = {
      mutationId,
      domain: options.domain,
      action: options.action,
      confirmation: formatMutationConfirmation(options.domain, options.action, mutationId),
      operation: operationCopy,
      target: targetCopy,
      before: beforeCopy,
      preview,
      status: "prepared",
      generation: this.generation,
      createdAt: now.toISOString(),
      expiresAt,
      documentSaved: false
    };

    this.mutations.set(mutationId, record);
    return this.public(record);
  }

  get(mutationId: string): MutationRecord<any, any> {
    const record = this.mutations.get(mutationId);
    if (!record) {
      const error = new Error(
        `Mutation "${mutationId}" was not found or has been evicted; do not replay unconfirmed mutations`
      ) as Error & { code: string };
      error.code = "mutation_not_found";
      throw error;
    }

    if (record.status === "prepared" && Date.now() > Date.parse(record.expiresAt)) {
      record.status = "expired";
    }

    return this.public(record);
  }

  async apply<TData = unknown>(options: ApplyMutationOptions<TData>): Promise<MutationRecord<any, TData>> {
    const record = this.mutations.get(options.mutationId);
    if (!record) {
      const error = new Error(
        `Mutation "${options.mutationId}" not found; cannot apply unknown or evicted mutation`
      ) as Error & { code: string };
      error.code = "mutation_not_found";
      throw error;
    }

    if (options.confirmation !== record.confirmation) {
      const error = new Error(
        `Exact confirmation required. Expected "${record.confirmation}", received "${options.confirmation}"`
      ) as Error & { code: string };
      error.code = "confirmation_required";
      throw error;
    }

    if (record.status === "running") {
      const error = new Error("Mutation is already running; query its result") as Error & { code: string };
      error.code = "mutation_busy";
      throw error;
    }

    if (record.status === "applied") {
      const error = new Error("Mutation has already been applied; cannot repeat mutations") as Error & {
        code: string;
      };
      error.code = "mutation_already_applied";
      throw error;
    }

    if (Date.now() > Date.parse(record.expiresAt) || record.status === "expired") {
      record.status = "expired";
      const error = new Error("Mutation has expired; prepare and review a new mutation") as Error & {
        code: string;
      };
      error.code = "mutation_expired";
      throw error;
    }

    if (record.status !== "prepared") {
      const error = new Error(`Mutation is in invalid state "${record.status}"; prepare a new mutation`) as Error & {
        code: string;
      };
      error.code = "mutation_invalid_state";
      throw error;
    }

    if (this.busy) {
      throw this.busyError();
    }

    // Verify target matches
    assertDocumentTargetMatch(record.target, options.currentTarget, { requireTabMatch: true, requirePageMatch: true });

    // Verify baseline state has not drifted
    if (
      record.generation !== this.generation ||
      canonicalJson(record.before) !== canonicalJson(options.currentBefore)
    ) {
      const error = new Error(
        "Document state changed since preview; mutation was blocked without dispatching"
      ) as Error & { code: string };
      error.code = "stale_mutation";
      throw error;
    }

    this.busy = true;
    this.activeMutationId = record.mutationId;
    record.status = "running";
    record.startedAt = new Date().toISOString();
    record.phase = "execute";

    // Keep observing the original promise after the caller's deadline. A timeout
    // cannot cancel an SDK write, so never release its lock or replay the write.
    const completion = (async () => {
      try {
        const execResult = await options.execute();
        if (execResult === false) {
          record.status = "failed";
          record.error = "Mutation executor returned false";
          const error = new Error("Mutation execution returned false; outcome unverified") as Error & {
            code: string;
          };
          error.code = "write_unverified";
          throw error;
        }

        // Check target again after write
        if (options.readbackTarget) {
          assertDocumentTargetMatch(record.target, options.readbackTarget, {
            requireTabMatch: true,
            requirePageMatch: true
          });
        }

        record.phase = "readback";
        const readbackData = await options.readback();
        record.after = copy(readbackData);
        record.status = "applied";
        delete record.error;
        return this.public(record);
      } catch (error) {
        if (record.status === "running") {
          record.status = "failed";
          record.error = error instanceof Error ? error.message : String(error);
        } else if (record.status === "unknown") {
          record.error = `Outcome remains uncertain after executor rejection: ${error instanceof Error ? error.message : String(error)}`;
        }
        throw error;
      } finally {
        record.phase = "settled";
        record.settledAt = new Date().toISOString();
        if (this.activeMutationId === record.mutationId) {
          this.busy = false;
          this.activeMutationId = undefined;
        }
      }
    })();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<MutationRecord<any, TData>>((resolve) => {
      timer = setTimeout(() => {
        record.status = "unknown";
        record.timedOutAt = new Date().toISOString();
        record.error = "Execution deadline exceeded; the original operation is still being observed. Do not replay it.";
        // A pending read-only readback cannot perform another write.
        if (record.phase === "readback" && this.activeMutationId === record.mutationId) {
          this.busy = false;
          this.activeMutationId = undefined;
        }
        resolve(this.public(record));
      }, this.executionTimeoutMs);
    });
    try {
      await Promise.race([completion, deadline]);
      return this.public(record);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  markOutcomeUnknown(mutationId: string, error?: unknown): MutationRecord<any, any> {
    const record = this.mutations.get(mutationId);
    if (!record) {
      const err = new Error(`Mutation "${mutationId}" not found`) as Error & { code: string };
      err.code = "mutation_not_found";
      throw err;
    }
    record.status = "unknown";
    record.error = error instanceof Error ? error.message : String(error ?? "Mutation outcome uncertain");
    return this.public(record);
  }

  private public<T extends MutationRecord<any, any>>(record: T): T {
    return copy({
      ...record,
      status: record.status === "prepared" && Date.now() > Date.parse(record.expiresAt) ? "expired" : record.status,
      execution: {
        timeoutMs: this.executionTimeoutMs,
        elapsedMs: record.startedAt
          ? Math.max(0, (record.settledAt ? Date.parse(record.settledAt) : Date.now()) - Date.parse(record.startedAt))
          : 0,
        lockHeld: this.busy && this.activeMutationId === record.mutationId,
        recovery:
          this.busy && this.activeMutationId === record.mutationId
            ? "Query this mutation; the lock releases automatically when the original executor settles. If it never settles, reload the extension and inspect the document before any retry."
            : "No execution lock held. Inspect the result before preparing another operation."
      },
      documentSaved: false as const
    });
  }
}
