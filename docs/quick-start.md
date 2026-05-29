# Quick Start

Use this page to get one AI tool connected to the EasyEDA Pro project you already have open.

The setup has two local pieces:

- your AI tool starts the MCP server with `node dist/index.js`
- the EasyEDA Pro extension connects the open editor to that server

Start with one AI tool. After that works, adding another client is just another MCP config.

## 1. Build

From the repository root:

```bash
npm install
npm run setup:local
```

This creates:

- `dist/index.js`, the MCP server every AI tool runs
- `build/dist/easyeda_mcp_bridge.eext`, the EasyEDA Pro extension package

## 2. Get Your Server Path

Every client needs the absolute path to `dist/index.js`.

On macOS or Linux:

```bash
pwd
```

On Windows PowerShell:

```powershell
(Get-Location).Path
```

Examples:

```text
/Users/you/Documents/easyeda_mcp/dist/index.js
C:\Users\you\Documents\easyeda_mcp\dist\index.js
```

## 3. Pick Your AI Tool

| Tool | Best for | Setup |
| --- | --- | --- |
| Claude Desktop | Desktop chat on Windows or macOS | Edit `claude_desktop_config.json` |
| Codex CLI | Terminal workflow with Codex | Run `codex mcp add ...` |
| Claude Code CLI | Terminal workflow with Claude | Run `claude mcp add ...` |
| VS Code | Copilot Chat Agent mode | Create `.vscode/mcp.json` |
| Other MCP client | Any local `stdio` MCP client | Run `node /path/to/dist/index.js` |

Use the section for the tool you picked.

### Claude Desktop

Config file on Windows:

```text
%APPDATA%\Claude\claude_desktop_config.json
```

Config file on macOS:

```text
~/Library/Application Support/Claude/claude_desktop_config.json
```

Add this JSON and replace the path.

macOS example:

```json
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "node",
      "args": ["/Users/you/Documents/easyeda_mcp/dist/index.js"]
    }
  }
}
```

Windows example:

```json
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "node",
      "args": ["C:\\Users\\you\\Documents\\easyeda_mcp\\dist\\index.js"]
    }
  }
}
```

Fully quit and reopen Claude Desktop.

### Codex CLI

```bash
codex mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
codex mcp list
```

### Claude Code CLI

```bash
claude mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
claude mcp list
```

### VS Code

Create `.vscode/mcp.json` in this repository:

```json
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

Open Copilot Chat in Agent mode and trust the server when prompted.

### Other MCP Clients and CLIs

Point the client to this local `stdio` command:

```bash
node /absolute/path/to/easyeda_mcp/dist/index.js
```

If the client wants JSON, many MCP clients use this shape:

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

For more generic client details, see [MCP Client Setup](./mcp-client-setup.md).

## 4. Load the EasyEDA Pro Extension

Open EasyEDA Pro, then:

1. import the packaged extension from `build/dist`
2. enable external interaction permission
3. open a schematic or PCB project
4. use `MCP Bridge -> Reconnect` if the bridge does not connect automatically

## 5. Verify

Run these prompts in your AI tool:

```text
Run easyeda_doctor and summarize whether the EasyEDA Pro bridge is healthy.
Run easyeda_get_context and tell me which EasyEDA Pro document is open.
Run easyeda_schematic_snapshot and summarize the component and net counts.
```

You are ready when `easyeda_doctor` reports:

- extension connected
- protocol compatible
- active document available

## Need More Detail?

- [Getting Started](./getting-started.md)
- [AI Client Setup](./ai-client-setup.md)
- [EasyEDA Pro Extension Setup](./easyeda-extension.md)
- [Troubleshooting](./troubleshooting.md)
