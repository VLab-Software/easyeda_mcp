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

<p align="center">
  <img src="./docs/public/demo.gif" alt="Demo showing EasyEDA Pro with the MCP Bridge workflow in action" width="760" />
</p>

## Key Features

- **Live schematic & PCB introspection** — Give AI agents structured access to your open EasyEDA Pro project without screenshots or manual exports.
- **Circuit tracing & verification** — Trace nets and component pins, find unconnected pins, and run programmatic assertions (pull-ups/downs, decoupling capacitors, USB-C `5.1k` CC paths).
- **Native PCB DRC rule management** — Read active design rules, saved profiles, and net/region tables, preview changes safely, and apply confirmed rule updates with readback verification.
- **Editor navigation & fabrication exports** — Focus components or regions directly in EasyEDA Pro and export BOM, Netlist, Gerber, and PDF files.
- **Local & read-first by default** — Runs locally over `stdio` and `ws://127.0.0.1:8765`. Inspection is read-only; mutating actions require explicit human confirmation.

## Requirements

- **Node.js** `20` or newer
- **EasyEDA Pro** `2.3.0` or newer
- An MCP-compatible AI client (**Claude Code**, **Codex**, **Claude Desktop**, **Cursor**, **VS Code**, **Antigravity**, **Windsurf**, etc.)

---

## Getting Started

EasyEDA Pro MCP has two local parts: the **EasyEDA Pro Extension** (`.eext`) inside the editor and the **MCP Server** (`dist/index.js`) launched by your AI client.

### 1. Clone & Build

```bash
git clone https://github.com/VLab-Software/easyeda_mcp.git
cd easyeda_mcp
npm install
npm run setup:local
```

This builds `dist/index.js` (MCP server) and `build/dist/easyeda_mcp_bridge.eext` (EasyEDA Pro extension).

### 2. Install the EasyEDA Pro Extension

