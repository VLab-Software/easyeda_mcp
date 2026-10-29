# Quick Start

Connect any MCP-compatible AI assistant to your live EasyEDA Pro session in a few minutes — no repository clone required.

::: info Requirements
- **Node.js** `20.0.0` or newer
- **EasyEDA Pro** `2.3.0` or newer (desktop or web app with an open schematic or PCB)
- An **MCP client** (Claude Code, Codex, Claude Desktop, Cursor, VS Code Copilot, Antigravity, Windsurf, Cline, Zed, etc.)
:::

## 1. Automatic Client Setup & Extension Export

Run one command in your terminal:

```bash
npx -y @vlabsoft/easyeda-pro-mcp setup
```

This automatically configures detected AI clients on your machine and exports the matching EasyEDA Pro extension package:

| Component | How It Is Configured | Purpose |
| --- | --- | --- |
| **MCP Server** | Registered as `easyeda-pro` via `npx` | Local `stdio` MCP server launched automatically by your AI client |
| **EasyEDA Extension** | Exported to `~/Downloads/easyeda_mcp_bridge.eext` (or cwd) | Browser extension imported into EasyEDA Pro (also on [GitHub Releases](https://github.com/VLab-Software/easyeda_mcp/releases/latest)) |

::: tip Prefer building from source?
If you cloned the repository to contribute or test local changes, run `npm install && npm run setup:local`, then `npm run setup:clients` to point your AI clients to your local `dist/index.js`.
:::

## 2. Install the EasyEDA Pro Extension

1. In EasyEDA Pro, open **Extensions -> Extensions Manager** and import the exported `easyeda_mcp_bridge.eext` (or download [`easyeda_mcp_bridge.eext`](https://github.com/VLab-Software/easyeda_mcp/releases/latest/download/easyeda_mcp_bridge.eext) from the latest release).
2. Enable **Allow interactive with external** for **EasyEDA MCP Bridge** (required for local WebSocket access on `ws://127.0.0.1:8765`).
3. Open a schematic or PCB document.
4. Click **MCP Bridge -> Reconnect** in the top menu if the server was started after EasyEDA Pro.

## 3. Manual / 1-Click Client Setup (Optional)

If you prefer configuring a single client manually instead of running `npx -y @vlabsoft/easyeda-pro-mcp setup`:

::: code-group

```json [Standard MCP JSON (macOS / Linux)]
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "npx",
      "args": ["-y", "@vlabsoft/easyeda-pro-mcp"]
    }
  }
}
```

```json [Standard MCP JSON (Windows)]
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@vlabsoft/easyeda-pro-mcp"]
    }
  }
}
```

```bash [Claude Code]
claude mcp add --scope user easyeda-pro -- npx -y @vlabsoft/easyeda-pro-mcp
```

```bash [Codex]
codex mcp add easyeda-pro -- npx -y @vlabsoft/easyeda-pro-mcp
```

```json [VS Code (.vscode/mcp.json)]
{
  "servers": {
    "easyeda-pro": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@vlabsoft/easyeda-pro-mcp"]
    }
  }
}
```

:::

::: tip 1-Click Install Links & Claude Desktop Bundle
See [AI Client Setup](./ai-client-setup.md) for **1-Click Install** links for Cursor and VS Code, the 1-click `.mcpb` bundle for Claude Desktop, and exact configuration file paths per client.
:::

## 4. Verify with Your First Prompts

Reload or restart your AI client, then enter any of the following prompts to confirm end-to-end connectivity:

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

- **[AI Client Setup](./ai-client-setup.md)** — 1-click install links, client-specific config files, and environment variables
- **[Practical Workflows](./workflows.md)** — copy-pasteable prompts for schematic reviews, circuit assertions, DRC rules, and manufacturing exports
- **[Tools Reference](./tools.md)** — full specification of all 24 MCP tools
- **[DRC Rule Editing](./drc-rules.md)** — two-phase preview and confirmation workflow for PCB design rules
