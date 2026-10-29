# Troubleshooting

Quick diagnostics and fixes organized by symptom and error code.

## Debugging & Diagnostics Checklist

Before diving into specific errors, run these two checks:

1. **From your AI client**: ask the agent to run [`easyeda_doctor`](./tools.md#easyeda_doctor) and inspect `extension.connected`, `compatibility.compatible`, and `activeDocument`.
2. **Inside EasyEDA Pro**: click **MCP Bridge -> Run Diagnostics** (or **MCP Bridge -> Show Status**) in the top toolbar to see whether the extension is connected to `ws://127.0.0.1:8765`.

---

## Common Symptoms

### `connected: false` in `easyeda_doctor`

1. Confirm EasyEDA Pro (`>= 2.3.0`) is open with a schematic or PCB tab loaded.
2. Open **Extensions -> Extensions Manager** and verify **EasyEDA MCP Bridge** is imported and **Allow interactive with external** is enabled.
3. Click **MCP Bridge -> Reconnect** in the EasyEDA Pro top toolbar.
4. Run `easyeda_doctor` again.

### No `easyeda_*` Tools Appear in the AI Client

1. Build the server so `dist/index.js` exists: `npm install && npm run setup:local`.
2. Confirm your client config points to the **absolute path** of `dist/index.js` (on Windows JSON files, escape backslashes: `C:\\Users\\you\\...\\dist\\index.js`).
3. Restart or refresh your MCP client — most clients load the tool catalog once at startup.

### WebSocket Bridge Fails to Connect (`ws://127.0.0.1:8765`)

- Verify another stale MCP server process is not occupying a mismatched port, and that `EASYEDA_MCP_WS_HOST` / `EASYEDA_MCP_WS_PORT` were not changed on only one side.
- Ensure local firewall or endpoint security software permits loopback (`127.0.0.1`) WebSocket connections.

### Old Extension Version Reported After Upgrade

Rebuilding the repository does not automatically update an extension already imported into EasyEDA Pro:

1. Import the updated `build/dist/easyeda_mcp_bridge.eext` in **Extensions Manager**.
2. Re-enable **Allow interactive with external** if EasyEDA Pro reset the toggle.
3. Click **MCP Bridge -> Reconnect** (or restart EasyEDA Pro if old callbacks remain cached).

### DRC Tool Returns `wrong_document` or `stale_edit`

- **`wrong_document`**: switch the active tab in EasyEDA Pro to the target **PCB** (`documentType: 3`); schematics, symbols, and footprints are rejected.
- **`stale_edit`**: the PCB tab, WebSocket session, or underlying rules changed after `easyeda_prepare_drc_edit`. Run `easyeda_prepare_drc_edit` again to generate a fresh `editId`.

### Schematic Snapshot Shows `partial` Confidence or Warnings

EasyEDA Pro may omit net names on raw schematic primitives in some sheets. Inspect the `warnings` array in `easyeda_schematic_snapshot`, narrow the query with `easyeda_trace_component`, and visually verify critical nets using `easyeda_navigate_component`.

---

## Error Code Reference

Structured errors returned by the bridge include an `errorCode` field for deterministic recovery:

| Error Code | Cause | Remediation |
| --- | --- | --- |
| `api_unavailable` | Required `eda.*` method is missing in your EasyEDA Pro version | Upgrade EasyEDA Pro (`>= 2.3.0`) and inspect `capabilities` in `easyeda_get_context`. |
| `wrong_document` | A PCB-only tool (such as DRC rules) was called while a schematic, symbol, or footprint tab was active | Focus the target **PCB** tab (`documentType: 3`) in EasyEDA Pro. |
| `missing_document_identity` | Active PCB lacks project, document, or tab UUIDs | Save and reopen the project tab inside EasyEDA Pro, then retry. |
| `confirmation_required` | Mutating action lacked the required approval phrase or exact `CONFIRM editDrcRules <editId>` | Obtain human approval and pass the exact confirmation string. |
| `configuration_exists` | `createConfiguration` used a profile name that already exists | Choose a new profile name (`allowOverwrite` is always `false`). |
| `stale_edit` | Active PCB, WebSocket session, or rule state changed after `easyeda_prepare_drc_edit` | Run `easyeda_prepare_drc_edit` again to generate a fresh preview. |
| `edit_expired` | Prepared DRC preview is older than 15 minutes | Prepare and review a new DRC edit (`easyeda_prepare_drc_edit`). |
| `edit_already_started` | Attempted to execute the same `editId` more than once | Call `easyeda_get_drc_edit_result` to inspect the existing outcome. |
| `drc_edit_outcome_unknown` | Bridge timed out or disconnected after dispatching a DRC write | **Do not auto-retry.** Query `easyeda_get_drc_edit_result` and reread rules with `easyeda_get_drc_rules`. |
