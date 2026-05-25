# Getting Started

Goal: get one MCP client talking to the EasyEDA Pro project you have open.

If you want the shortest beginner-friendly path, use [Quick Start](./quick-start.md) first.

This is the happy path. If a step fails, jump to [Troubleshooting](./troubleshooting.md).

## Prerequisites

You need:

- Node.js `20` or newer
- `npm`
- EasyEDA Pro installed
- permission to load a local EasyEDA Pro extension
- an MCP client such as Codex, Claude Desktop, Claude Code, or VS Code

## 1. Install Dependencies

Run from the repository root:

```bash
npm install
```

## 2. Build Everything

Run:

```bash
npm run setup:local
```

This builds:

- the MCP server at `dist/index.js`
- the EasyEDA Pro extension bundle at `extension/dist/index.js`
- the packaged `.eext` extension artifact

## 3. Connect Your MCP Client

Point your MCP client to:

```bash
node /absolute/path/to/easyeda_mcp/dist/index.js
```

Use [AI Client Setup](./ai-client-setup.md) for Codex, Claude, Claude Code, and VS Code examples.

## 4. Install the EasyEDA Pro Extension

In EasyEDA Pro:

1. import or load the packaged extension
2. enable external interaction permission
3. open a schematic or PCB project
4. use `MCP Bridge -> Reconnect` if it does not auto-connect

Use [EasyEDA Pro Extension Setup](./easyeda-extension.md) if you need the full extension flow.

## 5. Verify the Connection

In your MCP client, run:

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

## 6. Try a Real Read

With a schematic open, run:

```text
Run easyeda_schematic_snapshot and summarize the component and net counts.
```

If that works, the setup is ready.

## Daily Startup

After the first setup, the usual flow is:

1. open your MCP client
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

## Defaults

The MCP server uses `stdio` for the MCP client and opens a local WebSocket bridge at:

```text
ws://127.0.0.1:8765
```

Optional overrides:

- `EASYEDA_MCP_WS_HOST`
- `EASYEDA_MCP_WS_PORT`
