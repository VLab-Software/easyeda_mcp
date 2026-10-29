# PCB design rule editing (experimental)

Implements the core workflow requested in [issue #14](https://github.com/VLab-Software/easyeda_mcp/issues/14): inspect native PCB design rules, create a named configuration and change the current PCB's rules. This uses the local extension and WebSocket bridge on the international EasyEDA Pro client.

Development candidates: server **1.1.0-rc.1**, extension **0.2.0-rc.1**. Updating the installed extension is required; see [upgrade instructions](./easyeda-extension.md#upgrading-for-drc-rule-editing).

## Read, preview, confirm, verify

1. Open the intended PCB. The extension requires its project, document and tab IDs. Symbols, footprints and schematics are rejected.
2. Call `easyeda_get_drc_rules` with `scope`: `current`, `configurations`, `netRules`, `netByNetRules` or `regionRules`. Inspect the raw editor data and the per-method capabilities. Missing methods return `api_unavailable`; the bridge does not infer substitute rules.
3. Copy the editor's JSON structure and modify the intended fields using the editor's units. Call `easyeda_prepare_drc_edit` with one operation from the table below. Preparation reads and retains the original state without writing.
4. Show the entire preview, target identity and impact to the human. Obtain approval for this exact `editId`.
5. Call `easyeda_confirmed_action` with `action: "editDrcRules"`, `params: {"editId": "<prepared UUID>"}` and `confirmation: "CONFIRM editDrcRules <prepared UUID>"`.
6. Inspect the result and reread the affected rules. A separate explicit `save` action is required to save the PCB document.

| Operation type | Payload | Effect |
| --- | --- | --- |
| `createConfiguration` | `configurationName`, `config` object | Persists a new named rule profile with `allowOverwrite=false`; existing/system profiles cannot be overwritten |
| `updateCurrentConfiguration` | `config` object | Replaces the current PCB rule configuration |
| `replaceNetRules` | `rules` array of objects | Replaces the entire per-net rule table |
| `replaceNetByNetRules` | `rules` object | Replaces the net-by-net rules, keyed by rule category |
| `replaceRegionRules` | `rules` array of objects | Replaces the entire region rule table |

For example, to create a new profile, use `operation.type = "createConfiguration"`, choose a new exact `configurationName`, and provide the `config` object from the `current` read (with reviewed changes). The read result is `{name, config}`: pass the inner `config`, not the wrapper. No generic field names or conversion between mil/mm are invented by the MCP.

A whole-table replacement removes omitted entries. An empty array/object explicitly clears that table. Named profile creation **persists a profile**, even though it does not save the PCB or change the default for future PCBs. Its preview identifies the scope as `saved_rule_configuration`; other operations identify `active_pcb`.

## Failure and session behavior

Both the MCP server and extension enforce the exact confirmation. Before dispatch, the extension compares the PCB identity, connection generation and complete selected rule state with the preview. Changes block dispatch. Concurrent edits, expired previews and repeated execution are rejected. Previews expire after 15 minutes; at most 100 results are retained per extension instance.

The API must return `true` and the readback must match the requested JSON to report `applied`. A false/undefined result, exception during dispatch, changed target or mismatching readback produces `unknown`. The editor may already have changed: there is no transactional rollback.

A transport timeout/disconnection after dispatch produces `drc_edit_outcome_unknown`, `retryable: false`. Query `easyeda_get_drc_edit_result` with the same `editId`; never automatically reapply it. A running call may complete later. Restarting/recreating the extension can lose these in-memory records; `edit_not_found` is not permission to reconstruct and replay the edit.

Rule JSON must be finite plain JSON, bounded to 200,000 characters per request/source, with depth at most 40. Function values and unsafe property keys are rejected. No partial/truncated source is used for an edit. These checks validate transport and shape; they do not certify electrical limits or board manufacturability.

## API and validation status

The documented APIs are beta. Availability on the installed international client must be checked at runtime. This feature has simulated API and MCP/stdio/WebSocket integration tests; **it has not yet been validated by writing rules in the real editor**. All five read scopes have now returned successfully in the real editor with extension 0.2.0-rc.1, with matching PCB identity and unchanged repeated current configuration. This validates those reads, not writes or electrical correctness. See the validation record below. Existing editor tests from other branches/releases do not validate this implementation.

Official references:

- [PCB_Drc](https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_drc.html)
- [Save a named configuration](https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_drc.saveruleconfiguration.html)
- [Overwrite current configuration](https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_drc.overwritecurrentruleconfiguration.html)
- [Per-net rules](https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_drc.overwritenetrules.html)
- [Net-by-net rules](https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_drc.overwritenetbynetrules.html)
- [Region rules](https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_drc.overwriteregionrules.html)
- [Document types](https://prodocs.easyeda.com/en/api/reference/pro-api.edmt_editordocumenttype.html): PCB = 3, symbol = 2, footprint = 4

This does not run a DRC check, modify global defaults, rename/delete saved profiles, or manage net classes/differential pairs. Rule editing is distinct from heuristic schematic analysis and from DRC execution.

See the [pre-PR validation record](./local-validation.md) for executed checks, artifact hashes and remaining acceptance work.

## Reproduce local checks

```bash
npm ci
npm run typecheck
npm run typecheck:extension
npm test
npm run package:all
npm run test:smoke:drc
npm run docs:build
```

The smoke uses an isolated loopback port and simulated APIs. It does not connect to EasyEDA or change a real PCB.
