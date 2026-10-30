# Upgrading & Compatibility

EasyEDA Pro MCP consists of **two paired components**: the local Node.js MCP server (`dist/index.js`) and the browser extension (`easyeda_mcp_bridge.eext`) imported inside EasyEDA Pro.

::: warning Update Both Components Together
When upgrading to a new release, always update **both** the MCP server and the EasyEDA Pro `.eext` extension so tool schemas and WebSocket bridge methods remain compatible.
:::

## Version Compatibility Matrix

| Release Tag | MCP Server | Extension (`.eext`) | Bridge Protocol | EasyEDA Pro | Highlights |
| --- | --- | --- | --- | --- | --- |
| **`v1.3.0`** | `1.3.0` | `0.3.0` | `0.1.0` | `>= 2.3.0` | Active PCB DRC execution (`easyeda_run_drc`), CPL/Pick-and-Place export (`easyeda_export_cpl`), PCB layer stackup (`easyeda_get_pcb_layers`), and routing status (`easyeda_get_routing_status`) (28 tools total) |
| `v1.2.0` | `1.2.0` | `0.2.0` | `0.1.0` | `>= 2.3.0` | One-command `npx` client auto-setup, bundled `.eext` export, Cursor/VS Code 1-click links, and Claude Desktop `.mcpb` bundle |
| `v1.1.0` | `1.1.0` | `0.2.0` | `0.1.0` | `>= 2.3.0` | Native PCB DRC rule reads, previews, and confirmed updates (`#14`) + all `v0.1.0` capabilities (24 tools total) |
| `v0.1.0` | `0.1.0` | `0.1.0` | `0.1.0` | `>= 2.3.0` | Live context, schematic analysis, tracing, connection assertions, navigation, and exports (21 tools) |

## 3-Step Upgrade Checklist

### 1. Update the Server & Export the Matching `.eext`

::: code-group

```bash [npx (Recommended)]
npx -y @vlabsoftware/easyeda-pro-mcp@latest setup
```

```bash [Local Repository Clone]
git pull origin master
npm install
npm run setup:local
```

:::

::: tip Prebuilt Release Packages (.eext & Claude Desktop .mcpb)
You can also download [`easyeda_mcp_bridge.eext`](https://github.com/VLab-Software/easyeda_mcp/releases/latest/download/easyeda_mcp_bridge.eext) and [`easyeda-pro-mcp.mcpb`](https://github.com/VLab-Software/easyeda_mcp/releases/latest/download/easyeda-pro-mcp.mcpb) directly from [GitHub Releases](https://github.com/VLab-Software/easyeda_mcp/releases/latest).
:::

### 2. Re-import the Extension in EasyEDA Pro

Rebuilding the repository does **not** automatically replace an extension already installed inside EasyEDA Pro:

1. In EasyEDA Pro, open **Extensions -> Extensions Manager** and import `build/dist/easyeda_mcp_bridge.eext` (or the downloaded release `.eext`).
2. Confirm **Allow interactive with external** is still enabled (EasyEDA Pro may reset this toggle on re-import).
3. Click **MCP Bridge -> Reconnect** in the top menu (or restart EasyEDA Pro if old callbacks remain cached in memory).

### 3. Reload Your AI Client & Verify

Restart or refresh your MCP client so it reloads the updated tool catalog, then run:

```text
Run easyeda_doctor and check the server and extension versions.
```

Confirm the response matches the Compatibility Matrix above:

- `server.version: "1.3.0"`
- `extension.version: "0.3.0"`
- `compatibility.compatible: true`
