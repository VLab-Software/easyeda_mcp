# Safety Model

EasyEDA Pro MCP is **read-first** by default. Inspection, tracing, navigation, and exports never mutate project data.

## Read-Only vs. Confirmed Actions

| Category | Behavior |
| --- | --- |
| **Inspection, Tracing, Navigation, Exports** | Safe to run freely (`readOnlyHint: true`). Does not modify schematic or PCB data. |
| **`easyeda_prepare_drc_edit`** | Stages an in-memory DRC preview without writing to the PCB or saving profiles. |
| **Legacy Mutations (`save`, `importChanges`, `autoroute`, `autolayout`)** | Blocked unless `confirmation` includes an explicit phrase (`I confirm`, `confirmed`, `confirma`, `confirmo`). |
| **DRC Rule Edits (`editDrcRules`)** | Requires a prepared `editId` and the exact string `CONFIRM editDrcRules <editId>` enforced in both the MCP server and the extension. |

### Additional DRC Safeguards

- **Stale-state blocking**: dispatch is aborted if the active PCB tab, WebSocket session, or underlying rules changed after the preview was created.
- **Readback verification**: writes report `applied` only if `eda.pcb_Drc` returns `true` and an immediate readback matches the requested JSON.
- **No automatic replay**: timeouts return `drc_edit_outcome_unknown` (`retryable: false`); inspect status with `easyeda_get_drc_edit_result` instead of re-sending.
- **Explicit PCB save**: creating a named profile persists that profile, while saving the `.pcb` document always requires a separate `save` action.

## Schematic Confidence Levels

Heuristic schematic analysis tools report a `confidence` level alongside `warnings`:

- **`high`**: complete primitive and net data available for review.
- **`partial`**: useful context, but some connectivity was inferred from wire/pin geometry.
- **`low`**: treat as a hint and verify directly in EasyEDA Pro.
