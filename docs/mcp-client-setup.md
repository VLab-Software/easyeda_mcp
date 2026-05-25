# MCP Client Setup

This guide shows how to point an MCP client to the EasyEDA Pro MCP Bridge.

## Build First

Build the server before configuring the client:

```bash
npm run build
```

The compiled server entrypoint will be:

```text
dist/index.js
```

## Example Configuration

Use the compiled server in your MCP client configuration.

Example:

```json
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "node",
      "args": ["C:\\Users\\vlabsoft\\Documents\\easyeda_mcp\\dist\\index.js"]
    }
  }
}
```

Adjust the path to match your local environment.

## Runtime Behavior

When the client starts the server:

- the MCP transport runs over `stdio`
- the server also starts a local WebSocket bridge for the EasyEDA Pro extension

## Optional Environment Variables

You can customize the WebSocket bridge endpoint with:

- `EASYEDA_MCP_WS_HOST`
- `EASYEDA_MCP_WS_PORT`

If not set, the defaults are:

- host: `127.0.0.1`
- port: `8765`

## Recommended Startup Order

For the smoothest setup:

1. Build the project
2. Start the MCP client so it launches the server
3. Open EasyEDA Pro
4. Load the extension
5. Connect the extension to the bridge
6. Run `easyeda_live_status`

## Important Note About New Tools

If you add new tools to the server, an already-running MCP client session may not expose them immediately.

In that case:

1. rebuild the project
2. restart the MCP client session
3. reconnect the EasyEDA Pro extension if needed

This is especially important after changes in `src/mcp/registerTools.ts`.
