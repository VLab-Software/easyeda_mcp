# Changelog

All notable changes to the EasyEDA Pro MCP server and browser extension are documented on this page.

For packaged `.eext` and `.mcpb` downloads and checksums, see [GitHub Releases](https://github.com/VLab-Software/easyeda_mcp/releases).

## `1.3.0` (Extension `0.4.0`)

**PCB DRC Execution, CPL Export, Layer Stackup, Routing Status, PCB Components, Net Highlighting, Canvas Selection, and Library Search**

- **Active PCB DRC execution (`easyeda_run_drc`)**: execute native PCB design rule checks (`eda.pcb_Drc.check`) with optional verbose violation reporting.
- **Pick-and-Place / CPL export (`easyeda_export_cpl`)**: generate component placement files (`eda.pcb_ManufactureData.getPickAndPlaceFile`) for SMT assembly workflows.
- **PCB layer stackup (`easyeda_get_pcb_layers`)**: inspect active PCB layers, copper thicknesses, visibility, and layer types with case-insensitive copper filtering.
- **PCB routing status (`easyeda_get_routing_status`)**: inspect routed vs. unrouted nets, track segments, vias, and airwire/ratline completion status on the active PCB.
- **PCB component placement inspection (`easyeda_list_pcb_components`)**: list placed PCB footprints with coordinates, rotation, layer side (`top`/`bottom`), and designator filters.
- **Interactive net highlighting (`easyeda_highlight_net`)**: highlight and dim specific nets directly on the active PCB canvas.
- **Canvas selection inspection (`easyeda_get_selection`)**: inspect currently selected primitives on the active schematic or PCB canvas.
- **Component library search (`easyeda_search_library`)**: search EasyEDA/LCSC component libraries (`eda.lib_Device.search`) by query and library UUID.

## `1.2.0` (Extension `0.2.0`)

**One-Command Client Setup, 1-Click Install Links, and Claude Desktop `.mcpb` Bundle**

- **Multi-client auto-installer (`npx -y @vlabsoftware/easyeda-pro-mcp setup`)**: automatically detects and configures **Claude Desktop**, **Cursor**, **VS Code** (`servers` schema), **Antigravity**, **Windsurf**, **Claude Code** (`~/.claude.json`), and **Codex** (`~/.codex/config.toml`) across macOS, Windows (`cmd /c npx`), and Linux while preserving existing MCP servers and comments.
- **Bundled `.eext` extension in npm package (`export-extension`)**: packages `build/dist/easyeda_mcp_bridge.eext` inside `@vlabsoftware/easyeda-pro-mcp` so `setup` and `export-extension` extract the version-matched EasyEDA Pro extension directly to disk without cloning the repository.
- **1-click install badges & Claude Desktop `.mcpb` bundle (`npm run package:mcpb`)**: adds verified 1-click install links for Cursor and VS Code plus a standalone `easyeda-pro-mcp.mcpb` (`manifest_version: "0.3"`) archive for Claude Desktop.
- **Bridge environment variable hardening**: safely falls back to `127.0.0.1:8765` when `EASYEDA_MCP_WS_HOST` or `EASYEDA_MCP_WS_PORT` are blank strings.

## `1.1.0` (Extension `0.2.0`)

**PCB DRC Design Rule Inspection and Editing ([#14](https://github.com/VLab-Software/easyeda_mcp/issues/14))**

- **Native PCB DRC rule reads (`easyeda_get_drc_rules`)**: inspect `current` PCB rules, saved `configurations`, `netRules`, `netByNetRules`, and `regionRules`, along with per-method runtime capability detection on `eda.pcb_Drc`.
- **Immutable DRC edit previews (`easyeda_prepare_drc_edit`)**: stage changes without modifying the PCB and receive an `editId`, target PCB identity (`projectUuid`, `documentUuid`, `tabId`), before/after snapshot, and exact confirmation phrase.
- **Confirmed DRC rule updates (`easyeda_confirmed_action` with `action: "editDrcRules"`)**:
  - `createConfiguration`: create a new named rule profile (`allowOverwrite=false`).
  - `updateCurrentConfiguration`: update the active PCB rule configuration.
  - `replaceNetRules`, `replaceNetByNetRules`, `replaceRegionRules`: replace rule tables on the active PCB.
- **Stale-state & transport safety (`easyeda_get_drc_edit_result`)**: enforce exact confirmation (`CONFIRM editDrcRules <editId>`) at both the MCP server and extension boundaries, block execution if the PCB target, session, or underlying rules changed since preview, verify changes via full native readback, and query inconclusive/timed-out edits without replaying mutations.
- **Release & CI hardening**: unified runtime/package/manifest version checks (`src/version.ts`), end-to-end stdio + WebSocket DRC smoke test (`npm run test:smoke:drc`), and [DRC Rule Editing documentation](./drc-rules.md).

## `0.1.0` (Extension `0.1.0`)

**Initial Public Release**

- Local MCP server over `stdio` paired with the EasyEDA Pro WebSocket bridge extension (`ws://127.0.0.1:8765`).
- Live project and active document context (`easyeda_live_status`, `easyeda_doctor`, `easyeda_get_context`).
- Schematic inspection (`easyeda_schematic_snapshot`, `easyeda_list_schematic_components`, `easyeda_get_component_pins`, `easyeda_find_component`, `easyeda_find_net`).
- Net and component tracing (`easyeda_trace_net`, `easyeda_trace_component`, `easyeda_find_unconnected_pins`).
- Schematic validation and targeted connection assertions (`easyeda_validate_schematic_area`, `easyeda_verify_connections`).
- Editor navigation and manufacturing exports (`easyeda_navigate_component`, `easyeda_navigate_region`, `easyeda_zoom_board`, `easyeda_export_bom`, `easyeda_export_netlist`, `easyeda_export_gerber`, `easyeda_export_pdf`).
- Confirmation-gated editor actions (`easyeda_confirmed_action`: `save`, `importChanges`, `autoroute`, `autolayout`).
