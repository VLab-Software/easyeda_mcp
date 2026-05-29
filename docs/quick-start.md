# Quick Start

Use this page if you want the shortest path to a working setup.

Pick one AI tool, get it working, then add other clients later if you want.

## What You Will Do

1. build the local MCP server and EasyEDA Pro extension
2. connect one AI tool
3. load the EasyEDA Pro extension
4. run `easyeda_doctor`

## Before You Start

You need:

- Node.js `20` or newer
- `npm`
- EasyEDA Pro
- one MCP-capable AI tool:
  - Claude Desktop on Windows or macOS
  - Codex CLI
  - Claude Code CLI
  - VS Code
  - another local MCP client

Open a terminal in the repository root before running commands.

## 1. Build Once

Run:

```bash
npm install
npm run setup:local
```

This creates:

- the MCP server at `dist/index.js`
- the packaged EasyEDA Pro extension in `build/dist`

You should see extension files like:

```text
build/dist/easyeda-mcp-bridge_v0.1.0.eext
build/dist/easyeda_mcp_bridge.eext
```

## 2. Copy Your Absolute Path

Every AI tool needs the absolute path to this repository.

On macOS or Linux:

```bash
pwd
```

On Windows PowerShell:

```powershell
(Get-Location).Path
```

Use that path to point the client at:

```text
/absolute/path/to/easyeda_mcp/dist/index.js
```

Windows example:

```text
C:\Users\you\Documents\easyeda_mcp\dist\index.js
```

## 3. Connect One AI Tool

Start with one client only.

### Claude Desktop (Windows and macOS)

Windows config file:

```text
%APPDATA%\Claude\claude_desktop_config.json
```

macOS config file:

```text
~/Library/Application Support/Claude/claude_desktop_config.json
```

If the file does not exist, create it. Then add:

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

On Windows, use the same JSON with a Windows path such as:

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

Run:

```bash
codex mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
codex mcp list
```

### Claude Code CLI

Run:

```bash
claude mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
claude mcp list
```

### VS Code

Create `.vscode/mcp.json` in the repository:

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

Then open Copilot Chat in Agent mode and trust the server when prompted.

### Other MCP Clients and CLIs

If your tool supports a local `stdio` MCP server, point it to:

```bash
node /absolute/path/to/easyeda_mcp/dist/index.js
```

If you need a generic setup guide, see [MCP Client Setup](./mcp-client-setup.md).

## 4. Load the EasyEDA Pro Extension

Open EasyEDA Pro, then:

1. import the packaged extension from `build/dist`
2. enable external interaction permission
3. open a schematic or PCB project
4. use `MCP Bridge -> Reconnect` if the bridge does not connect automatically

## 5. Verify It Works

In your AI tool, run:

```text
Run easyeda_doctor and summarize whether the EasyEDA Pro bridge is healthy.
```

Healthy output should show:

- extension connected
- protocol compatible
- active document available

Then run:

```text
Run easyeda_get_context and tell me which EasyEDA Pro document is open.
```

With a schematic open, run:

```text
Run easyeda_schematic_snapshot and summarize the component and net counts.
```

If those three calls work, your setup is ready.

## Need More Detail?

- [Getting Started](./getting-started.md)
- [AI Client Setup](./ai-client-setup.md)
- [EasyEDA Pro Extension Setup](./easyeda-extension.md)
- [Troubleshooting](./troubleshooting.md)
