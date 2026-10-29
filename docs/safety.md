# Safety Model

EasyEDA Pro MCP is **read-first by default**. Inspection, net tracing, schematic validation, editor navigation, and manufacturing exports never mutate your schematic or PCB.

## Tool Safety Tiers

| Tier | Tools | Guarantee |
| --- | --- | --- |
| **Read-Only Inspection & Exports** | 22 tools (`readOnlyHint: true`, `destructiveHint: false`) | Safe to invoke automatically. Never modifies schematic, PCB, or rule profiles. |
| **Non-Mutating Preview** | [`easyeda_prepare_drc_edit`](./tools.md#easyeda_prepare_drc_edit) (`readOnlyHint: false`, `destructiveHint: false`) | Stages an in-memory DRC diff (`editId`) with a 15-minute TTL without modifying the PCB or saving profiles. |
| **Confirmed Legacy Actions** | [`easyeda_confirmed_action`](./tools.md#easyeda_confirmed_action) (`save`, `importChanges`, `autoroute`, `autolayout`) | Blocked unless `confirmation` includes an explicit approval phrase (`I confirm`, `confirmed`, `confirma`, `confirmo`). |
| **Confirmed DRC Rule Edits** | [`easyeda_confirmed_action`](./tools.md#easyeda_confirmed_action) (`action: "editDrcRules"`) | Requires a valid `editId` and the exact string `CONFIRM editDrcRules <editId>` enforced by both the MCP server and the EasyEDA extension. |

## Defense-in-Depth for PCB DRC Edits

When updating PCB design rules (`createConfiguration`, `updateCurrentConfiguration`, `replaceNetRules`, `replaceNetByNetRules`, `replaceRegionRules`), five safeguards prevent unintended board modifications:

1. **Dual-boundary token check**: Both `src/mcp/registerTools.ts` and `extension/src/drcRules.ts` independently verify `CONFIRM editDrcRules <editId>`.
2. **Target PCB identity binding**: Each preview locks `projectUuid`, `documentUuid`, `tabId`, and the WebSocket session ID. Switching tabs or projects invalidates the preview with `stale_edit`.
3. **Canonical baseline hash**: Before writing, the extension re-reads the live DRC surface and verifies its canonical JSON matches the preview baseline.
4. **Full native readback verification**: A write reports `applied` only if the `eda.pcb_Drc` setter returns `true` **and** an immediate readback matches `requestedAfter`.
5. **No automatic replay on timeout**: If the WebSocket disconnects or times out after dispatch, the server returns `drc_edit_outcome_unknown` (`retryable: false`). Use [`easyeda_get_drc_edit_result`](./tools.md#easyeda_get_drc_edit_result) to inspect the outcome instead of re-sending.

::: info Profile Persistence vs. PCB Document Save
Creating a named DRC configuration (`createConfiguration`) persists that profile in EasyEDA Pro (`allowOverwrite` is always `false`). Modifying active PCB rules updates the open PCB in memory — saving the `.pcb` file still requires either manual save in EasyEDA Pro or `easyeda_confirmed_action` with `action: "save"`.
:::

## Schematic Confidence Levels

Heuristic schematic analysis tools (`easyeda_schematic_snapshot`, `easyeda_trace_net`, `easyeda_validate_schematic_area`, `easyeda_verify_connections`) report a `confidence` rating alongside any `warnings`:

| Confidence | Meaning | Recommended Action |
| --- | --- | --- |
| **`high`** | Complete primitive, pin, and net metadata available. | Safe to rely on structured results directly. |
| **`partial`** | Useful context, but some connectivity was inferred from wire/pin geometry. | Review the `warnings` array and spot-check critical nets. |
| **`low`** | Incomplete schematic metadata on the active sheet. | Treat as a hint and inspect the area visually with `easyeda_navigate_component`. |
