import { canonical, DrcEditQuerySchema, DrcOperationSchema, DrcScopeSchema, drcConfirmation, type DrcOperation } from "../../src/drc/contracts.js";

type Api = Record<string, any>;
type Target = { documentId: string; projectId: string; tabId: string };
type Edit = { editId: string; confirmation: string; operation: DrcOperation; target: Target; before: unknown;
  status: "prepared" | "running" | "applied" | "failed" | "unknown" | "invalidated" | "expired";
  generation: number; expiresAt: string; after?: unknown; error?: string };
const getters = { current: "getCurrentRuleConfiguration", configurations: "getAllRuleConfigurations",
  netRules: "getNetRules", netByNetRules: "getNetByNetRules", regionRules: "getRegionRules" } as const;
const setters = { createConfiguration: "saveRuleConfiguration", updateCurrentConfiguration: "overwriteCurrentRuleConfiguration",
  replaceNetRules: "overwriteNetRules", replaceNetByNetRules: "overwriteNetByNetRules", replaceRegionRules: "overwriteRegionRules" } as const;
const scope = (op: DrcOperation): keyof typeof getters => ({ createConfiguration: "configurations", updateCurrentConfiguration: "current",
  replaceNetRules: "netRules", replaceNetByNetRules: "netByNetRules", replaceRegionRules: "regionRules" } as const)[op.type];
const fail = (code: string, message: string): never => { throw Object.assign(new Error(message), { code }); };
// A retained/public result wraps already validated rule data in preview metadata.
const copy = <T>(value: T): T => JSON.parse(canonical(value, 64));

