# EasyEDA Pro MCP

Connect EasyEDA Pro to MCP clients such as Codex, Claude, Claude Code, and VS Code.

The bridge runs locally. Your MCP client starts a Node.js server, the EasyEDA Pro extension connects back over WebSocket, and AI tools can inspect the project that is open in the editor.

## Quick Start

```bash
npm install
npm run setup:local
```

Then:

1. configure your MCP client to run `node /absolute/path/to/easyeda_mcp/dist/index.js`
2. open EasyEDA Pro
3. load the EasyEDA Pro extension
4. enable external interaction permission
5. open a schematic or PCB
6. ask your MCP client to run `easyeda_doctor`

Healthy output should show the extension connected, protocol compatible, and an active document available.

## Documentation

Start here:

- [Quick Start](./docs/quick-start.md)
- [Getting Started](./docs/getting-started.md)
- [AI Client Setup](./docs/ai-client-setup.md)
- [EasyEDA Pro Extension Setup](./docs/easyeda-extension.md)
- [Troubleshooting](./docs/troubleshooting.md)

Reference:

- [Tools Reference](./docs/tools.md)
- [MCP Client Setup](./docs/mcp-client-setup.md)
- [Safety Model](./docs/safety.md)
- [Architecture](./docs/architecture.md)

## What It Can Do

- read live EasyEDA Pro editor status and context
- inspect components, pins, nets, wires, and labels
- trace schematic nets and components
- verify targeted connection assertions
- navigate to components or regions
- export BOM, netlist, Gerber, and PDF files
- run selected mutating actions only after explicit confirmation

## Local Runtime

```text
MCP client -> Node.js MCP server -> local WebSocket bridge -> EasyEDA Pro extension
```

Defaults:

- MCP transport: `stdio`
- WebSocket bridge: `ws://127.0.0.1:8765`

Optional environment variables:

- `EASYEDA_MCP_WS_HOST`
- `EASYEDA_MCP_WS_PORT`

## Build and Test

```bash
npm run setup:local
npm test
npm run typecheck
```

`npm run setup:local` builds the MCP server, builds the extension bundle, and packages the `.eext` artifact.

## GitHub Release Assets

Public beta releases attach:

- `easyeda-mcp-bridge_v0.1.0.eext`: versioned EasyEDA Pro extension package
- `easyeda_mcp_bridge.eext`: stable filename for the same extension package
- `SHA256SUMS.txt`: checksums for release verification

## First Useful Prompts

```text
Run easyeda_doctor and summarize whether the EasyEDA Pro bridge is healthy.
```

```text
Run easyeda_get_context and tell me which document is open in EasyEDA Pro.
```

```text
Run easyeda_schematic_snapshot and summarize components, nets, warnings, and confidence.
```

## Scope

This version is live-session based. It does not parse offline `.epro` files.

Commercial/order operations are not implemented.
