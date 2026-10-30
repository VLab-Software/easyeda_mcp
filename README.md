<p align="center">
  <img src="./docs/public/landing.svg" alt="EasyEDA Pro MCP" width="140" />
</p>

<h1 align="center">EasyEDA Pro MCP</h1>

<p align="center">
  Connect Claude, Codex, Cursor, VS Code, Antigravity, and other Model Context Protocol (MCP) clients to the live EasyEDA Pro project already open on your machine.
</p>

<p align="center">
  Independent open-source MCP bridge for live schematic and PCB workflows in EasyEDA Pro.
</p>

<p align="center">
  <a href="https://github.com/VLab-Software/easyeda_mcp/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/VLab-Software/easyeda_mcp/ci.yml?branch=master&label=CI"></a>
  <a href="https://www.npmjs.com/package/@vlabsoftware/easyeda-pro-mcp"><img alt="npm" src="https://img.shields.io/npm/v/@vlabsoftware/easyeda-pro-mcp?label=npm"></a>
  <a href="https://github.com/VLab-Software/easyeda_mcp/releases"><img alt="Release" src="https://img.shields.io/github/v/release/VLab-Software/easyeda_mcp?include_prereleases&label=release"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D20-339933">
  <img alt="Platforms" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey">
</p>

<p align="center">
  <a href="https://cursor.com/install-mcp?name=easyeda-pro&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB2bGFic29mdHdhcmUvZWFzeWVkYS1wcm8tbWNwIl19"><img alt="Install in Cursor" src="https://img.shields.io/badge/Cursor-Install_MCP-000000?logo=cursor&logoColor=white"></a>
  <a href="https://vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522easyeda-pro%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522%2540vlabsoftware%252Feasyeda-pro-mcp%2522%255D%257D"><img alt="Install in VS Code" src="https://img.shields.io/badge/VS_Code-Install_MCP-0098FF?logo=visualstudiocode&logoColor=white"></a>
  <a href="https://github.com/VLab-Software/easyeda_mcp/releases/latest/download/easyeda-pro-mcp.mcpb"><img alt="Claude Desktop .mcpb" src="https://img.shields.io/badge/Claude_Desktop-Download_.mcpb-D97757?logo=claude&logoColor=white"></a>
  <a href="https://github.com/VLab-Software/easyeda_mcp/releases/latest/download/easyeda_mcp_bridge.eext"><img alt="EasyEDA Extension .eext" src="https://img.shields.io/badge/EasyEDA_Pro-Download_.eext-2563EB"></a>
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

EasyEDA Pro MCP has two local parts: the **EasyEDA Pro Extension** (`.eext`) inside the editor and the **MCP Server** (`@vlabsoftware/easyeda-pro-mcp`) launched by your AI client.

### 1. Automatic Setup (Fastest — No Git Clone)

Run one command in your terminal:

```bash
npx -y @vlabsoftware/easyeda-pro-mcp setup
```

This automatically detects and configures installed AI clients (**Claude Desktop**, **Cursor**, **VS Code**, **Antigravity**, **Windsurf**, **Claude Code**, **Codex**) with platform-safe commands and exports `easyeda_mcp_bridge.eext` to your `~/Downloads` folder (or current directory).

<details>
<summary><b>Building from source instead?</b></summary>

```bash
git clone https://github.com/VLab-Software/easyeda_mcp.git
cd easyeda_mcp
npm install
npm run setup:local
npm run setup:clients   # Optional: points detected AI clients to this local build
```

This builds `dist/index.js`, `build/dist/easyeda_mcp_bridge.eext`, and `build/dist/easyeda-pro-mcp.mcpb`.

</details>

### 2. Install the EasyEDA Pro Extension

