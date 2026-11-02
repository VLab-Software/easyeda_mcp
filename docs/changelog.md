# Changelog

All notable changes to the EasyEDA Pro MCP server and browser extension are documented on this page.

For packaged `.eext` and `.mcpb` downloads and checksums, see [GitHub Releases](https://github.com/VLab-Software/easyeda_mcp/releases).

## `1.4.1` (Extension `0.5.1`)

- feat: reconcile single-page snapshots with native Protel2 netlists
- fix: serialize native wire readback as plain JSON
- fix: track mutation deadlines and reconcile late completion
- fix: decode native wire segment groups without artificial diagonals
- fix: preserve schematic wire geometry and net identity

## `1.4.0` (Extension `0.5.0`)

- feat(spice): simulation feasibility assessment, component audit and SPICE netlist generation (Phase 5.5)
- feat(export): manufacturing, image rendering, 3D mechanical CAD and project archive exports (Phase 5.4)
- feat(sync): schematic-pcb cross-domain comparison, synchronization and board generation (Phase 5.3)
- feat(schematic): net ports, hierarchical sheet connectors and multi-bit bus mutations (Phase 5.2)
- feat(library): device inspection, pin-to-pad correspondence and alternate part comparison
- feat(pcb): external routing/layout imports and 3D spatial clearance inspection
- feat(pcb): net classes, differential pairs and length matching constraints with API verification
- feat(pcb): airwires and placement/net physical reports with transparent tolerances and inference limits
- feat(pcb): copper zones, rebuild calculations and keepouts with readback verification
- feat(pcb): inspection, creation, modification and deletion of tracks and vias with readback verification
- feat(pcb): detailed DRC execution with categorized violations, evidence, document identity and editor comparison
- feat(pcb): native autoroute and autolayout mutations, destructive unrouting, and external import distinction
- feat(pcb): board outline inspection, creation, polygon sizing, clearing and readback verification
- feat(pcb): component transformation lifecycle with move, rotate, flip, delete and readback verification
- feat(pcb): inspect pads, nets, coordinates and properties with reconciled component tool
- feat(schematic): native nets and ERC inspection by page with explicit inconclusive handling
- feat(schematic): wire and net label mutation lifecycle with coordinate validation and affected connection analysis
- feat(schematic): component mutation lifecycle with create, move, update, delete, ID resolution and readback
- feat(documents): list and open documents by identity with canvas view rendering and focus tracking
- feat(mutation): implement generalized mutation lifecycle with preview, target validation, and readback
- feat(snapshots): enrich snapshots with document identity, completeness, and freshness validation
- feat(identity): add document identity, method capabilities and target validation
- feat(mcp): migrate from @modelcontextprotocol/sdk to modern v2 packages
- chore(quality): add eslint, prettier, dependency boundary checks and ci validation
- refactor(schematic): decouple analysis into types, normalization, connectivity, and checks
- refactor: decouple extension connection, dispatcher and domain handlers
- chore: share RPC contracts and decouple tools from bridge
- Merge PR #23: modularize MCP tools and extension helpers
- chore: remove AGENTS.md
- chore: remove specification template
- docs: remove evolution planning from published documentation
- docs: use project branch prefixes for evolution phases
- docs: establish phase 0A architecture and delivery governance
- chore: modularize mcp tools and extension helpers, add sdd spec template

## `1.3.1` (Extension `0.4.0`)

- docs: add github sponsors badge and support link
- chore: add github funding configuration
- fix(ci): support npm OIDC Trusted Publishing and npm stage publish

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
