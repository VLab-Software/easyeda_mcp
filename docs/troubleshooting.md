# Troubleshooting

Quick fixes organized by symptom.

## `connected: false` in `easyeda_doctor`

1. Confirm EasyEDA Pro is open with a schematic or PCB tab loaded.
2. Open **Extensions Manager** and verify **EasyEDA MCP Bridge** is imported and **Allow interactive with external** is enabled.
3. Click **MCP Bridge -> Reconnect** in the EasyEDA Pro top toolbar.
4. Run `easyeda_doctor` again.

## No `easyeda_*` Tools Appear in the AI Client

1. Build the server: `npm run setup:local` (verifies `dist/index.js` exists).
2. Check that your client config uses the **absolute path** to `dist/index.js` (on Windows JSON, escape backslashes: `C:\\Users\\you\\...\\dist\\index.js`).
3. Restart or refresh your MCP client — most clients load the tool catalog once at session startup.

## WebSocket Bridge Fails to Connect (`ws://127.0.0.1:8765`)

- Check that another stale MCP server process is not occupying a mismatched port, and that `EASYEDA_MCP_WS_HOST` / `EASYEDA_MCP_WS_PORT` were not overridden on only one side.
- Ensure local firewall or endpoint security software allows loopback (`127.0.0.1`) WebSocket connections.

## Old Extension Version Reported After Upgrade

Rebuilding the repo does not auto-update an imported extension in EasyEDA Pro:

1. Import the updated `build/dist/easyeda_mcp_bridge.eext` in **Extensions Manager**.
2. Re-enable **Allow interactive with external** if it was reset.
3. Restart EasyEDA Pro if old callbacks remain cached, then click **MCP Bridge -> Reconnect**.

## DRC Tool Returns `wrong_document` or `stale_edit`

- **`wrong_document`**: switch the active tab in EasyEDA Pro to the target **PCB** (`documentType: 3`); schematics, symbols, and footprints are rejected.
- **`stale_edit`**: the PCB tab, connection, or rules changed after `easyeda_prepare_drc_edit`. Run `easyeda_prepare_drc_edit` again to generate a fresh `editId`.

## Schematic Snapshot Shows `partial` Confidence or Warnings

EasyEDA Pro may omit net names on raw schematic primitives in some sheets. Inspect the `warnings` array in `easyeda_schematic_snapshot`, narrow the query with `easyeda_trace_component`, and visually verify critical nets using `easyeda_navigate_component`.

## Error Code Reference

| Error Code | Cause | Fix |
| --- | --- | --- |
| `api_unavailable` | Required `eda.*` method is missing in your EasyEDA Pro version | Upgrade EasyEDA Pro (`>= 2.3.0`) and check `capabilities` in `easyeda_get_context`. |
| `wrong_document` | A PCB-only tool (such as DRC rules) was called while a schematic, symbol, or footprint tab was active | Focus the target **PCB** tab (`documentType: 3`) in EasyEDA Pro. |
| `missing_document_identity` | Active PCB lacks project, document, or tab UUIDs | Save/reopen the project tab inside EasyEDA Pro and retry. |
| `confirmation_required` | Mutating action lacked the required confirmation phrase or exact `CONFIRM editDrcRules <editId>` | Obtain human approval and pass the exact confirmation string. |
| `configuration_exists` | `createConfiguration` used a profile name that already exists | Choose a new profile name (`allowOverwrite` is always `false`). |
| `stale_edit` | Active PCB, WebSocket session, or rule state changed after `easyeda_prepare_drc_edit` | Run `easyeda_prepare_drc_edit` again to generate a fresh preview. |
| `edit_expired` | Prepared DRC preview is older than 15 minutes | Prepare and review a new DRC edit. |
| `edit_already_started` | Attempted to execute the same `editId` more than once | Call `easyeda_get_drc_edit_result` to inspect the existing outcome. |
| `drc_edit_outcome_unknown` | Bridge timed out or disconnected after dispatching a DRC write | **Do not auto-retry.** Query `easyeda_get_drc_edit_result` and reread rules with `easyeda_get_drc_rules`. |
