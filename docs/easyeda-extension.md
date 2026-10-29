# EasyEDA Pro Extension

The **EasyEDA MCP Bridge** browser extension (`easyeda_mcp_bridge.eext`) connects your open EasyEDA Pro session to the local MCP server over `ws://127.0.0.1:8765`.

## 1. Download or Export the `.eext` Package

Choose whichever option is easiest:

- **Export via `npx`** (bundled with the matching MCP server version):
  ```bash
  npx -y @vlabsoft/easyeda-pro-mcp export-extension .
  ```
  *(Running `npx -y @vlabsoft/easyeda-pro-mcp setup` also exports `easyeda_mcp_bridge.eext` automatically.)*
- **Prebuilt release**: download [`easyeda_mcp_bridge.eext`](https://github.com/VLab-Software/easyeda_mcp/releases/latest/download/easyeda_mcp_bridge.eext) (or the versioned `easyeda-mcp-bridge_v0.2.0.eext`) from [GitHub Releases](https://github.com/VLab-Software/easyeda_mcp/releases/latest).
- **Local build**: run `npm run setup:local` in the repository root to generate `build/dist/easyeda_mcp_bridge.eext`.

## 2. Import & Enable External Access

1. In EasyEDA Pro (`>= 2.3.0`), open **Extensions -> Extensions Manager** and import the `.eext` file.
2. Enable **Allow interactive with external** for **EasyEDA MCP Bridge**.
3. Open a schematic or PCB document.
4. Click **MCP Bridge -> Reconnect** in the top toolbar if the MCP server was started after EasyEDA Pro.

::: warning Required Permission
Without **Allow interactive with external**, EasyEDA Pro blocks `eda.sys_WebSocket` from connecting to `ws://127.0.0.1:8765` and `easyeda_doctor` will report `connected: false`.
:::

## 3. Toolbar Menu Commands

Once enabled, the extension adds an **MCP Bridge** menu across the **Home**, **Schematic**, and **PCB** toolbars:

| Menu Command | Description |
| --- | --- |
| **Connect / Reconnect** | Establish or refresh the WebSocket connection to `ws://127.0.0.1:8765`. |
| **Disconnect** | Cleanly close the active WebSocket bridge connection. |
| **Show Status** | Display a toast with the current connection state and bridge URL. |
| **Run Diagnostics** | Inspect active document metadata, capability detection, and handshake status inside EasyEDA Pro. |

## 4. Upgrading the Extension

Rebuilding or pulling the MCP server repository does **not** automatically replace an extension already imported into EasyEDA Pro. After upgrading:

1. Import the new `easyeda_mcp_bridge.eext` in **Extensions Manager**.
2. Verify **Allow interactive with external** is still enabled.
3. Click **MCP Bridge -> Reconnect** (or restart EasyEDA Pro if previous callbacks remain cached).
4. Run `easyeda_doctor` from your AI client and confirm `extension.version: "0.2.0"` and `compatibility.compatible: true`.

## Extension Packaging Specification

If you modify code under `extension/`:

| Property | Requirement |
| --- | --- |
| Archive layout | `extension.json` must sit at the root of the `.eext` zip archive |
| `name` | `5–30` lowercase ASCII letters, digits, or hyphens (`easyeda-mcp-bridge`) |
| `uuid` | Exactly `32` lowercase alphanumeric characters (`a4b7d48db3c44b2c9ad13a5a8c8b6071`) |
| Bundle target | `esbuild` with `--platform=browser --format=iife --global-name=edaEsbuildExportName` |
