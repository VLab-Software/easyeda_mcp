# Quick Start

Connect any MCP-compatible AI assistant to your live EasyEDA Pro session in a few minutes.

::: info Requirements
- **Node.js** `20.0.0` or newer
- **EasyEDA Pro** `2.3.0` or newer (desktop or web app with an open schematic or PCB)
- An **MCP client** (Claude Code, Codex, Claude Desktop, Cursor, VS Code Copilot, Antigravity, Windsurf, Cline, Zed, etc.)
:::

## 1. Clone & Build

Clone the repository and build both the local MCP server and the EasyEDA Pro extension package:

```bash
git clone https://github.com/VLab-Software/easyeda_mcp.git
cd easyeda_mcp
npm install
npm run setup:local
```

This produces two artifacts:

| Artifact | Path | Purpose |
| --- | --- | --- |
| **MCP Server** | `dist/index.js` | Local `stdio` MCP server launched by your AI client |
| **EasyEDA Extension** | `build/dist/easyeda_mcp_bridge.eext` | Browser extension imported into EasyEDA Pro (also available on [GitHub Releases](https://github.com/VLab-Software/easyeda_mcp/releases/latest)) |

## 2. Install the EasyEDA Pro Extension

1. In EasyEDA Pro, open **Extensions -> Extensions Manager** and import `build/dist/easyeda_mcp_bridge.eext` (or download [`easyeda_mcp_bridge.eext`](https://github.com/VLab-Software/easyeda_mcp/releases/latest/download/easyeda_mcp_bridge.eext) from the latest release).
2. Enable **Allow interactive with external** for **EasyEDA MCP Bridge** (required for local WebSocket access on `ws://127.0.0.1:8765`).
3. Open a schematic or PCB document.
4. Click **MCP Bridge -> Reconnect** in the top menu if the server was started after EasyEDA Pro.

## 3. Add the MCP Server to Your AI Client

Replace `/absolute/path/to/easyeda_mcp` with your cloned directory (`pwd` on macOS/Linux, `(Get-Location).Path` on Windows PowerShell).

::: code-group

```json [Standard MCP JSON]
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "node",
      "args": ["/absolute/path/to/easyeda_mcp/dist/index.js"]
    }
  }
}
```

```bash [Claude Code]
claude mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
```

```bash [Codex]
codex mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
```

```json [VS Code (.vscode/mcp.json)]
{
  "servers": {
    "easyeda-pro": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/easyeda_mcp/dist/index.js"]
    }
  }
}
```

:::

::: tip Windows JSON paths
In JSON configuration files on Windows, escape backslashes: `"C:\\Users\\you\\easyeda_mcp\\dist\\index.js"`. See [AI Client Setup](./ai-client-setup.md) for exact configuration file paths per client.
:::

## 4. Verify with Your First Prompts

Enter any of the following prompts in your AI client to confirm end-to-end connectivity:

```text
Run easyeda_doctor and check whether my EasyEDA Pro session is connected and healthy.
```

```text
Inspect the open schematic, list all components, and check for unconnected pins.
```

```text
Read the current PCB DRC rules and summarize track width, clearance, and via constraints.
```

You are ready when `easyeda_doctor` reports:

- `extension.connected: true`
- `compatibility.compatible: true`
- `activeDocument.available: true`

## Next Steps

- **[AI Client Setup](./ai-client-setup.md)** — client-specific config files and environment variables
- **[Practical Workflows](./workflows.md)** — copy-pasteable prompts for schematic reviews, circuit assertions, DRC rules, and manufacturing exports
- **[Tools Reference](./tools.md)** — full specification of all 24 MCP tools
- **[DRC Rule Editing](./drc-rules.md)** — two-phase preview and confirmation workflow for PCB design rules
