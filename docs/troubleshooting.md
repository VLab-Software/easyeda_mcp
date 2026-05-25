# Troubleshooting

This guide covers common setup and runtime issues for the EasyEDA Pro MCP Bridge.

## The extension is not connected

Symptoms:

- `easyeda_live_status` reports `connected: false`
- the MCP server starts, but no editor data is available

Things to check:

1. confirm the MCP server is running
2. confirm EasyEDA Pro is open
3. confirm the extension is installed or loaded
4. confirm external interaction permission is enabled
5. use `MCP Bridge -> Connect to MCP` manually

## The MCP client does not show newly added tools

Symptoms:

- a tool exists in the codebase but does not appear in the MCP client

Cause:

- the client may still be using an older tool catalog from an existing session

Fix:

1. rebuild the server
2. restart the MCP client session
3. reconnect the extension if needed

## The WebSocket bridge never connects

Things to check:

1. confirm the bridge is using the expected endpoint
2. confirm the extension is targeting the same endpoint
3. confirm `EASYEDA_MCP_WS_HOST` and `EASYEDA_MCP_WS_PORT` were not changed unexpectedly
4. confirm local firewall or security tooling is not blocking loopback communication

Default endpoint:

- `ws://127.0.0.1:8765`

## The extension builds, but EasyEDA Pro does not accept the package

Things to check:

1. `extension.json` is at the package root
2. the extension `name` uses lowercase-hyphen style
3. the `uuid` is exactly 32 lowercase alphanumeric characters
4. the bundle was built with the expected format

## Schematic analysis results look incomplete

Symptoms:

- missing pins
- weak net inference
- sparse trace output
- low confidence

Possible reasons:

- EasyEDA Pro did not expose all raw primitives needed for the snapshot
- schematic wires or pins were not returned by the API
- the analysis layer had to infer connectivity from partial data

What to do:

1. inspect `easyeda_schematic_snapshot`
2. review `warnings`
3. review `confidence`
4. cross-check the target area in the EasyEDA Pro editor

## Navigation does not move to the expected location

Possible reasons:

- the matched component did not expose a usable primitive id
- the EasyEDA API did not return a usable bounding box
- the query matched a different object than expected

What to do:

1. narrow the component query
2. inspect the match returned by `easyeda_find_component`
3. try `easyeda_trace_component` first to confirm the target

## Export tools fail

Things to check:

1. confirm the relevant EasyEDA Pro manufacture API is available in the active document type
2. confirm the active document is the expected schematic or PCB context
3. retry with an explicit scope where supported

## Confirmed actions are blocked

Cause:

- the confirmation text did not include an explicit confirmation phrase

Fix:

Use a clearly affirmative confirmation string such as:

- `I confirm`
- `confirmed`
- `confirma salvar`

## When in Doubt

A reliable recovery flow is:

1. restart the MCP client session
2. restart the local server
3. reopen EasyEDA Pro if necessary
4. reconnect the extension
5. re-run `easyeda_live_status`
