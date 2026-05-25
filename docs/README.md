# EasyEDA Pro MCP Docs

Use these docs to connect EasyEDA Pro to an MCP client and let an AI assistant inspect the project you already have open.

The shortest path is:

1. Build the project
2. Connect an MCP client
3. Install the EasyEDA Pro extension
4. Run `easyeda_doctor`

## Start Here

- [Quick Start](./quick-start.md): fastest setup for Windows, macOS, and Linux
- [Getting Started](./getting-started.md): first successful local setup
- [AI Client Setup](./ai-client-setup.md): Codex, Claude, Claude Code, and VS Code examples
- [EasyEDA Pro Extension Setup](./easyeda-extension.md): install and connect the editor extension
- [Troubleshooting](./troubleshooting.md): fixes by symptom

## Reference

- [Tools Reference](./tools.md): what each MCP tool does
- [MCP Client Setup](./mcp-client-setup.md): generic MCP configuration
- [Safety Model](./safety.md): read-only defaults and confirmed actions
- [Architecture](./architecture.md): how server, bridge, and extension fit together
- [Changelog](./changelog.md): user-facing changes
- [Versioning](./versioning.md): release and compatibility rules

## What This Project Does

EasyEDA Pro MCP Bridge runs locally and connects:

```text
MCP client -> Node.js MCP server -> local WebSocket bridge -> EasyEDA Pro extension
```

Once connected, an AI client can:

- read live editor status and document context
- inspect components, pins, nets, wires, and labels
- trace schematic nets and components
- verify targeted connection assertions
- navigate to components or regions
- export BOM, netlist, Gerber, and PDF files
- run a small set of editor-changing actions only after explicit confirmation

## Current Scope

This project works against a live EasyEDA Pro session.

Required:

- EasyEDA Pro is open
- the local extension is installed and connected
- the MCP server is running
- your MCP client is configured to launch `dist/index.js`

Not included in this version:

- offline `.epro` parsing
- commercial/order operations
- unrestricted editor automation