1. In EasyEDA Pro, open **Extensions Manager** and import the exported `easyeda_mcp_bridge.eext` *(or download [`easyeda_mcp_bridge.eext`](https://github.com/VLab-Software/easyeda_mcp/releases/latest/download/easyeda_mcp_bridge.eext) from Releases)*.
2. Enable **Allow interactive with external** for **EasyEDA MCP Bridge**.
3. Open your schematic or PCB project *(if needed, click **MCP Bridge -> Reconnect** in the top toolbar)*.

### 3. Or Add the MCP Server Manually / 1-Click

If you skipped `npx -y @vlabsoftware/easyeda-pro-mcp setup`, use a 1-click badge above or add the **standard `npx` config** below:

```json
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "npx",
      "args": ["-y", "@vlabsoftware/easyeda-pro-mcp"]
    }
  }
}
```

> **Windows JSON note:** In GUI clients on Windows, use `"command": "cmd", "args": ["/c", "npx", "-y", "@vlabsoftware/easyeda-pro-mcp"]` so `npx.cmd` spawns cleanly.

<details>
<summary><b>Claude Code</b></summary>

Run in your terminal:

```bash
claude mcp add --scope user easyeda-pro -- npx -y @vlabsoftware/easyeda-pro-mcp
```

</details>

<details>
<summary><b>Codex</b></summary>

Run in your terminal:

```bash
codex mcp add easyeda-pro -- npx -y @vlabsoftware/easyeda-pro-mcp
```

</details>

<details>
<summary><b>Claude Desktop</b></summary>

- **1-Click Bundle**: Download [`easyeda-pro-mcp.mcpb`](https://github.com/VLab-Software/easyeda_mcp/releases/latest/download/easyeda-pro-mcp.mcpb) and double-click it to install in Claude Desktop.
- **Manual JSON**: Or add the standard config above to `claude_desktop_config.json`, then **fully quit and reopen** Claude Desktop:
  - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json` *(use `"command": "cmd", "args": ["/c", "npx", "-y", "@vlabsoftware/easyeda-pro-mcp"]`)*

</details>

<details>
<summary><b>Cursor</b></summary>

Click **[Install in Cursor](https://cursor.com/install-mcp?name=easyeda-pro&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB2bGFic29mdHdhcmUvZWFzeWVkYS1wcm8tbWNwIl19)**, or add the standard config above to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project) and refresh servers in **Cursor Settings -> MCP**.

</details>

<details>
<summary><b>VS Code (GitHub Copilot)</b></summary>

Click **[Install in VS Code](https://vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522easyeda-pro%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522%2540vlabsoftware%252Feasyeda-pro-mcp%2522%255D%257D)**, or add to `.vscode/mcp.json` (or **Command Palette -> `MCP: Open User Configuration`**) and open **Copilot Chat (Agent mode)**:

```json
{
  "servers": {
    "easyeda-pro": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@vlabsoftware/easyeda-pro-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Antigravity & Windsurf</b></summary>

- **Antigravity**: Run `npx -y @vlabsoftware/easyeda-pro-mcp setup --client antigravity` (or add the standard config to `~/.gemini/config/mcp_config.json`), then click **Refresh** in **Additional Options (`...`) -> MCP Servers**.
- **Windsurf**: Run `npx -y @vlabsoftware/easyeda-pro-mcp setup --client windsurf` (or add the standard config to `~/.codeium/windsurf/mcp_config.json`), then refresh MCP servers in Cascade settings.

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

## Available Tools (32)

| Category | Tools |
| --- | --- |
| **Status & Context** | `easyeda_doctor` · `easyeda_live_status` · `easyeda_get_context` · `easyeda_get_selection` |
| **Schematic Inspection & Search** | `easyeda_schematic_snapshot` · `easyeda_list_schematic_components` · `easyeda_get_component_pins` · `easyeda_find_component` · `easyeda_find_net` · `easyeda_search_library` |
| **Circuit Tracing & Verification** | `easyeda_trace_net` · `easyeda_trace_component` · `easyeda_find_unconnected_pins` · `easyeda_validate_schematic_area` · `easyeda_verify_connections` |
| **PCB Layout & DRC Rules** | `easyeda_run_drc` · `easyeda_get_pcb_layers` · `easyeda_get_routing_status` · `easyeda_list_pcb_components` · `easyeda_highlight_net` · `easyeda_get_drc_rules` · `easyeda_prepare_drc_edit` · `easyeda_get_drc_edit_result` |
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
| **[Changelog](./docs/changelog.md)** & **[Releases](https://github.com/VLab-Software/easyeda_mcp/releases)** | Version history and prebuilt `.eext` / `.mcpb` downloads |

<details>
<summary><b>Development & Local Testing</b></summary>

```bash
npm run setup:local          # Build MCP server, extension bundle, .eext, and .mcpb packages
npm run setup:clients        # Point detected AI clients to this local checkout (--local)
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
