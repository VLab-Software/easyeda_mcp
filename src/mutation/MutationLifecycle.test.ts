import { describe, expect, it } from "vitest";
import type { DocumentIdentity } from "../protocol/identity.js";
import { MutationLifecycle } from "./MutationLifecycle.js";

describe("MutationLifecycle", () => {
  const baseTarget: DocumentIdentity = {
    projectId: "proj-1",
    projectName: "Test Project",
    documentId: "doc-1",
    documentName: "MainBoard.PCB",
    documentType: "pcb",
    tabId: "tab-1",
    capturedAt: new Date().toISOString(),
    completeness: "full",
    source: "native_api",
    fingerprint: "proj-1::doc-1::pcb::tab-1::*"
  };

  it("prepares immutable preview and deterministic confirmation", () => {
    const lifecycle = new MutationLifecycle();
    const before = { trackWidth: 10, clearance: 5 };
    const requestedAfter = { trackWidth: 12, clearance: 5 };

    const prepared = lifecycle.prepare({
      domain: "pcb",
      action: "updateRoutingRules",
      target: baseTarget,
      operation: { type: "updateRoutingRules", config: { trackWidth: 12 } },
      before,
      requestedAfter,
      scope: "active_pcb"
    });

    expect(prepared.status).toBe("prepared");
    expect(prepared.documentSaved).toBe(false);
    expect(prepared.confirmation).toBe(`CONFIRM pcb:updateRoutingRules ${prepared.mutationId}`);
    expect(prepared.preview.changedKeys).toEqual(["trackWidth"]);
    expect(prepared.preview.before).toEqual(before);
    expect(prepared.preview.requestedAfter).toEqual(requestedAfter);

    // Modifying source before object does not mutate the prepared record
    before.trackWidth = 999;
    expect(prepared.before.trackWidth).toBe(10);
  });

  it("requires exact confirmation string to apply", async () => {
    const lifecycle = new MutationLifecycle();
    const prepared = lifecycle.prepare({
      domain: "schematic",
      action: "addComponent",
      target: baseTarget,
      operation: { type: "add", designator: "R1" },
      before: { count: 0 },
      requestedAfter: { count: 1 },
      scope: "active_sheet"
    });

    await expect(
      lifecycle.apply({
        mutationId: prepared.mutationId,
        confirmation: "confirma",
        currentTarget: baseTarget,
        currentBefore: { count: 0 },
        execute: async () => true,
        readback: async () => ({ count: 1 })
      })
    ).rejects.toThrowError(/Exact confirmation required/i);
  });

  it("blocks mutation when document target has changed since preview", async () => {
    const lifecycle = new MutationLifecycle();
    const prepared = lifecycle.prepare({
      domain: "pcb",
      action: "moveComponent",
      target: baseTarget,
      operation: { type: "move", id: "C1", x: 100 },
      before: { x: 50 },
      requestedAfter: { x: 100 },
      scope: "active_pcb"
    });

    const switchedTarget = { ...baseTarget, documentId: "doc-2" };

    await expect(
      lifecycle.apply({
        mutationId: prepared.mutationId,
        confirmation: prepared.confirmation,
        currentTarget: switchedTarget,
        currentBefore: { x: 50 },
        execute: async () => true,
        readback: async () => ({ x: 100 })
      })
    ).rejects.toThrowError(/document ID changed/i);
  });

  it("blocks mutation when state has changed since preview (stale mutation)", async () => {
    const lifecycle = new MutationLifecycle();
    const prepared = lifecycle.prepare({
      domain: "pcb",
      action: "updateRules",
      target: baseTarget,
      operation: { type: "update", clearance: 15 },
      before: { clearance: 10 },
      requestedAfter: { clearance: 15 },
      scope: "active_pcb"
    });

    await expect(
      lifecycle.apply({
        mutationId: prepared.mutationId,
        confirmation: prepared.confirmation,
        currentTarget: baseTarget,
        currentBefore: { clearance: 12 }, // State drifted from 10 to 12
        execute: async () => true,
        readback: async () => ({ clearance: 15 })
      })
    ).rejects.toThrowError(/Document state changed since preview/i);
  });

  it("applies mutation once and updates after with verified readback", async () => {
    const lifecycle = new MutationLifecycle();
    const prepared = lifecycle.prepare({
      domain: "pcb",
      action: "updateRules",
      target: baseTarget,
      operation: { type: "update", clearance: 15 },
      before: { clearance: 10 },
      requestedAfter: { clearance: 15 },
      scope: "active_pcb"
    });

    let executed = 0;
    const result = await lifecycle.apply({
      mutationId: prepared.mutationId,
      confirmation: prepared.confirmation,
      currentTarget: baseTarget,
      currentBefore: { clearance: 10 },
      execute: async () => {
        executed++;
        return true;
      },
      readback: async () => ({ clearance: 15 })
    });

    expect(executed).toBe(1);
    expect(result.status).toBe("applied");
    expect(result.after).toEqual({ clearance: 15 });
    expect(result.documentSaved).toBe(false);

    // Double dispatch is rejected
    await expect(
      lifecycle.apply({
        mutationId: prepared.mutationId,
        confirmation: prepared.confirmation,
        currentTarget: baseTarget,
        currentBefore: { clearance: 15 },
        execute: async () => true,
        readback: async () => ({ clearance: 15 })
      })
    ).rejects.toThrowError(/already been applied/i);
  });

  it("handles executor failure and marks status failed", async () => {
    const lifecycle = new MutationLifecycle();
    const prepared = lifecycle.prepare({
      domain: "schematic",
      action: "deleteWire",
      target: baseTarget,
      operation: { type: "delete", wireId: "w1" },
      before: { wireExists: true },
      requestedAfter: { wireExists: false },
      scope: "active_sheet"
    });

    await expect(
      lifecycle.apply({
        mutationId: prepared.mutationId,
        confirmation: prepared.confirmation,
        currentTarget: baseTarget,
        currentBefore: { wireExists: true },
        execute: async () => false,
        readback: async () => ({ wireExists: true })
      })
    ).rejects.toThrowError(/Mutation execution returned false/i);

    const record = lifecycle.get(prepared.mutationId);
    expect(record.status).toBe("failed");
  });

  it("marks uncertain outcome on timeout or bridge disconnect", () => {
    const lifecycle = new MutationLifecycle();
    const prepared = lifecycle.prepare({
      domain: "pcb",
      action: "autoroute",
      target: baseTarget,
      operation: { type: "autoroute" },
      before: {},
      requestedAfter: {},
      scope: "active_pcb"
    });

    lifecycle.markOutcomeUnknown(prepared.mutationId, new Error("Bridge connection lost"));
    const record = lifecycle.get(prepared.mutationId);
    expect(record.status).toBe("unknown");
    expect(record.error).toContain("Bridge connection lost");
  });

  it("expires mutations after TTL", () => {
    const lifecycle = new MutationLifecycle();
    const prepared = lifecycle.prepare({
      domain: "pcb",
      action: "updateRules",
      target: baseTarget,
      operation: { type: "update" },
      before: {},
      requestedAfter: {},
      scope: "active_pcb",
      ttlMs: -1000 // Already expired
    });

    const record = lifecycle.get(prepared.mutationId);
    expect(record.status).toBe("expired");
  });
});
