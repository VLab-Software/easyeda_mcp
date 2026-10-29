import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { DrcRules } from "./drcRules.js";

function fixture() {
  let target = { documentType: 3, uuid: "pcb-a", parentProjectUuid: "project", tabId: "pcb-a@project" };
  let current = { name: "Default", config: { testRule: 10 } };
  const profiles = new Map<string, any>([["Default", current]]);
  const tables: Record<string, any> = { netRules: [], netByNetRules: {}, regionRules: [] };
  const drc: Record<string, any> = {
    getCurrentRuleConfiguration: vi.fn(async () => structuredClone(current)),
    overwriteCurrentRuleConfiguration: vi.fn(async config => { current = { ...current, config }; return true; }),
    getAllRuleConfigurations: vi.fn(async () => [...profiles.values()]),
    getRuleConfiguration: vi.fn(async name => profiles.get(name)),
    saveRuleConfiguration: vi.fn(async (config, name, overwrite) => {
      if (profiles.has(name) && !overwrite) return false;
      profiles.set(name, { name, config }); return true;
    })
  };
  for (const [table, suffix] of [["netRules", "NetRules"], ["netByNetRules", "NetByNetRules"], ["regionRules", "RegionRules"]]) {
    drc[`get${suffix}`] = vi.fn(async () => structuredClone(tables[table]));
    drc[`overwrite${suffix}`] = vi.fn(async rules => { tables[table] = rules; return true; });
  }
  const api = { pcb_Drc: drc, dmt_SelectControl: { getCurrentDocumentInfo: vi.fn(async () => ({ ...target })) }, pcb_Document: { save: vi.fn() } };
  const engine = new DrcRules(() => api, randomUUID);
  const prepare = (operation = { type: "updateCurrentConfiguration", config: { testRule: 20 } } as any) => engine.prepare({ operation });
  const apply = (edit: Record<string, any>, confirmation = edit.confirmation) => engine.apply({ editId: edit.editId }, confirmation);
  return { engine, api, drc, profiles, tables, prepare, apply, target: (patch: Partial<typeof target>) => { target = { ...target, ...patch }; }, setCurrent: (config: any) => { current = { ...current, config }; } };
}

