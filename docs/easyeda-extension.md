# EasyEDA Pro Extension

The browser extension connects your open EasyEDA Pro session to the local MCP server over `ws://127.0.0.1:8765`.

## 1. Get the `.eext` Package

Either:

- **Download** `easyeda_mcp_bridge.eext` from [GitHub Releases](https://github.com/VLab-Software/easyeda_mcp/releases/latest), or
- **Build locally** with `npm run setup:local`, which outputs `build/dist/easyeda_mcp_bridge.eext` (and the versioned `build/dist/easyeda-mcp-bridge_v0.2.0.eext`).

## 2. Install & Enable Permission

1. In EasyEDA Pro (`>= 2.3.0`), open **Extensions Manager** and import the `.eext` file.
2. Enable **Allow interactive with external** (required so `SYS_WebSocket` can connect to `ws://127.0.0.1:8765`).
3. Open a schematic or PCB document.
4. If the server started after EasyEDA Pro, click **MCP Bridge -> Reconnect** in the top menu.

## 3. Menu Actions & Verification

The extension adds an **MCP Bridge** menu on the Home, Schematic, and PCB toolbars:

- **Connect / Reconnect**: establish or refresh the WebSocket link to the MCP server.
- **Show Status / Run Diagnostics**: display connection state and active document info inside EasyEDA Pro.

From your AI client, verify end-to-end health with:

```text
Run easyeda_doctor.
```

## Upgrading the Extension

Rebuilding or updating the MCP server does **not** automatically update an extension already imported into EasyEDA Pro:

1. Import the new `.eext` in **Extensions Manager**.
2. Re-enable **Allow interactive with external** if EasyEDA Pro reset it.
3. Click **MCP Bridge -> Reconnect** (or restart EasyEDA Pro if old callbacks remain cached).
4. Restart your MCP client session and check `extension.version` via `easyeda_doctor`.

## Contributor Packaging Rules

If you modify `extension/`:

| Constraint | Requirement |
| --- | --- |
| Manifest location | `extension.json` at the `.eext` archive root |
| `name` | 5–30 lowercase letters, digits, or hyphens (`easyeda-mcp-bridge`) |
| `uuid` | Exactly 32 lowercase alphanumeric characters |
| Bundle format | `esbuild` with `--platform=browser --format=iife --global-name=edaEsbuildExportName` |
