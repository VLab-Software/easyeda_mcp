# EasyEDA Pro MCP Bridge

Live MCP integration for EasyEDA Pro through an EasyEDA extension.

The MCP server runs locally over `stdio` for MCP clients and also starts a WebSocket bridge at `ws://127.0.0.1:8765`. The EasyEDA Pro extension connects to that local bridge and executes read, navigation, export, and explicitly confirmed actions inside the active editor session.

## Features

- Live status and editor context from the active EasyEDA Pro instance.
- Component and net lookup using EasyEDA Pro extension APIs.
- Generic schematic analysis: components, pins, nets, wires, labels, unconnected pins, and validation findings.
- Navigation helpers for components, coordinates, regions, and board outline zoom.
- BOM, netlist, Gerber, and PDF export via EasyEDA Pro manufacture APIs.
- Mutating actions routed through `easyeda_confirmed_action` and blocked unless the confirmation text is explicit.
- No offline `.epro` parsing in this version.

## Build and Test

```powershell
npm install
npm run build
npm run build:extension
npm test
```

## MCP Client Configuration

Build first, then point your MCP client at the compiled server:

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

Optional environment variables:

- `EASYEDA_MCP_WS_HOST`: defaults to `127.0.0.1`.
- `EASYEDA_MCP_WS_PORT`: defaults to `8765`.

## EasyEDA Pro Extension Setup

1. Run `npm run build:extension`.
2. Load the `extension` folder as a local EasyEDA Pro extension.
3. Enable external interaction permission for the extension; EasyEDA Pro requires this for `SYS_WebSocket`.
4. Keep the MCP server running.
5. Use the EasyEDA Pro menu `MCP Bridge -> Connect to MCP` if it does not connect automatically.
6. Call `easyeda_live_status` from your MCP client and check that `connected` is `true`.

The extension entry is `extension/dist/index.js`, and the manifest is `extension/extension.json`.

## Tools

- `easyeda_live_status`
- `easyeda_get_context`
- `easyeda_find_component`
- `easyeda_find_net`
- `easyeda_schematic_snapshot`
- `easyeda_list_schematic_components`
- `easyeda_get_component_pins`
- `easyeda_trace_net`
- `easyeda_trace_component`
- `easyeda_find_unconnected_pins`
- `easyeda_validate_schematic_area`
- `easyeda_navigate_component`
- `easyeda_navigate_region`
- `easyeda_zoom_board`
- `easyeda_export_bom`
- `easyeda_export_netlist`
- `easyeda_export_gerber`
- `easyeda_export_pdf`
- `easyeda_confirmed_action`

## Safety

Inspection, navigation, and export tools run directly. Project-changing operations are limited to `easyeda_confirmed_action`, and the confirmation field must contain an explicit phrase such as `confirma salvar` or `I confirm`.

Commercial/order operations are intentionally not implemented.
