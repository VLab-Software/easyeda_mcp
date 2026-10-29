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

## Upgrading for DRC Rule Editing

The #14 implementation changes both the MCP server and the extension. Updating only the server is insufficient. This branch packages extension **0.2.0-rc.1** as `build/dist/easyeda-mcp-bridge_v0.2.0-rc.1.eext` and the alias `easyeda_mcp_bridge.eext`; these are development artifacts, not a published release.

After `npm run setup:local`, manually import the new `.eext` in Extensions Manager. Confirm its version, fully quit/reopen the editor if callbacks still report the old version, restore **Allow interactive with external** if the editor disabled it, and reconnect. Restart the MCP client to reload its tool catalog. Rebuilds do not update an already-installed extension automatically.

Use `easyeda_doctor` and `easyeda_get_context` to verify server `1.1.0-rc.1`, extension `0.2.0-rc.1`, protocol compatibility and the intended PCB. Check `capabilities.drcRules` for each method before using the experimental [DRC tools](./drc-rules.md). A Connected toast alone is not proof that RPC is using the new bundle.

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
