<p align="center">
  <img src="./docs/public/landing.svg" alt="EasyEDA Pro MCP" width="140" />
</p>

<h1 align="center">EasyEDA Pro MCP</h1>

<p align="center">
  Connect Claude, Codex, VS Code, and other Model Context Protocol (MCP) clients to the live EasyEDA Pro project already open on your machine.
</p>

<p align="center">
  Independent open-source MCP bridge for live schematic and PCB workflows in EasyEDA Pro.
</p>

<p align="center">
  <img src="./docs/public/demo.gif" alt="Demo showing EasyEDA Pro with the MCP Bridge workflow in action" width="760" />
</p>

<p align="center">
  <a href="https://github.com/VLab-Software/easyeda_mcp/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/VLab-Software/easyeda_mcp/ci.yml?branch=master&label=CI"></a>
  <a href="https://github.com/VLab-Software/easyeda_mcp/releases"><img alt="Release" src="https://img.shields.io/github/v/release/VLab-Software/easyeda_mcp?include_prereleases&label=release"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D20-339933">
  <img alt="Platforms" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey">
</p>

<p align="center">
  <a href="https://vlabsoft.org/easyeda_mcp/quick-start">Quick Start</a>
  ·
  <a href="https://vlabsoft.org/easyeda_mcp/ai-client-setup">AI Client Setup</a>
  ·
  <a href="https://vlabsoft.org/easyeda_mcp/tools">Tools</a>
  ·
  <a href="https://vlabsoft.org/easyeda_mcp/troubleshooting">Troubleshooting</a>
  ·
  <a href="https://github.com/VLab-Software/easyeda_mcp/releases">Releases</a>
</p>

## What It Does

EasyEDA Pro MCP lets an AI assistant inspect the live EasyEDA Pro schematic or PCB you already have open. It gives MCP clients structured project context instead of making them guess from screenshots, copied text, or manual exports.

It runs locally:

```text
MCP client -> Node.js MCP server -> local WebSocket bridge -> EasyEDA Pro extension
```

Works with Claude Desktop, Claude Code, Codex, VS Code, and other MCP-compatible clients.

## Quick Start

```bash
npm install
npm run setup:local
```

Then:

1. configure your MCP client to run `node /absolute/path/to/easyeda_mcp/dist/index.js`
2. open EasyEDA Pro
3. load the packaged extension from `build/dist`
4. enable external interaction permission
5. open a schematic or PCB
6. ask your MCP client to run `easyeda_doctor`

Healthy output should show the extension connected, protocol compatible, and an active document available.

Full setup guide: [Quick Start](https://vlabsoft.org/easyeda_mcp/quick-start)

## What You Can Ask

```text
Run easyeda_doctor and summarize whether the EasyEDA Pro bridge is healthy.
Run easyeda_get_context and tell me which document is open in EasyEDA Pro.
Run easyeda_schematic_snapshot and summarize components, nets, warnings, and confidence.
Run easyeda_trace_component for USB1 and summarize its connected nets.
```

Core capabilities:

- live project and document context
- schematic inspection for components, pins, nets, wires, and labels
- component and net tracing
- targeted connection assertions
- editor navigation and export helpers
- confirmation-gated editor-changing actions

## Documentation

- [Quick Start](https://vlabsoft.org/easyeda_mcp/quick-start): shortest path to a working setup
- [Getting Started](https://vlabsoft.org/easyeda_mcp/getting-started): first-time setup with more context
- [AI Client Setup](https://vlabsoft.org/easyeda_mcp/ai-client-setup): Claude Desktop, Codex CLI, Claude Code CLI, VS Code, and generic MCP clients
- [EasyEDA Pro Extension Setup](https://vlabsoft.org/easyeda_mcp/easyeda-extension): install and reconnect the editor extension
- [Tools Reference](https://vlabsoft.org/easyeda_mcp/tools): available MCP tools
- [Troubleshooting](https://vlabsoft.org/easyeda_mcp/troubleshooting): fixes by symptom

## Releases

Download packaged extension builds from [GitHub Releases](https://github.com/VLab-Software/easyeda_mcp/releases). Local builds also create `build/dist/easyeda_mcp_bridge.eext`.

## Development

```bash
npm run setup:local
npm test
npm run typecheck
npm run docs:build
```

`npm run setup:local` builds the MCP server, builds the EasyEDA Pro extension bundle, and packages the `.eext` artifact.

## Scope, Safety, and Status

This project works against a live EasyEDA Pro session. EasyEDA Pro must be open, the local extension must be installed, and the MCP server must be running.

Not included yet:

- offline `.epro` parsing
- commercial/order operations
- unrestricted editor automation

The bridge listens on `127.0.0.1` by default. Do not expose the bridge port to untrusted networks. See [SECURITY.md](./SECURITY.md) for reporting and runtime boundaries.

This is an independent open-source project. It is not affiliated with, endorsed by, or sponsored by EasyEDA, JLCPCB, or Shenzhen Jia Chuang Ban Technology Co., Ltd.

## Contact and License

Feedback and suggestions: [victor.freitas@vlabsoft.com](mailto:victor.freitas@vlabsoft.com)

MIT. See [LICENSE](./LICENSE).