describe("DRC editing", () => {
  it("keeps a deeply nested valid rule preview and applied result queryable", async () => {
    const f = fixture(); let config: Record<string, unknown> = { value: 1 };
    for (let i = 0; i < 37; i++) config = { nested: config };
    f.setCurrent(config);
    const edit = await f.prepare({ type: "updateCurrentConfiguration", config });
    expect((await f.apply(edit)).status).toBe("applied");
    expect(f.engine.result({ editId: edit.editId }).status).toBe("applied");
  });
  it("keeps an oversized named-profile readback uncertain and queryable", async () => {
    const f = fixture();
    f.drc.getRuleConfiguration.mockResolvedValueOnce({ name: "Test", config: { huge: "x".repeat(200001) } });
    const edit = await f.prepare({ type: "createConfiguration", configurationName: "Test", config: {} });
    expect((await f.apply(edit)).status).toBe("unknown");
    expect(f.engine.result({ editId: edit.editId })).toMatchObject({ status: "unknown" });
    await expect(f.apply(edit)).rejects.toThrow("cannot be repeated");
  });
  it("reads native rules, capabilities and identity without saving", async () => {
    const f = fixture(); const result = await f.engine.read({});
    expect(result).toMatchObject({ target: { documentId: "pcb-a", projectId: "project" }, scope: "current", data: { config: { testRule: 10 } }, completeness: "api_returned" });
    expect(f.api.pcb_Document.save).not.toHaveBeenCalled();
  });
  it.each([1, 2, 4, 12, -1])("rejects non-PCB numeric document type %s", async documentType => {
    const f = fixture(); f.target({ documentType }); await expect(f.prepare()).rejects.toThrow("Open a PCB");
    expect(f.drc.overwriteCurrentRuleConfiguration).not.toHaveBeenCalled();
  });
  it("prepares immutable before/after data and applies only with its exact confirmation", async () => {
    const f = fixture(); const edit = await f.prepare();
    expect(f.drc.overwriteCurrentRuleConfiguration).not.toHaveBeenCalled();
    for (const phrase of ["", "confirmo", `não ${edit.confirmation}`, `${edit.confirmation} please`]) await expect(f.apply(edit, phrase)).rejects.toThrow("exact edit confirmation");
    (edit.operation as any).config.testRule = 999;
    const result = await f.apply(edit); expect(result.status).toBe("applied");
    expect(f.drc.overwriteCurrentRuleConfiguration).toHaveBeenCalledWith({ testRule: 20 });
    expect(f.api.pcb_Document.save).not.toHaveBeenCalled();
    await expect(f.apply(edit)).rejects.toThrow("cannot be repeated");
  });
  it("creates a named profile without overwriting an existing or system profile", async () => {
    const f = fixture(); const edit = await f.prepare({ type: "createConfiguration", configurationName: "Test", config: { testRule: 30 } });
    expect(edit.preview).toMatchObject({ scope: "saved_rule_configuration" });
    expect((await f.apply(edit)).status).toBe("applied");
    expect(f.drc.saveRuleConfiguration).toHaveBeenCalledWith({ testRule: 30 }, "Test", false);
    await expect(f.prepare({ type: "createConfiguration", configurationName: "Default", config: {} })).rejects.toThrow("new exact configuration name");
    expect(f.drc.saveRuleConfiguration).toHaveBeenCalledTimes(1);
  });
  it.each(["NetRules", "NetByNetRules", "RegionRules"])("replaces and verifies the complete %s table, including explicit empty tables", async suffix => {
    const f = fixture(); const op = { type: `replace${suffix}`, rules: suffix === "NetByNetRules" ? { testCategory: { testRule: 42 } } : [{ testRule: 42 }] };
    expect((await f.apply(await f.prepare(op))).status).toBe("applied");
    expect(f.drc[`overwrite${suffix}`]).toHaveBeenCalledWith(op.rules);
    expect((await f.apply(await f.prepare({ ...op, rules: suffix === "NetByNetRules" ? {} : [] }))).status).toBe("applied");
  });
  it.each(["rules", "page", "project", "connection"])("blocks a prepared edit after a %s change", async kind => {
    const f = fixture(); const edit = await f.prepare();
    if (kind === "rules") f.setCurrent({ testRule: 99 });
    if (kind === "page") f.target({ uuid: "pcb-b", tabId: "pcb-b@project" });
    if (kind === "project") f.target({ parentProjectUuid: "other" });
    if (kind === "connection") f.engine.connectionChanged();
    if (kind === "connection") { expect(f.engine.result({ editId: edit.editId }).status).toBe("invalidated"); await expect(f.apply(edit)).rejects.toThrow("cannot be repeated"); }
    else expect((await f.apply(edit)).status).toBe("failed");
    expect(f.drc.overwriteCurrentRuleConfiguration).not.toHaveBeenCalled();
  });
  it("rejects missing methods and identities before dispatch", async () => {
    const f = fixture(); delete f.drc.overwriteCurrentRuleConfiguration;
    await expect(f.prepare()).rejects.toThrow("is unavailable");
    const g = fixture(); g.target({ tabId: "" }); await expect(g.prepare()).rejects.toThrow("IDs are required");
  });
  it("retains an uncertain write and never retries false or mismatching readback", async () => {
    for (const mismatch of [false, true]) {
      const f = fixture(); f.drc.overwriteCurrentRuleConfiguration.mockResolvedValueOnce(mismatch);
      const edit = await f.prepare(); expect((await f.apply(edit)).status).toBe("unknown");
      expect(f.engine.result({ editId: edit.editId }).status).toBe("unknown");
      await expect(f.apply(edit)).rejects.toThrow("cannot be repeated");
      expect(f.drc.overwriteCurrentRuleConfiguration).toHaveBeenCalledTimes(1);
    }
  });
  it("exposes running results after a caller timeout and prevents concurrent/double dispatch", async () => {
    const f = fixture(); let release!: () => void;
    f.drc.overwriteCurrentRuleConfiguration.mockImplementationOnce(async (config: Record<string, unknown>) => {
      await new Promise<void>(resolve => { release = resolve; }); f.setCurrent(config); return true;
    });
    const edit = await f.prepare(); const pending = f.apply(edit);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    expect(f.engine.result({ editId: edit.editId }).status).toBe("running");
    await expect(f.apply(edit)).rejects.toThrow("cannot be repeated");
    await expect(f.prepare()).rejects.toThrow("in progress");
    release(); expect((await pending).status).toBe("applied");
  });
  it("retains uncertainty if the connection changes during a dispatched write", async () => {
    const f = fixture(); f.drc.overwriteCurrentRuleConfiguration.mockImplementationOnce(async () => { f.engine.connectionChanged(); return true; });
    expect((await f.apply(await f.prepare())).status).toBe("unknown");
  });
  it("expires prepared edits without dispatching", async () => {
    const f = fixture(); const edit = await f.prepare(); const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 16 * 60_000);
    try { expect(f.engine.result({ editId: edit.editId }).status).toBe("expired"); expect((await f.apply(edit)).status).toBe("failed"); }
    finally { now.mockRestore(); }
    expect(f.drc.overwriteCurrentRuleConfiguration).not.toHaveBeenCalled();
  });
  it("rejects non-JSON, unsafe, oversized and arbitrary operation payloads", async () => {
    const f = fixture();
    for (const config of [{ bad: undefined }, { bad: Infinity }, { bad: () => 1 }, JSON.parse('{"__proto__":{}}'), { text: "x".repeat(200001) }]) await expect(f.prepare({ type: "updateCurrentConfiguration", config })).rejects.toThrow();
    await expect(f.prepare({ type: "runAnything", config: {} })).rejects.toThrow();
    expect(f.drc.overwriteCurrentRuleConfiguration).not.toHaveBeenCalled();
  });
});
