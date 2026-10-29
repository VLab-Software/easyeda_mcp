# AI Client Setup

All MCP clients launch the same local Node.js server over `stdio` via `@vlabsoft/easyeda-pro-mcp` — no repository clone or manual build required.

## Automatic Setup (All Clients)

Run one command in your terminal (requires **Node.js `>= 20`**):

```bash
npx -y @vlabsoft/easyeda-pro-mcp setup
```

`setup` safely merges `easyeda-pro` into every detected AI client on your machine (preserving your existing MCP servers) and exports `easyeda_mcp_bridge.eext` to `~/Downloads` (or your current folder).

Useful CLI options:

```bash
# Preview changes without modifying any files
npx -y @vlabsoft/easyeda-pro-mcp setup --dry-run

# Configure specific clients explicitly
npx -y @vlabsoft/easyeda-pro-mcp setup --client cursor,vscode,claude-desktop

# Copy only easyeda_mcp_bridge.eext to the current folder
npx -y @vlabsoft/easyeda-pro-mcp export-extension .
```

## Standard MCP Configuration & 1-Click Links

Most MCP clients use this standard JSON configuration:

::: code-group

```json [macOS / Linux]
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "npx",
      "args": ["-y", "@vlabsoft/easyeda-pro-mcp"]
    }
  }
}
```

```json [Windows]
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@vlabsoft/easyeda-pro-mcp"]
    }
  }
}
```

:::

