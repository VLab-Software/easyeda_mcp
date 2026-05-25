# Quick Start

Use this page if you want the fastest path to a working setup.

You do not need to understand MCP internals first. Follow the steps, then verify with `easyeda_doctor`.

## What You Will Do

1. Build the local MCP server and EasyEDA Pro extension
2. Connect an AI client
3. Load the EasyEDA Pro extension
4. Run one health check

## Before You Start

You need:

- Node.js `20` or newer
- `npm`
- EasyEDA Pro
- Claude Desktop on Windows or macOS
- Claude Code on Linux

Open a terminal in the project folder before running commands.

## 1. Build the Project

Run:

```bash
npm install
npm run setup:local
```

This creates the MCP server here:

```text
dist/index.js
```

It also builds and packages the EasyEDA Pro extension.

## 2. Copy Your Project Path

You need the absolute path to this repository.

On macOS or Linux:

```bash
pwd
```

On Windows PowerShell:

```powershell
(Get-Location).Path
```

You will use that path in the next step.

Example macOS/Linux server path:

```text
/Users/you/Documents/easyeda_mcp/dist/index.js
```

Example Windows server path:

```text
C:\Users\you\Documents\easyeda_mcp\dist\index.js
```

## 3. Connect Your AI Client

Choose the section for your operating system.

### Windows: Claude Desktop

Open this file:

```text
%APPDATA%\Claude\claude_desktop_config.json
```

If it does not exist, create it.

Paste this JSON and replace the path with your real path:

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

Save the file, then fully quit and reopen Claude Desktop.

### macOS: Claude Desktop

Open this file:

```text
~/Library/Application Support/Claude/claude_desktop_config.json
```

If it does not exist, create it.

Paste this JSON and replace the path with your real path:

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

Save the file, then fully quit and reopen Claude Desktop.

### Linux: Claude Code

Claude Desktop is not the recommended path for Linux here. Use Claude Code.

Run this command and replace the path with your real path:

```bash
claude mcp add easyeda-pro -- node /home/you/Documents/easyeda_mcp/dist/index.js
```

Check that it was added:

```bash
claude mcp list
```

## 4. Load the EasyEDA Pro Extension

Open EasyEDA Pro.

Then:

1. import or load the packaged extension from `build/dist`
2. enable external interaction permission
3. open a schematic or PCB project
4. use `MCP Bridge -> Reconnect` if it does not connect automatically

The packaged extension has a name like:

```text
easyeda-mcp-bridge_v0.1.0.eext
```

A compatibility copy is also created:

```text
easyeda_mcp_bridge.eext
```

## 5. Verify It Works

In your AI client, ask:

```text
Run easyeda_doctor and summarize whether the EasyEDA Pro bridge is healthy.
```

Healthy output should show:

- extension connected
- protocol compatible
- active document available

Then ask:

```text
Run easyeda_get_context and tell me which EasyEDA Pro document is open.
```

With a schematic open, try:

```text
Run easyeda_schematic_snapshot and summarize the component and net counts.
```

If all three work, your setup is ready.

## If Something Fails

Use the symptom-based guide:

- [Troubleshooting](./troubleshooting.md)

For more detail:

- [Getting Started](./getting-started.md)
- [AI Client Setup](./ai-client-setup.md)
- [EasyEDA Pro Extension Setup](./easyeda-extension.md)
