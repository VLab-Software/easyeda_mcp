# PCB Design Rule Editing

Inspect native PCB design rules, create a named rule configuration, and update the active PCB's rules through the local extension and WebSocket bridge.

Requires MCP server **1.1.0** and extension **0.2.0**. See [upgrading the extension](./easyeda-extension.md#upgrading-the-extension).

## Read, preview, confirm, verify

1. Open the target PCB in EasyEDA Pro. The extension requires its project, document, and tab IDs. Symbols, footprints, and schematics are rejected.
2. Call `easyeda_get_drc_rules` with `scope`: `current`, `configurations`, `netRules`, `netByNetRules`, or `regionRules`. Inspect the raw editor data and the per-method capabilities. Missing methods return `api_unavailable`.
3. Copy the editor's JSON structure and modify the intended fields using the editor's units. Call `easyeda_prepare_drc_edit` with one operation from the table below. Preparation reads and retains the original state without writing.
4. Review the preview, target identity, and impact, then obtain human approval for the prepared `editId`.
5. Call `easyeda_confirmed_action` with `action: "editDrcRules"`, `params: {"editId": "<prepared UUID>"}`, and `confirmation: "CONFIRM editDrcRules <prepared UUID>"`.
6. Inspect the result and reread the affected rules. Saving the PCB document requires a separate explicit `save` action.

| Operation type | Payload | Effect |
| --- | --- | --- |
| `createConfiguration` | `configurationName`, `config` object | Persists a new named rule profile with `allowOverwrite=false`; existing/system profiles cannot be overwritten |
| `updateCurrentConfiguration` | `config` object | Replaces the current PCB rule configuration |
| `replaceNetRules` | `rules` array of objects | Replaces the entire per-net rule table |
| `replaceNetByNetRules` | `rules` object | Replaces the net-by-net rules, keyed by rule category |
| `replaceRegionRules` | `rules` array of objects | Replaces the entire region rule table |

For example, to create a new profile, use `operation.type = "createConfiguration"`, choose a new exact `configurationName`, and provide the `config` object from the `current` read (with your changes). The read result is `{name, config}`: pass the inner `config`, not the wrapper.

A whole-table replacement removes omitted entries. An empty array/object explicitly clears that table. Named profile creation persists a profile (`saved_rule_configuration`), while other operations target `active_pcb`.

## Failure and session behavior

Both the MCP server and extension enforce the exact confirmation. Before dispatch, the extension compares the PCB identity, connection generation, and complete selected rule state with the preview. Any change blocks dispatch. Concurrent edits, expired previews (15 minutes TTL), and repeated execution are rejected.

The API must return `true` and the readback must match the requested JSON to report `applied`. A false/undefined result, exception during dispatch, changed target, or mismatching readback produces `unknown`.

A transport timeout or disconnection after dispatch returns `drc_edit_outcome_unknown` (`retryable: false`). Query `easyeda_get_drc_edit_result` with the same `editId` instead of reapplying it.

Rule JSON must be finite plain JSON, bounded to 200,000 characters per request/source, with depth at most 40.

## Official EasyEDA Pro API References

- [PCB_Drc](https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_drc.html)
- [Save a named configuration](https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_drc.saveruleconfiguration.html)
- [Overwrite current configuration](https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_drc.overwritecurrentruleconfiguration.html)
- [Per-net rules](https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_drc.overwritenetrules.html)
- [Net-by-net rules](https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_drc.overwritenetbynetrules.html)
- [Region rules](https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_drc.overwriteregionrules.html)
- [Document types](https://prodocs.easyeda.com/en/api/reference/pro-api.edmt_editordocumenttype.html): PCB = 3, symbol = 2, footprint = 4
