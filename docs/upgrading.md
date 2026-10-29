# Upgrading & Compatibility

EasyEDA Pro MCP consists of **two paired components**: the Node.js MCP server and the `.eext` extension imported inside EasyEDA Pro. When upgrading, update **both** so new tools and bridge methods match.

## Compatibility Matrix

| Release Tag | MCP Server | Extension (`.eext`) | Bridge Protocol | EasyEDA Pro | Key Capabilities |
| --- | --- | --- | --- | --- | --- |
| **`v1.1.0`** | `1.1.0` | `0.2.0` | `0.1.0` | `>= 2.3.0` | Native PCB DRC rule reads, previews, confirmed updates (`#14`), + all `v0.1.0` tools (24 tools total) |
| `v0.1.0` | `0.1.0` | `0.1.0` | `0.1.0` | `>= 2.3.0` | Live context, schematic analysis, tracing, connection assertions, navigation, exports (21 tools) |

## 3-Step Upgrade Flow

### 1. Update the Server & Build

Pull the latest release from GitHub and rebuild:

```bash
git pull origin master
npm install
npm run setup:local
```

> Prefer downloading prebuilt extensions? Grab `easyeda_mcp_bridge.eext` from [GitHub Releases](https://github.com/VLab-Software/easyeda_mcp/releases/latest).

### 2. Re-import the Extension in EasyEDA Pro

Rebuilding the repository does **not** automatically replace an extension already installed inside EasyEDA Pro:

1. In EasyEDA Pro, open **Extensions Manager** and import `build/dist/easyeda_mcp_bridge.eext` (or the downloaded release `.eext`).
2. Confirm **Allow interactive with external** is still enabled (EasyEDA Pro may reset this toggle on re-import).
3. Click **MCP Bridge -> Reconnect** in the top menu (or restart EasyEDA Pro if the old extension version remains cached in memory).

### 3. Reload Your AI Client & Verify

Restart or refresh your MCP client so it reloads the updated tool catalog, then run:

```text
Run easyeda_doctor and check the server and extension versions.
```

Confirm the output matches the Compatibility Matrix above (`server.version: "1.1.0"`, `extension.version: "0.2.0"`, `compatibility.compatible: true`).