| Client | 1-Click / CLI Shortcut | Configuration Location |
| --- | --- | --- |
| [Cursor](#cursor) | [Install in Cursor](https://cursor.com/install-mcp?name=easyeda-pro&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB2bGFic29mdC9lYXN5ZWRhLXByby1tY3AiXX0%3D) | `~/.cursor/mcp.json` or `.cursor/mcp.json` |
| [VS Code](#vs-code) | [Install in VS Code](https://vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522easyeda-pro%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522%2540vlabsoft%252Feasyeda-pro-mcp%2522%255D%257D) | User `Code/User/mcp.json` or `.vscode/mcp.json` (`servers` schema) |
| [Claude Desktop](#claude-desktop) | [Download `.mcpb` Bundle](https://github.com/VLab-Software/easyeda_mcp/releases/latest/download/easyeda-pro-mcp.mcpb) | `claude_desktop_config.json` |
| [Claude Code CLI](#claude-code-cli) | `claude mcp add` | `~/.claude.json` or project `.mcp.json` |
| [Codex CLI](#codex-cli) | `codex mcp add` | `~/.codex/config.toml` |
| [Antigravity](#antigravity) | `npx -y @vlabsoft/easyeda-pro-mcp setup -c antigravity` | `~/.gemini/config/mcp_config.json` |
| [Windsurf / Cline / Zed](#generic-mcp-clients) | `npx -y @vlabsoft/easyeda-pro-mcp setup -c windsurf` | Standard `mcpServers` stdio configuration |

::: info Paired EasyEDA Pro Extension
If you install via a 1-click link or manual JSON config, remember to also import [`easyeda_mcp_bridge.eext`](https://github.com/VLab-Software/easyeda_mcp/releases/latest/download/easyeda_mcp_bridge.eext) (or run `npx -y @vlabsoft/easyeda-pro-mcp export-extension .`) in EasyEDA Pro. See [EasyEDA Pro Extension](./easyeda-extension.md).
:::

---

## Claude Code CLI

Use the Claude Code CLI to register the server:

::: code-group

```bash [macOS / Linux]
claude mcp add --scope user easyeda-pro -- npx -y @vlabsoft/easyeda-pro-mcp
claude mcp list
```

```powershell [Windows]
claude mcp add --scope user easyeda-pro -- cmd /c npx -y @vlabsoft/easyeda-pro-mcp
claude mcp list
```

:::

Alternatively, commit `.mcp.json` at the root of your project:

```json
{
  "mcpServers": {
    "easyeda-pro": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@vlabsoft/easyeda-pro-mcp"]
    }
  }
}
```

## Codex CLI

Register the server with the OpenAI Codex CLI:

::: code-group

```bash [macOS / Linux]
codex mcp add easyeda-pro -- npx -y @vlabsoft/easyeda-pro-mcp
codex mcp list
```

```powershell [Windows]
codex mcp add easyeda-pro -- cmd /c npx -y @vlabsoft/easyeda-pro-mcp
codex mcp list
```

:::

Or add it directly to `~/.codex/config.toml`:

```toml
[mcp_servers.easyeda-pro]
command = "npx"
args = ["-y", "@vlabsoft/easyeda-pro-mcp"]
```

## Claude Desktop

### Option A: 1-Click `.mcpb` Bundle (No JSON Editing)

1. Download [`easyeda-pro-mcp.mcpb`](https://github.com/VLab-Software/easyeda_mcp/releases/latest/download/easyeda-pro-mcp.mcpb) from the latest GitHub Release.
2. Double-click `easyeda-pro-mcp.mcpb` (or drag it into **Claude Desktop -> Settings -> Extensions**) and confirm installation.

### Option B: `claude_desktop_config.json`

Add `easyeda-pro` to `claude_desktop_config.json`, then **fully quit and reopen** Claude Desktop:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

::: code-group

```json [macOS / Linux]
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "npx",
      "args": ["-y", "@vlabsoft/easyeda-pro-mcp"]
    }
  }
}
```

```json [Windows]
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@vlabsoft/easyeda-pro-mcp"]
    }
  }
}
```

:::

## Cursor

Click **[Install in Cursor](https://cursor.com/install-mcp?name=easyeda-pro&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB2bGFic29mdC9lYXN5ZWRhLXByby1tY3AiXX0%3D)**, or add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), then click **Refresh** in **Cursor Settings -> MCP**:

::: code-group

```json [macOS / Linux]
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "npx",
      "args": ["-y", "@vlabsoft/easyeda-pro-mcp"]
    }
  }
}
```

```json [Windows]
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@vlabsoft/easyeda-pro-mcp"]
    }
  }
}
```

:::

## VS Code

Click **[Install in VS Code](https://vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522easyeda-pro%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522%2540vlabsoft%252Feasyeda-pro-mcp%2522%255D%257D)**, or create `.vscode/mcp.json` in your workspace (or run **MCP: Open User Configuration** from the Command Palette) and open **GitHub Copilot Chat** in **Agent** mode:

::: code-group

```json [macOS / Linux]
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

```json [Windows]
{
  "servers": {
    "easyeda-pro": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@vlabsoft/easyeda-pro-mcp"]
    }
  }
}
```

:::

## Antigravity

Run `npx -y @vlabsoft/easyeda-pro-mcp setup --client antigravity`, or add `easyeda-pro` to `~/.gemini/config/mcp_config.json`, then click **Refresh** in **Additional Options (`...`) -> MCP Servers**:

::: code-group

```json [macOS / Linux]
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "npx",
      "args": ["-y", "@vlabsoft/easyeda-pro-mcp"]
    }
  }
}
```

```json [Windows]
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@vlabsoft/easyeda-pro-mcp"]
    }
  }
}
```

:::

## Generic MCP Clients

Any client that supports local `stdio` MCP servers (**Windsurf**, **Cline**, **Zed**, **Gemini CLI**, **JetBrains AI Assistant**, etc.) can launch `npx -y @vlabsoft/easyeda-pro-mcp` (or `cmd /c npx -y @vlabsoft/easyeda-pro-mcp` on Windows).

- **Windsurf**: `~/.codeium/windsurf/mcp_config.json` (supported natively by `npx -y @vlabsoft/easyeda-pro-mcp setup --client windsurf`).
- **Local repository build (contributors)**: Run `npm install && npm run setup:local && npm run setup:clients` from a cloned checkout to configure clients with `node /absolute/path/to/easyeda_mcp/dist/index.js`.

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
