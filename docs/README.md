# EasyEDA Pro MCP Bridge Documentation

This folder contains the project documentation for the EasyEDA Pro MCP Bridge.

The project connects a local MCP server to a running EasyEDA Pro session through an EasyEDA Pro extension. It is designed for live inspection, navigation, export workflows, and explicitly confirmed editor actions.

If you are reading this inside the repository, this file is the folder index. The VitePress site homepage lives at [`index.md`](./index.md).

## Documentation Map

- [Getting Started](./getting-started.md)
- [Architecture](./architecture.md)
- [MCP Client Setup](./mcp-client-setup.md)
- [EasyEDA Pro Extension Setup](./easyeda-extension.md)
- [Tools Reference](./tools.md)
- [Safety Model](./safety.md)
- [Troubleshooting](./troubleshooting.md)
- [Changelog](./changelog.md)
- [Versioning](./versioning.md)

## What This Project Does

- Runs a local MCP server over `stdio`
- Opens a local WebSocket bridge for the EasyEDA Pro extension
- Reads live context from the active EasyEDA Pro session
- Inspects schematic connectivity and normalized schematic data
- Navigates to components or regions in the editor
- Exports project artifacts such as BOM, netlist, Gerber, and PDF
- Allows a small set of mutating actions only with explicit confirmation

## Current Scope

This project is currently extension-driven and live-session based.

That means:

- EasyEDA Pro must be open
- The local extension must be installed and connected
- The MCP server must be running

This version does not parse offline `.epro` files.

## Recommended Reading Order

1. Start with [Getting Started](./getting-started.md)
2. Configure your MCP client in [MCP Client Setup](./mcp-client-setup.md)
3. Install and connect the extension using [EasyEDA Pro Extension Setup](./easyeda-extension.md)
4. Explore the available capabilities in [Tools Reference](./tools.md)
5. Review operational boundaries in [Safety Model](./safety.md)
6. Track project evolution in [Changelog](./changelog.md)
7. Review release expectations in [Versioning](./versioning.md)

## Future Site Readiness

This documentation is organized so it can later be published as a docs site with minimal restructuring.
