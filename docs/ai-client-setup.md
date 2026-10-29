# AI Client Setup

All MCP clients launch the same compiled server over `stdio`:

```bash
node /absolute/path/to/easyeda_mcp/dist/index.js
```

Make sure `dist/index.js` exists first (`npm install && npm run setup:local`).

| Client | Configuration Method |
| --- | --- |
| [Claude Code CLI](#claude-code-cli) | `claude mcp add` or project `.mcp.json` |
| [Codex CLI](#codex-cli) | `codex mcp add` |
| [Claude Desktop](#claude-desktop) | `claude_desktop_config.json` |
| [Cursor](#cursor) | `~/.cursor/mcp.json` or `.cursor/mcp.json` |
| [VS Code](#vs-code) | `.vscode/mcp.json` (`servers` schema) |
| [Antigravity](#antigravity) | `~/.gemini/config/mcp_config.json` |
| [Generic MCP Clients](#generic-mcp-clients) | Any `stdio` MCP client (Windsurf, Cline, Zed, etc.) |

---

## Claude Code CLI

```bash
claude mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
claude mcp list
```

Or add `.mcp.json` at your project root:

```json
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "node",
      "args": ["/absolute/path/to/easyeda_mcp/dist/index.js"]
    }
  }
}
```

## Codex CLI

```bash
codex mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
codex mcp list
```

## Claude Desktop

Edit `claude_desktop_config.json`, then **fully quit and reopen** Claude Desktop:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

::: code-group

```json [macOS]
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "node",
      "args": ["/Users/you/Documents/easyeda_mcp/dist/index.js"]
    }
  }
}
```

```json [Windows]
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "node",
      "args": ["C:\\Users\\you\\Documents\\easyeda_mcp\\dist\\index.js"]
    }
  }
}
```

:::

## Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (workspace), then refresh MCP servers in **Cursor Settings -> MCP**:

```json
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "node",
      "args": ["/absolute/path/to/easyeda_mcp/dist/index.js"]
    }
  }
}
```

## VS Code

Create `.vscode/mcp.json` in your workspace and open **Copilot Chat (Agent mode)**:

```json
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

> If your VS Code workspace is this repository itself, you can use `"${workspaceFolder}/dist/index.js"`.

## Antigravity

Add to `~/.gemini/config/mcp_config.json`, then click **Refresh** in **Additional Options (`...`) -> MCP Servers**:

```json
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "node",
      "args": ["/absolute/path/to/easyeda_mcp/dist/index.js"]
    }
  }
}
```

## Generic MCP Clients

Any client supporting local `stdio` MCP servers (Windsurf, Cline, Zed, Gemini CLI, etc.) can run `node /absolute/path/to/easyeda_mcp/dist/index.js`.

Optional environment variables (change only if you also update `extension/src/bridgeConfig.ts`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `EASYEDA_MCP_WS_HOST` | `127.0.0.1` | Local WebSocket host for the extension bridge |
| `EASYEDA_MCP_WS_PORT` | `8765` | Local WebSocket port for the extension bridge |

---

## Verify Connection

Once your AI client and the [EasyEDA Pro Extension](./easyeda-extension.md) are running with a schematic or PCB open:

```text
Run easyeda_doctor and summarize the bridge status.
Run easyeda_get_context and tell me which document is open.
```

If tools do not appear or `connected` is `false`, check [Troubleshooting](./troubleshooting.md).