/** Single-operation edits: no implicit save, replay or rollback. Retained only in this JS instance. */
export class DrcRules {
  private edits = new Map<string, Edit>();
  private generation = 0;
  private busy = false;
  constructor(private api: () => Api, private uuid = () => globalThis.crypto.randomUUID()) {}
  connectionChanged(): void {
    this.generation++;
    for (const edit of this.edits.values()) if (edit.status === "prepared") edit.status = "invalidated";
  }
  capabilities(): Record<string, boolean> {
    return Object.fromEntries([...Object.values(getters), ...Object.values(setters), "getRuleConfiguration"].map(method => [method, typeof this.api().pcb_Drc?.[method] === "function"]));
  }
  private method(name: string): (...args: any[]) => Promise<any> {
    if (typeof this.api().pcb_Drc?.[name] !== "function") fail("api_unavailable", `eda.pcb_Drc.${name} is unavailable`);
    return (...args) => this.api().pcb_Drc[name](...args);
  }
  private async target(): Promise<Target> {
    const info = await this.api().dmt_SelectControl?.getCurrentDocumentInfo?.();
    // EDMT_EditorDocumentType.PCB = 3; 2 is a symbol, not a board.
    if (![3, "pcb"].includes(info?.documentType ?? info?.doctype ?? info?.type)) fail("wrong_document", "Open a PCB document before inspecting or changing DRC rules");
    const documentId = info?.uuid ?? info?.documentUuid;
    const projectId = info?.parentProjectUuid ?? info?.projectUuid;
    const tabId = info?.tabId;
    if (![documentId, projectId, tabId].every(v => typeof v === "string" && v.length)) fail("missing_document_identity", "PCB project, document and tab IDs are required");
    return { documentId, projectId, tabId };
  }
  private async state(selected: keyof typeof getters): Promise<{ target: Target; data: any }> {
    const generation = this.generation;
    const target = await this.target();
    const raw = await this.method(getters[selected])(...(selected === "configurations" ? [true] : []));
    if (selected === "current") {
      if (!raw || typeof raw.name !== "string" || !raw.config || Array.isArray(raw.config) || typeof raw.config !== "object") fail("unsupported_api_result", "Expected current DRC configuration { name, config }");
    } else if (selected === "netByNetRules") {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("unsupported_api_result", "Expected a net-by-net rule object keyed by rule category");
    } else if (!Array.isArray(raw)) fail("unsupported_api_result", "Expected an array of DRC rules/configurations");
    if (canonical(raw).length > 200_000) fail("response_too_large", "DRC source exceeds 200000 characters; no partial edit preview is allowed");
    if (generation !== this.generation || canonical(target) !== canonical(await this.target())) fail("document_changed", "PCB or connection changed during rule collection");
    return { target, data: copy(raw) };
  }
  async read(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const selected = DrcScopeSchema.parse(input.scope ?? "current");
    const state = await this.state(selected);
    return { ...state, scope: selected, source: "editor_api", completeness: "api_returned",
      capturedAt: new Date().toISOString(), capabilities: this.capabilities() };
  }
  async prepare(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.busy) fail("edit_busy", "A DRC edit is in progress");
    this.busy = true;
    try {
      if (canonical(input).length > 200_000) fail("invalid_operation", "DRC operation exceeds 200000 characters");
      const operation = copy(DrcOperationSchema.parse(input.operation));
      this.method(setters[operation.type]);
      if (operation.type === "createConfiguration") this.method("getRuleConfiguration");
      const generation = this.generation;
      const before = await this.state(scope(operation));
      if (operation.type === "createConfiguration") {
        if (!before.data.every((c: any) => c && typeof c.name === "string")) fail("unsupported_api_result", "Configuration names must be explicit");
        if (before.data.some((c: any) => c.name === operation.configurationName)) fail("configuration_exists", "Choose a new exact configuration name; overwriting saved/system profiles is not supported");
      }
      if (this.edits.size >= 100) fail("edit_capacity", "100 DRC edits retained; review results before reloading the extension");
      const editId = this.uuid();
      const edit: Edit = { editId, confirmation: drcConfirmation(editId), operation, target: before.target, before: before.data,
        status: "prepared", generation, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() };
      this.edits.set(editId, edit);
      return this.public(edit);
    } finally { this.busy = false; }
  }
  private public(edit: Edit): Record<string, unknown> {
    const { generation: _generation, before, ...data } = edit;
    const after = edit.operation.type === "createConfiguration" || edit.operation.type === "updateCurrentConfiguration" ? edit.operation.config : edit.operation.rules;
    const base = edit.operation.type === "updateCurrentConfiguration" && before && typeof before === "object" && "config" in (before as Record<string, unknown>)
      ? (before as Record<string, unknown>).config
      : before;
    const changedKeys = base && after && typeof base === "object" && typeof after === "object" && !Array.isArray(base) && !Array.isArray(after)
      ? Object.keys({ ...(base as Record<string, unknown>), ...(after as Record<string, unknown>) })
          .filter(k => !(k in (base as Record<string, unknown>)) || !(k in (after as Record<string, unknown>)) || canonical((base as Record<string, unknown>)[k]) !== canonical((after as Record<string, unknown>)[k]))
      : undefined;
    return copy({ ...data, status: edit.status === "prepared" && Date.now() > Date.parse(edit.expiresAt) ? "expired" : edit.status,
      documentSaved: false, preview: { before, requestedAfter: after, ...(changedKeys ? { changedKeys } : {}),
        scope: edit.operation.type === "createConfiguration" ? "saved_rule_configuration" : "active_pcb",
        impact: edit.operation.type === "createConfiguration" ? "Persists a new named rule profile with allowOverwrite=false; does not save the PCB or set a global default." : "Replaces the entire selected rule configuration/table; omitted entries are removed. PCB is not saved." } });
  }
  private edit(input: unknown): Edit {
    const { editId } = DrcEditQuerySchema.parse(input);
    return this.edits.get(editId) ?? fail("edit_not_found", "DRC edit not retained in this extension instance; do not reconstruct or replay an uncertain mutation");
  }
  result(input: unknown): Record<string, unknown> { return this.public(this.edit(input)); }
  async apply(input: unknown, confirmation: unknown): Promise<Record<string, unknown>> {
    const edit = this.edit(input);
    if (confirmation !== edit.confirmation) fail("confirmation_required", "Use the exact edit confirmation after human approval of the preview");
    if (edit.status !== "prepared") fail("edit_already_started", "DRC edit cannot be repeated; query its result");
    if (this.busy) fail("edit_busy", "A DRC edit is in progress");
    this.busy = true;
    edit.status = "running";
    let dispatched = false;
    try {
      if (Date.now() > Date.parse(edit.expiresAt)) fail("edit_expired", "Prepare and review a new edit");
      const current = await this.state(scope(edit.operation));
      if (edit.generation !== this.generation || canonical(current.target) !== canonical(edit.target) || canonical(current.data) !== canonical(edit.before)) fail("stale_edit", "PCB, connection or rules changed since preview; nothing was dispatched");
      const op = edit.operation;
      const method = this.method(setters[op.type]);
      if (op.type === "createConfiguration") this.method("getRuleConfiguration");
      dispatched = true;
      const accepted = op.type === "createConfiguration" ? await method(copy(op.config), op.configurationName, false)
        : await method(copy(op.type === "updateCurrentConfiguration" ? op.config : op.rules));
      if (accepted !== true) fail("write_unverified", "DRC API did not return true; outcome is uncertain");
      if (edit.generation !== this.generation || canonical(await this.target()) !== canonical(edit.target)) fail("document_changed", "PCB or connection changed during the DRC write");
      const after = op.type === "createConfiguration" ? await this.method("getRuleConfiguration")(op.configurationName) : (await this.state(scope(op))).data;
      if (canonical(after).length > 200_000) fail("response_too_large", "DRC readback exceeds 200000 characters; outcome is uncertain");
      edit.after = copy(after);
      const actual = op.type === "createConfiguration" || op.type === "updateCurrentConfiguration" ? after?.config : after;
      const expected = op.type === "createConfiguration" || op.type === "updateCurrentConfiguration" ? op.config : op.rules;
      if ((op.type === "createConfiguration" && after?.name !== op.configurationName) || canonical(await this.target()) !== canonical(edit.target) || edit.generation !== this.generation || canonical(actual) !== canonical(expected)) fail("readback_mismatch", "DRC readback did not match the reviewed edit; do not retry");
      edit.status = "applied";
    } catch (error) {
      edit.status = dispatched ? "unknown" : "failed";
      edit.error = error instanceof Error ? error.message : String(error);
    } finally { this.busy = false; }
    return this.public(edit);
  }
}
