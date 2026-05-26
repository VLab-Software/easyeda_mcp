# Troubleshooting

Start with the symptom you see.

## Extension Is Not Connected

You may see:

- `easyeda_live_status` returns `connected: false`
- `easyeda_doctor` says the extension is disconnected
- tool calls fail even though the MCP server starts

Fix:

1. make sure the MCP client is running
2. make sure EasyEDA Pro is open
3. open a schematic or PCB
4. confirm the extension is installed or loaded
5. enable external interaction permission
6. run `MCP Bridge -> Reconnect`
7. run `easyeda_doctor` again

## MCP Client Does Not Show Tools

You may see:

- the server is configured, but no `easyeda_*` tools appear
- new tools exist in code but not in the client

Fix:

1. run `npm run setup:local`
2. restart the MCP client
3. reconnect the EasyEDA Pro extension

Why: most MCP clients load the tool catalog when the session starts.

## `dist/index.js` Is Missing

Fix:

```bash
npm run setup:local
```

If you only need the server build:

```bash
npm run build
```

## WebSocket Bridge Does Not Connect

Default endpoint:

```text
ws://127.0.0.1:8765
```

Check:

1. the MCP server is running
2. the extension is targeting the same host and port
3. `EASYEDA_MCP_WS_HOST` was not changed unexpectedly
4. `EASYEDA_MCP_WS_PORT` was not changed unexpectedly
5. local security tooling is not blocking loopback WebSocket traffic

## EasyEDA Pro Rejects the Extension Package

Check:

1. `extension.json` is at the package root
2. the extension `name` uses lowercase-hyphen style
3. the `uuid` is exactly 32 lowercase alphanumeric characters
4. the bundle was built with `format=iife`
5. the global name is `edaEsbuildExportName`

Rebuild:

```bash
npm run setup:local
```

## Schematic Results Look Incomplete

You may see:

- missing pins
- sparse net traces
- low confidence
- warnings in `easyeda_schematic_snapshot`

What to do:

1. run `easyeda_schematic_snapshot`
2. inspect `warnings`
3. inspect `confidence`
4. run a narrower tool such as `easyeda_trace_component`
5. cross-check critical findings in EasyEDA Pro

Why: EasyEDA Pro may expose partial raw schematic primitives, so some connectivity is inferred.

## Navigation Goes to the Wrong Place

Fix:

1. search first with `easyeda_find_component`
2. use a more exact designator, such as `USB1` instead of `USB`
3. run `easyeda_trace_component` to confirm the target
4. then call `easyeda_navigate_component`

## Export Tools Fail

Check:

1. the active document type supports that export
2. the expected schematic or PCB is currently active
3. the extension is connected
4. the relevant EasyEDA manufacture API is available

Then run:

```text
Run easyeda_doctor.
```

## Confirmed Actions Are Blocked

Mutating actions require explicit confirmation.

Use a confirmation string such as:

- `I confirm`
- `confirmed`
- `confirma salvar`
- `confirmo`

Example:

```json
{
  "action": "save",
  "confirmation": "I confirm"
}
```

## Reliable Reset

When the state is confusing:

1. stop the MCP client
2. reopen EasyEDA Pro
3. start the MCP client again
4. open the target project
5. run `MCP Bridge -> Reconnect`
6. run `easyeda_doctor`
