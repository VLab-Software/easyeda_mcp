# Quick Start

Connect an AI assistant to your live EasyEDA Pro session in 4 steps.

**Requirements:** Node.js `>= 20` and EasyEDA Pro `>= 2.3.0`.

## 1. Build Server & Extension

From the repository root:

```bash
npm install
npm run setup:local
```

This creates:

- `dist/index.js` — the local MCP server
- `build/dist/easyeda_mcp_bridge.eext` — the EasyEDA Pro extension (also available on [GitHub Releases](https://github.com/VLab-Software/easyeda_mcp/releases/latest))

## 2. Connect Your AI Client

Replace `/absolute/path/to/easyeda_mcp` with your cloned directory (`pwd` on macOS/Linux, `(Get-Location).Path` on Windows PowerShell).

::: code-group

```bash [Claude Code]
claude mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
```

```bash [Codex CLI]
codex mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
```

```json [Claude Desktop / Cursor / Antigravity]
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "node",
      "args": ["/absolute/path/to/easyeda_mcp/dist/index.js"]
    }
  }
}
```

```json [VS Code (.vscode/mcp.json)]
{
  "servers": {
    "easyeda-pro": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/dist/index.js"]
    }
  }
}
```

:::

> On Windows JSON configs, escape backslashes: `"C:\\Users\\you\\easyeda_mcp\\dist\\index.js"`. See [AI Client Setup](./ai-client-setup.md) for exact config file paths per client.

## 3. Load the EasyEDA Pro Extension

1. Open EasyEDA Pro and import `build/dist/easyeda_mcp_bridge.eext` in **Extensions Manager**.
2. Enable **Allow interactive with external** for the extension.
3. Open a schematic or PCB document.
4. Click **MCP Bridge -> Reconnect** if it does not connect automatically.

## 4. Verify

Run this prompt in your AI client:

```text
Run easyeda_doctor and check whether the EasyEDA Pro bridge is healthy.
```

You are ready when `easyeda_doctor` reports:

- `extension.connected: true`
- `compatibility.compatible: true`
- `activeDocument.available: true`

Next steps: explore [Tools Reference](./tools.md), [DRC Rule Editing](./drc-rules.md), or [Troubleshooting](./troubleshooting.md).
