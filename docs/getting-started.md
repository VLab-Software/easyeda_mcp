# Getting Started

Goal: get one AI tool talking to the EasyEDA Pro project you already have open.

If you want the absolute shortest version, use [Quick Start](./quick-start.md). This page adds a little more guidance without going deep into every edge case.

If a step fails, jump to [Troubleshooting](./troubleshooting.md).

## What You Need

- Node.js `20` or newer
- `npm`
- EasyEDA Pro installed
- permission to load a local EasyEDA Pro extension
- one AI tool:
  - Claude Desktop
  - Codex CLI
  - Claude Code CLI
  - VS Code
  - another MCP client

## 1. Build the Local Pieces

From the repository root, run:

```bash
npm install
npm run setup:local
```

This builds:

- the MCP server at `dist/index.js`
- the browser extension bundle at `extension/dist/index.js`
- the packaged EasyEDA Pro extension in `build/dist`

## 2. Choose One AI Tool

All clients run the same server:

```bash
node /absolute/path/to/easyeda_mcp/dist/index.js
```

Choose one of these setup paths:

### Claude Desktop

Best if you want a desktop chat app on Windows or macOS.

Add the server to `claude_desktop_config.json`, then fully restart Claude Desktop.

Use the exact config examples in [AI Client Setup](./ai-client-setup.md#claude-desktop).

### Codex CLI

Best if you want a terminal workflow.

Run:

```bash
codex mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
codex mcp list
```

### Claude Code CLI

Best if you already use Claude in the terminal.

Run:

```bash
claude mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
claude mcp list
```

### VS Code

Best if you want MCP tools inside Copilot Chat Agent mode.

Create `.vscode/mcp.json` in the repository and point it at `dist/index.js`.

Use the exact example in [AI Client Setup](./ai-client-setup.md#vs-code).

### Other MCP Clients and CLIs

If your tool accepts a local `stdio` MCP server command, use:

```bash
node /absolute/path/to/easyeda_mcp/dist/index.js
```

Use [MCP Client Setup](./mcp-client-setup.md) if your client is not listed here.

## 3. Install the EasyEDA Pro Extension

In EasyEDA Pro:

1. import the packaged extension from `build/dist`
2. enable external interaction permission
3. open a schematic or PCB project
4. use `MCP Bridge -> Reconnect` if it does not auto-connect

Use [EasyEDA Pro Extension Setup](./easyeda-extension.md) if you need the full extension flow.

## 4. Verify the Bridge

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

## 5. Try a Real Read

With a schematic open, run:

```text
Run easyeda_schematic_snapshot and summarize the component and net counts.
```

If that works, your first setup is done.

## Daily Startup

After the first setup, the usual flow is:

1. open your AI tool
2. open EasyEDA Pro
3. open the target project
4. let the extension connect
5. run `easyeda_doctor`

## Useful Commands

```bash
npm run setup:local
npm test
npm run typecheck
```

## Default Local Bridge

The MCP server uses `stdio` for the AI client and opens a local WebSocket bridge at:

```text
ws://127.0.0.1:8765
```

Optional overrides:

- `EASYEDA_MCP_WS_HOST`
- `EASYEDA_MCP_WS_PORT`
