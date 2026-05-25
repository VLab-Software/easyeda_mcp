# EasyEDA MCP Bridge Extension

This extension connects EasyEDA Pro to the local MCP server at `ws://127.0.0.1:8765`.

## Build

From the repository root:

```powershell
npm run build:extension
```

The compiled entry point is `extension/dist/index.js`, referenced by `extension/extension.json`.

## Install in EasyEDA Pro

1. Start the MCP server from the repository root:

   ```powershell
   npm run build
   node dist/index.js
   ```

2. Build the extension:

   ```powershell
   npm run build:extension
   ```

3. In EasyEDA Pro, install/load the `extension` folder as a local extension.
4. Enable the extension's external interaction permission. The EasyEDA Pro WebSocket APIs require it.
5. Use `MCP Bridge -> Connect to MCP` if it does not connect automatically.
6. Call the MCP tool `easyeda_live_status`; it should report the extension as connected.

## Notes

- This v1 is live-extension only; it does not parse `.epro` archives.
- Inspection, navigation, and export tools run directly.
- Mutating actions are routed through `easyeda_confirmed_action` and require explicit confirmation in the MCP tool arguments.
