# EasyEDA Pro Extension Setup

The extension is what gives the MCP server live access to EasyEDA Pro.

Without it, the MCP server can start, but tools cannot inspect the open editor session.

## Quick Path

From the repository root:

```bash
npm run setup:local
```

Then in EasyEDA Pro:

1. import or load the packaged extension
2. enable external interaction permission
3. open a schematic or PCB
4. use `MCP Bridge -> Reconnect` if it does not connect automatically
5. run `easyeda_doctor` from your MCP client

## What Gets Built

`npm run setup:local` creates:

```text
dist/index.js
extension/dist/index.js
```

It also packages the EasyEDA extension artifact for import workflows.

The extension manifest lives at:

```text
extension/extension.json
```

## Permission You Must Enable

EasyEDA Pro may disable external interaction for local extensions.

Enable it for this extension. The bridge needs it because the extension uses `SYS_WebSocket` to connect to:

```text
ws://127.0.0.1:8765
```

If this permission is off, the MCP client may show tools, but live editor calls will fail.

## Verify

After EasyEDA Pro is open and the extension is loaded, ask your MCP client:

```text
Run easyeda_doctor.
```

Healthy output should show:

- `connected: true`
- compatible bridge protocol
- an active project or document

Then ask:

```text
Run easyeda_get_context.
```

## Extension Menu

Use these commands inside EasyEDA Pro when needed:

- `MCP Bridge -> Reconnect`
- `MCP Bridge -> Run Diagnostics`

`Reconnect` is the fastest fix when the server was restarted after EasyEDA Pro was already open.

## Packaging Rules

These details matter if you change the extension package:

- `extension.json` must be at the package root
- extension `name` must use lowercase-hyphen style
- `uuid` must be exactly 32 lowercase alphanumeric characters
- the browser bundle must use EasyEDA-compatible output

Current bundle settings:

- `esbuild`
- `format=iife`
- `globalName=edaEsbuildExportName`

## Related Files

- `extension/src/index.ts`
- `extension/src/bridgeConfig.ts`
- `extension/extension.json`
- `scripts/package-extension.mjs`
