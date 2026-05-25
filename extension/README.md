# EasyEDA MCP Bridge Extension

This extension connects EasyEDA Pro to the local MCP bridge at:

```text
ws://127.0.0.1:8765
```

It is required for live editor access. Without it, the MCP server can start, but tools cannot inspect the open EasyEDA Pro session.

## Build

Run from the repository root:

```bash
npm run setup:local
```

This creates:

```text
extension/dist/index.js
```

The manifest is:

```text
extension/extension.json
```

## Install

In EasyEDA Pro:

1. import or load the packaged extension
2. enable external interaction permission
3. open a schematic or PCB
4. use `MCP Bridge -> Reconnect` if it does not connect automatically
5. use `MCP Bridge -> Run Diagnostics` if you need extension-side status

## Verify

From your MCP client, run:

```text
Run easyeda_doctor.
```

Healthy output should show:

- extension connected
- bridge protocol compatible
- active document available

## Notes

- This project is live-extension only; it does not parse `.epro` archives.
- Read, navigation, and export tools run directly.
- Project-changing actions go through `easyeda_confirmed_action`.
- Connection defaults are defined in `extension/src/bridgeConfig.ts`.
