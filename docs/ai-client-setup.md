# AI Client Setup

All MCP clients launch the same local Node.js server over `stdio`. Make sure you have built `dist/index.js` first (`npm install && npm run setup:local`).

## Standard MCP Configuration

Most MCP clients use this standard JSON configuration:

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

| Client | Configuration Location / Command |
| --- | --- |
| [Claude Code CLI](#claude-code-cli) | `claude mcp add` or project `.mcp.json` |
| [Codex CLI](#codex-cli) | `codex mcp add` or `~/.codex/config.toml` |
| [Claude Desktop](#claude-desktop) | `claude_desktop_config.json` |
| [Cursor](#cursor) | `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (workspace) |
| [VS Code](#vs-code) | `.vscode/mcp.json` (`servers` schema) |
| [Antigravity](#antigravity) | `~/.gemini/config/mcp_config.json` |
| [Windsurf / Cline / Zed](#generic-mcp-clients) | Standard `mcpServers` stdio configuration |

---

## Claude Code CLI

Use the Claude Code CLI to register the server:

```bash
claude mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
claude mcp list
```

Alternatively, commit `.mcp.json` at the root of your project:

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

Register the server with the OpenAI Codex CLI:

```bash
codex mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
codex mcp list
```

Or add it directly to `~/.codex/config.toml`:

```toml
[mcp_servers.easyeda-pro]
command = "node"
args = ["/absolute/path/to/easyeda_mcp/dist/index.js"]
```

## Claude Desktop

Add `easyeda-pro` to `claude_desktop_config.json`, then **fully quit and reopen** Claude Desktop:

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

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), then click **Refresh** in **Cursor Settings -> MCP**:

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

Create `.vscode/mcp.json` in your workspace (or run **MCP: Add Server** from the Command Palette) and open **GitHub Copilot Chat** in **Agent** mode:

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

::: tip Workspace relative path
If your VS Code workspace is the `easyeda_mcp` repository itself, you can replace the absolute path with `"${workspaceFolder}/dist/index.js"`.
:::

## Antigravity

Add `easyeda-pro` to `~/.gemini/config/mcp_config.json`, then click **Refresh** in **Additional Options (`...`) -> MCP Servers**:

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

Any client that supports local `stdio` MCP servers (**Windsurf**, **Cline**, **Zed**, **Gemini CLI**, **JetBrains AI Assistant**, etc.) can launch `node /absolute/path/to/easyeda_mcp/dist/index.js`.

### Environment Variables

The WebSocket bridge binds to `127.0.0.1:8765` by default. Change these variables only if you also update `extension/src/bridgeConfig.ts` and rebuild the `.eext` package:

| Variable | Default | Description |
| --- | --- | --- |
| `EASYEDA_MCP_WS_HOST` | `127.0.0.1` | Local WebSocket bind address for the extension bridge |
| `EASYEDA_MCP_WS_PORT` | `8765` | Local WebSocket port for the extension bridge |

---

## Verify Connection

With your AI client running and the [EasyEDA Pro Extension](./easyeda-extension.md) connected to an open schematic or PCB:

```text
Run easyeda_doctor and summarize the bridge status.
Run easyeda_get_context and tell me which document is open.
```

If tools do not appear or `connected` is `false`, see [Troubleshooting](./troubleshooting.md).
