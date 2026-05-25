# Getting Started

This guide helps you get the EasyEDA Pro MCP Bridge running locally for the first time.

## Overview

The project has two main parts:

- A local MCP server written in TypeScript/Node.js
- An EasyEDA Pro extension that connects back to the server through WebSocket

The MCP server exposes tools to an MCP client. The EasyEDA Pro extension provides the live editor access needed to fulfill those tool calls.

## Prerequisites

Before you begin, make sure you have:

- Node.js `20` or newer
- `npm`
- EasyEDA Pro installed
- Permission to load a local EasyEDA Pro extension

## Install Dependencies

From the repository root:

```bash
npm install
```

## Build the Project

Build the MCP server:

```bash
npm run build
```

Build the EasyEDA Pro extension bundle:

```bash
npm run build:extension
```

If you want to produce the packaged extension artifact:

```bash
npm run package:extension
```

## Run Tests

Run the test suite with:

```bash
npm test
```

Optional type-checking:

```bash
npm run typecheck
```

## Start the MCP Server

After building, start the server from the repository root:

```bash
node dist/index.js
```

The server:

- listens for MCP traffic on `stdio`
- starts a local WebSocket bridge at `ws://127.0.0.1:8765`

You can override the bridge endpoint with environment variables:

- `EASYEDA_MCP_WS_HOST`
- `EASYEDA_MCP_WS_PORT`

## Connect EasyEDA Pro

Once the server is running:

1. Build or package the extension
2. Install/load the local extension in EasyEDA Pro
3. Enable the extension's external interaction permission
4. Open a project in EasyEDA Pro
5. Trigger `MCP Bridge -> Connect to MCP` if it does not connect automatically
6. Call `easyeda_live_status` from your MCP client to confirm the connection

## First Validation

After setup, a good first validation flow is:

1. `easyeda_live_status`
2. `easyeda_get_context`
3. `easyeda_schematic_snapshot`

If those work, the bridge is usually in a healthy state.

## Next Steps

- [MCP Client Setup](./mcp-client-setup.md)
- [EasyEDA Pro Extension Setup](./easyeda-extension.md)
- [Tools Reference](./tools.md)