1. In EasyEDA Pro, open **Extensions Manager** and import `build/dist/easyeda_mcp_bridge.eext` *(or download [`easyeda_mcp_bridge.eext`](https://github.com/VLab-Software/easyeda_mcp/releases/latest/download/easyeda_mcp_bridge.eext) from Releases)*.
2. Enable **Allow interactive with external** for **EasyEDA MCP Bridge**.
3. Open your schematic or PCB project *(if needed, click **MCP Bridge -> Reconnect** in the top toolbar)*.

### 3. Add the MCP Server to Your AI Client

**Standard config** (works in most MCP clients — replace `/absolute/path/to/easyeda_mcp` with your cloned directory):

```json
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "node",
      "args": ["/absolute/path/to/easyeda_mcp/dist/index.js"]
    }
  }
}
```

<details>
<summary><b>Claude Code</b></summary>

Run in your terminal:

```bash
claude mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
```

</details>

<details>
<summary><b>Codex</b></summary>

Run in your terminal:

```bash
codex mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
```

</details>

<details>
<summary><b>Claude Desktop</b></summary>

Add the standard config above to your `claude_desktop_config.json`, then **fully quit and reopen** Claude Desktop:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json` *(escape backslashes: `"C:\\Users\\you\\easyeda_mcp\\dist\\index.js"`)*

</details>

<details>
<summary><b>Cursor</b></summary>

Add the standard config above to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), then refresh servers in **Cursor Settings -> MCP**.

</details>

<details>
<summary><b>VS Code (GitHub Copilot)</b></summary>

Create `.vscode/mcp.json` in your workspace and open **Copilot Chat (Agent mode)**:

```json
{
  "servers": {
    "easyeda-pro": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/easyeda_mcp/dist/index.js"]
    }
  }
}
```

</details>

<details>
<summary><b>Antigravity</b></summary>

Add the standard config above to `~/.gemini/config/mcp_config.json`, then click **Refresh** in **Additional Options (`...`) -> MCP Servers**.

</details>

---

## Your First Prompts

Verify that the bridge is connected and sees your open document:

```text
Run easyeda_doctor and check whether the EasyEDA Pro bridge is healthy.
```

Once connected, try real hardware engineering workflows:

```text
Inspect the open schematic with easyeda_schematic_snapshot and list any unconnected pins.
```

```text
Verify USB1 with easyeda_verify_connections: check that CC1 and CC2 each have a 5.1k resistor to GND and VBUS is decoupled to GND.
```

```text
Read the active PCB design rules with easyeda_get_drc_rules and summarize track width, via size, and clearance limits.
```

More examples: **[Practical Workflows](https://vlabsoft.org/easyeda_mcp/workflows)**

---

## Available Tools (28)

| Category | Tools |
| --- | --- |
| **Status & Context** | `easyeda_doctor` · `easyeda_live_status` · `easyeda_get_context` |
| **Schematic Inspection & Search** | `easyeda_schematic_snapshot` · `easyeda_list_schematic_components` · `easyeda_get_component_pins` · `easyeda_find_component` · `easyeda_find_net` |
| **Circuit Tracing & Verification** | `easyeda_trace_net` · `easyeda_trace_component` · `easyeda_find_unconnected_pins` · `easyeda_validate_schematic_area` · `easyeda_verify_connections` |
| **PCB Layout & DRC Rules** | `easyeda_run_drc` · `easyeda_get_pcb_layers` · `easyeda_get_routing_status` · `easyeda_get_drc_rules` · `easyeda_prepare_drc_edit` · `easyeda_get_drc_edit_result` |
| **Navigation & Exports** | `easyeda_navigate_component` · `easyeda_navigate_region` · `easyeda_zoom_board` · `easyeda_export_cpl` · `easyeda_export_bom` · `easyeda_export_netlist` · `easyeda_export_gerber` · `easyeda_export_pdf` |
| **Confirmed Actions** | `easyeda_confirmed_action` (`save`, `importChanges`, `autoroute`, `autolayout`, `editDrcRules`) |

Full parameter schemas and examples: **[Tools Reference](https://vlabsoft.org/easyeda_mcp/tools)** · **[DRC Rule Editing](https://vlabsoft.org/easyeda_mcp/drc-rules)**

---

## Documentation

| Guide | When to use |
| --- | --- |
| **[Quick Start](https://vlabsoft.org/easyeda_mcp/quick-start)** | Shortest path from zero to a working bridge |
| **[AI Client Setup](https://vlabsoft.org/easyeda_mcp/ai-client-setup)** | Detailed setup for Claude Code, Codex, Claude Desktop, Cursor, VS Code, Antigravity & others |
| **[Practical Workflows](https://vlabsoft.org/easyeda_mcp/workflows)** | Copy-pasteable prompts for schematic review, circuit assertions, DRC, and exports |
| **[Upgrading & Compatibility](https://vlabsoft.org/easyeda_mcp/upgrading)** | Server/Extension version matrix and 3-step upgrade checklist |
| **[Troubleshooting](https://vlabsoft.org/easyeda_mcp/troubleshooting)** | Common fixes and bridge error code reference |
| **[Architecture](https://vlabsoft.org/easyeda_mcp/architecture)** & **[Safety Model](https://vlabsoft.org/easyeda_mcp/safety)** | How the local WebSocket bridge and confirmation gates work |
| **[Changelog](./docs/changelog.md)** & **[Releases](https://github.com/VLab-Software/easyeda_mcp/releases)** | Version history and prebuilt `.eext` downloads |

<details>
<summary><b>Development & Local Testing</b></summary>

```bash
npm run setup:local          # Build MCP server, extension bundle, and .eext package
npm test                     # Run Vitest unit suite
npm run typecheck            # Typecheck MCP server
npm run typecheck:extension  # Typecheck EasyEDA Pro extension
npm run test:smoke:drc       # End-to-end stdio + WebSocket DRC smoke test
npm run docs:build           # Build VitePress documentation site
```

</details>

---

## Security, Disclaimer & License

- **Localhost & Live Session**: Operates on the live project open in EasyEDA Pro over `127.0.0.1:8765` (no offline `.epro` parsing or commercial/order automation). Do not expose the WebSocket port to untrusted networks — see [SECURITY.md](./SECURITY.md).
- **Non-Affiliation**: Independent open-source project. Not affiliated with, endorsed by, or sponsored by EasyEDA, JLCPCB, or Shenzhen Jia Chuang Ban Technology Co., Ltd. EasyEDA and EasyEDA Pro are trademarks of their respective owners.
- **Contact & License**: [victor.freitas@vlabsoft.com](mailto:victor.freitas@vlabsoft.com) · Released under the [MIT License](./LICENSE).
