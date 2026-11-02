# Tools Reference

EasyEDA Pro MCP exposes **76 tools** across 9 categories. All inspection, tracing, navigation, and export tools are read-only (`readOnlyHint: true`).

## Tool Catalog

- **[Status & Context](#status-context)** (4 tools)
  - [`easyeda_doctor`](#easyeda_doctor) · [`easyeda_live_status`](#easyeda_live_status) · [`easyeda_get_context`](#easyeda_get_context) · [`easyeda_get_selection`](#easyeda_get_selection)
- **[Document Management & Canvas View](#document-management-canvas-view)** (3 tools)
  - [`easyeda_list_documents`](#easyeda_list_documents) · [`easyeda_open_document`](#easyeda_open_document) · [`easyeda_render_document_view`](#easyeda_render_document_view)
- **[Schematic Mutations & Lifecycle](#schematic-mutations-lifecycle)** (6 tools)
  - [`easyeda_prepare_schematic_component`](#easyeda_prepare_schematic_component) · [`easyeda_prepare_schematic_wire`](#easyeda_prepare_schematic_wire) · [`easyeda_prepare_schematic_port`](#easyeda_prepare_schematic_port) · [`easyeda_prepare_schematic_bus`](#easyeda_prepare_schematic_bus) · [`easyeda_prepare_schematic_pcb_sync`](#easyeda_prepare_schematic_pcb_sync) · [`easyeda_get_mutation_result`](#easyeda_get_mutation_result)
- **[Search & Schematic Inspection](#search-schematic-inspection)** (9 tools)
  - [`easyeda_schematic_snapshot`](#easyeda_schematic_snapshot) · [`easyeda_get_schematic_nets`](#easyeda_get_schematic_nets) · [`easyeda_get_schematic_ports_buses`](#easyeda_get_schematic_ports_buses) · [`easyeda_compare_schematic_pcb`](#easyeda_compare_schematic_pcb) · [`easyeda_list_schematic_components`](#easyeda_list_schematic_components) · [`easyeda_get_component_pins`](#easyeda_get_component_pins) · [`easyeda_find_component`](#easyeda_find_component) · [`easyeda_find_net`](#easyeda_find_net) · [`easyeda_search_library`](#easyeda_search_library)
- **[Circuit Tracing & Verification](#circuit-tracing-verification)** (6 tools)
  - [`easyeda_run_schematic_erc`](#easyeda_run_schematic_erc) · [`easyeda_trace_net`](#easyeda_trace_net) · [`easyeda_trace_component`](#easyeda_trace_component) · [`easyeda_find_unconnected_pins`](#easyeda_find_unconnected_pins) · [`easyeda_validate_schematic_area`](#easyeda_validate_schematic_area) · [`easyeda_verify_connections`](#easyeda_verify_connections)
- **[PCB Layout & DRC Rules](#pcb-layout-drc-rules)** (30 tools)
  - [`easyeda_run_drc`](#easyeda_run_drc) · [`easyeda_get_pcb_layers`](#easyeda_get_pcb_layers) · [`easyeda_get_routing_status`](#easyeda_get_routing_status) · [`easyeda_list_pcb_components`](#easyeda_list_pcb_components) · [`easyeda_get_pcb_pads`](#easyeda_get_pcb_pads) · [`easyeda_prepare_pcb_component`](#easyeda_prepare_pcb_component) · [`easyeda_get_board_outline`](#easyeda_get_board_outline) · [`easyeda_prepare_board_outline`](#easyeda_prepare_board_outline) · [`easyeda_prepare_pcb_routing`](#easyeda_prepare_pcb_routing) · [`easyeda_prepare_pcb_layout`](#easyeda_prepare_pcb_layout) · [`easyeda_get_pcb_tracks`](#easyeda_get_pcb_tracks) · [`easyeda_get_pcb_vias`](#easyeda_get_pcb_vias) · [`easyeda_prepare_pcb_track_via`](#easyeda_prepare_pcb_track_via) · [`easyeda_highlight_net`](#easyeda_highlight_net) · [`easyeda_get_copper_zones`](#easyeda_get_copper_zones) · [`easyeda_get_keepouts`](#easyeda_get_keepouts) · [`easyeda_prepare_copper_keepout`](#easyeda_prepare_copper_keepout) · [`easyeda_get_pcb_airwires`](#easyeda_get_pcb_airwires) · [`easyeda_get_pcb_placement_report`](#easyeda_get_pcb_placement_report) · [`easyeda_get_pcb_net_report`](#easyeda_get_pcb_net_report) · [`easyeda_get_pcb_net_classes`](#easyeda_get_pcb_net_classes) · [`easyeda_get_pcb_differential_pairs`](#easyeda_get_pcb_differential_pairs) · [`easyeda_get_pcb_length_groups`](#easyeda_get_pcb_length_groups) · [`easyeda_prepare_pcb_net_constraint`](#easyeda_prepare_pcb_net_constraint) · [`easyeda_get_pcb_3d_inspection`](#easyeda_get_pcb_3d_inspection) · [`easyeda_get_pcb_3d_view`](#easyeda_get_pcb_3d_view) · [`easyeda_prepare_pcb_external_import`](#easyeda_prepare_pcb_external_import) · [`easyeda_get_drc_rules`](#easyeda_get_drc_rules) · [`easyeda_prepare_drc_edit`](#easyeda_prepare_drc_edit) · [`easyeda_get_drc_edit_result`](#easyeda_get_drc_edit_result)
- **[Libraries, Navigation & Exports](#navigation-exports)** (15 tools)
  - [`easyeda_export_cpl`](#easyeda_export_cpl) · [`easyeda_export_bom`](#easyeda_export_bom) · [`easyeda_export_netlist`](#easyeda_export_netlist) · [`easyeda_export_gerber`](#easyeda_export_gerber) · [`easyeda_export_pdf`](#easyeda_export_pdf) · [`easyeda_export_image`](#easyeda_export_image) · [`easyeda_export_3d_model`](#easyeda_export_3d_model) · [`easyeda_export_project_archive`](#easyeda_export_project_archive) · [`easyeda_export_dxf`](#easyeda_export_dxf) · [`easyeda_navigate_component`](#easyeda_navigate_component) · [`easyeda_navigate_region`](#easyeda_navigate_region) · [`easyeda_zoom_board`](#easyeda_zoom_board) · [`easyeda_get_device_details`](#easyeda_get_device_details) · [`easyeda_compare_devices`](#easyeda_compare_devices) · [`easyeda_verify_pin_pad_mapping`](#easyeda_verify_pin_pad_mapping)
- **[SPICE Simulation Feasibility](#spice-simulation-feasibility)** (2 tools)
  - [`easyeda_evaluate_spice_support`](#easyeda_evaluate_spice_support) · [`easyeda_generate_spice_netlist`](#easyeda_generate_spice_netlist)
- **[Confirmation-Gated Actions](#confirmation-gated-actions)** (1 tool)
  - [`easyeda_confirmed_action`](#easyeda_confirmed_action)

::: info Common Timeout Parameter
Every RPC tool accepts an optional **`timeoutMs`** (`integer`, `1`–`120000`). Default is `10000` ms for fast lookups, `30000` ms for schematic analysis/BOM/netlist exports, and `60000` ms for Gerber/PDF exports and confirmed actions.
:::

---

## Status & Context

### `easyeda_doctor`

**Scope:** Local MCP Server (`readOnlyHint: true`, `idempotentHint: true`)

Returns a structured health diagnosis of the MCP server, WebSocket bridge endpoint, extension connection state, protocol compatibility, active document availability, and recommended `nextSteps`.

**Parameters:** None (`{}`)

---

### `easyeda_live_status`

**Scope:** Local MCP Server (`readOnlyHint: true`, `idempotentHint: true`)

Quick connection check returning the cached extension handshake status and `bridgeEndpoint` (`ws://127.0.0.1:8765`).

**Parameters:** None (`{}`)

---

### `easyeda_get_context`

**Scope:** Editor RPC (`readOnlyHint: true`, default timeout: `10000` ms)

Fetches live context from EasyEDA Pro: active project/document UUIDs, `splitScreenTree` (open tabs), `capabilities` (including per-method `drcRules`), and component/net counts.

**Parameters:**
- **`timeoutMs`** (`number`, _optional_, default: `10000`): RPC timeout in milliseconds (`<= 120000`).

---

### `easyeda_get_selection`

**Scope:** Editor RPC (`readOnlyHint: true`, default timeout: `10000` ms)

Inspects the user's active canvas selection on either schematic or PCB documents via `eda.dmt_SelectControl`, returning selected primitive IDs, component designators, and types.

**Parameters:**
- **`timeoutMs`** (`number`, _optional_, default: `10000`): RPC timeout in ms.

---

## Document Management & Canvas View

### `easyeda_list_documents`

**Scope:** Editor RPC (`readOnlyHint: true`, `idempotentHint: true`, default timeout: `30000` ms)

Lists all documents belonging to the current EasyEDA Pro project and open editor tabs, detailing document identity, type (schematic, PCB, symbol, footprint), open/active status, tab IDs, and split screen layout.

**Parameters:**
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_open_document`

**Scope:** Editor RPC (`readOnlyHint: false`, `idempotentHint: true`, default timeout: `30000` ms)

Opens a document or activates an open tab in EasyEDA Pro, shifting input focus and canvas viewport. Provides readback confirmation and reports focus transitions (`previousTarget`, `currentTarget`, `focusChanged`).

**Parameters:**
- **`documentId`** (`string`, _optional_): Document UUID to open.
- **`tabId`** (`string`, _optional_): Tab ID to activate if already open.
- **`target`** (`object`, _optional_): Expected document target specification (`{ documentId, documentType, projectId }`).
- **`splitScreenId`** (`string`, _optional_): Split screen ID to place the opened document into.
- **`activate`** (`boolean`, _optional_, default: `true`): Whether to bring focus and activate the tab.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_render_document_view`

**Scope:** Editor RPC (`readOnlyHint: true`, `idempotentHint: false`, default timeout: `30000` ms)

Captures the visible canvas rendering viewport image in EasyEDA Pro (via `eda.dmt_EditorControl.getCurrentRenderedAreaImage`). Explicitly documents viewport limits and asserts target match.

**Parameters:**
- **`target`** (`object`, _optional_): Expected document target to guard against capturing wrong canvas.
- **`tabId`** (`string`, _optional_): Target tab ID if capturing a specific open tab.
- **`format`** (`"data_url" | "base64"`, _optional_, default: `"data_url"`): Image encoding format.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

::: warning Viewport and Capture Limits
1. Captures only the currently rendered area of the active canvas viewport, not off-screen elements or entire multi-page projects.
2. Resolution and scale correspond directly to the current zoom level in the editor.
3. Requires the editor canvas engine to have completed paint execution.
:::

---

## Schematic Mutations & Lifecycle

### `easyeda_prepare_schematic_component`

**Scope:** Editor RPC (`readOnlyHint: true`, `idempotentHint: false`, default timeout: `30000` ms)

Prepares a typed schematic component mutation (`create`, `move`, `update`, `delete`) with full preview, ID/designator resolution, and exact confirmation phrase. Does not modify the schematic until confirmed via `easyeda_confirmed_action`.

**Parameters:**
- **`action`** (`"create" | "move" | "update" | "delete"`, **required**): Mutation action to perform.
- **`component`** (`string`, _optional_): Primitive ID or designator (e.g. `'R1'`, `'U2'`) for `move`, `update`, or `delete`.
- **`device`** (`string | object`, _optional_): LCSC part code, device name, or device query for `create` (e.g. `'10k 0603'`, `'C1523'`, `'ESP32'`).
- **`x`**, **`y`** (`number`, _optional_): Coordinates for placement or absolute move.
- **`dx`**, **`dy`** (`number`, _optional_): Relative coordinate offsets for `move`.
- **`properties`** (`object`, _optional_): Key-value properties map to update.
- **`designator`** (`string`, _optional_): Designator to assign or update.
- **`value`** (`string`, _optional_): Component value.
- **`footprint`** (`string`, _optional_): Footprint package name.
- **`rotation`** (`number`, _optional_): Rotation in degrees (`0`, `90`, `180`, `270`).
- **`mirror`** (`boolean`, _optional_): Mirror state.
- **`subPartName`** (`string`, _optional_): Sub-part name for multi-part components.
- **`addIntoBom`** (`boolean`, _optional_, default: `true`): Whether to include in BOM.
- **`addIntoPcb`** (`boolean`, _optional_, default: `true`): Whether to forward to PCB.
- **`target`** (`object`, _optional_): Expected document target specification.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_prepare_schematic_wire`

**Scope:** Editor RPC (`readOnlyHint: true`, `idempotentHint: false`, default timeout: `30000` ms)

Prepares a typed schematic wire or net label mutation (`createWire`, `modifyWire`, `deleteWire`, `addNetLabel`) with coordinate normalization, affected pin/connection analysis, and exact confirmation phrase. Does not modify the schematic until confirmed via `easyeda_confirmed_action`.

**Parameters:**
- **`action`** (`"createWire" | "modifyWire" | "deleteWire" | "addNetLabel"`, **required**): Wire mutation action to perform.
- **`wireId`** (`string`, _optional_): Primitive ID or primitive identifier for `modifyWire` or `deleteWire`.
- **`coordinates`** (`array`, _optional_): Flat coordinate array `[x1, y1, x2, y2, ...]` or list of point objects `[{ x, y }, ...]` representing wire segments (minimum 2 points).
- **`net`** (`string`, _optional_): Net name to associate with the wire or net label.
- **`color`** (`string`, _optional_): Wire stroke color (e.g. `'#008800'`).
- **`lineWidth`** (`number`, _optional_): Stroke width.
- **`lineType`** (`number`, _optional_): Line style pattern.
- **`x`**, **`y`** (`number`, _optional_): Coordinates for net label placement (`addNetLabel`).
- **`rotation`** (`number`, _optional_): Rotation angle for net label or flag (`0`, `90`, `180`, `270`).
- **`flagType`** (`string`, _optional_): Net flag style if placed as net flag (e.g. `'flag'`, `'gnd'`, `'power'`).
- **`target`** (`object`, _optional_): Expected document target specification.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_prepare_schematic_port`

**Scope:** Editor RPC (`readOnlyHint: true`, `idempotentHint: false`, default timeout: `30000` ms)

Prepares a typed schematic net port (hierarchical sheet or global connector) mutation (`createPort`, `modifyPort`, `deletePort`) with port type normalization (`input`, `output`, `bidirectional`, `unspecified`), coordinate validation, preview diff, and exact confirmation phrase. Does not modify the schematic until confirmed via `easyeda_confirmed_action`.

**Parameters:**
- **`action`** (`string`, **required**, enum: `createPort`, `modifyPort`, `deletePort`): Port mutation action to perform.
- **`name`** (`string`, _optional_): Net name assigned to the port (e.g. `'TXD'`, `'CLK'`, `'RESET'`). Required for `createPort`.
- **`portType`** (`string`, _optional_, enum: `input`, `output`, `bidirectional`, `unspecified`): Port signal direction.
- **`x`** (`number`, _optional_): X coordinate for port placement. Required for `createPort`.
- **`y`** (`number`, _optional_): Y coordinate for port placement. Required for `createPort`.
- **`rotation`** (`number`, _optional_, default: `0`): Rotation angle in degrees (`0`, `90`, `180`, `270`).
- **`color`** (`string`, _optional_): Optional color hex or name string.
- **`portId`** (`string`, _optional_): Target port primitiveId for `modifyPort` or `deletePort`.
- **`target`** (`object`, _optional_): Expected document target specification.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_prepare_schematic_bus`

**Scope:** Editor RPC (`readOnlyHint: true`, `idempotentHint: false`, default timeout: `30000` ms)

Prepares a multi-bit bus polyline or diagonal bus entry tap mutation (`createBus`, `modifyBus`, `deleteBus`, `createBusEntry`, `deleteBusEntry`) with syntax parsing (`NAME[start..end]`, `NAME[start:end]`, `NAME[A,B,C]`), coordinate validation, connectivity diagnostics, preview diff, and exact confirmation phrase. Does not modify the schematic until confirmed via `easyeda_confirmed_action`.

**Parameters:**
- **`action`** (`string`, **required**, enum: `createBus`, `modifyBus`, `deleteBus`, `createBusEntry`, `deleteBusEntry`): Bus or bus entry action to perform.
- **`name`** (`string`, _optional_): Bus name with syntax, e.g. `'DATA[0..7]'` or `'ADDR[15:0]'`. Required for `createBus`.
- **`coordinates`** (`array of numbers`, _optional_): Flat polyline coordinates `[x1, y1, x2, y2, ...]` (at least 2 points / 4 numbers) for bus polyline.
- **`lineWidth`** (`number`, _optional_): Bus stroke width.
- **`color`** (`string`, _optional_): Bus stroke color string.
- **`busId`** (`string`, _optional_): Target bus primitive ID for `modifyBus`, `deleteBus`, or attaching a bus entry.
- **`entryId`** (`string`, _optional_): Target bus entry primitive ID for `deleteBusEntry`.
- **`startX`** (`number`, _optional_): Start X coordinate for bus entry tap.
- **`startY`** (`number`, _optional_): Start Y coordinate for bus entry tap.
- **`endX`** (`number`, _optional_): End X coordinate for bus entry tap.
- **`endY`** (`number`, _optional_): End Y coordinate for bus entry tap.
- **`rotation`** (`number`, _optional_): Rotation angle for bus entry tap.
- **`net`** (`string`, _optional_): Net name for tapped signal (e.g. `'DATA0'`). Validated against parent bus signals.
- **`wireId`** (`string`, _optional_): Primitive ID of wire tapped by bus entry.
- **`target`** (`object`, _optional_): Expected document target specification.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_prepare_schematic_pcb_sync`

**Scope:** Editor RPC (`readOnlyHint: true`, `idempotentHint: false`, default timeout: `30000` ms)

Prepares a synchronization or board creation mutation between Schematic and PCB in EasyEDA Pro (`syncToPcb`, `syncToSchematic`, `createPcbFromSchematic`) with cross-domain discrepancy preview, before/after score evaluation, and exact confirmation phrase. Does not write until confirmed via `easyeda_confirmed_action`.

**Parameters:**
- **`action`** (`string`, **required**, enum: `syncToPcb`, `syncToSchematic`, `createPcbFromSchematic`): Synchronization or board creation action to perform.
- **`boardName`** (`string`, _optional_): Document title for newly created PCB document (`createPcbFromSchematic`).
- **`layerCount`** (`number`, _optional_, default: `2`): Copper layer count for new board (`1` to `32`).
- **`width`** (`number`, _optional_, default: `100`): Board outline width in mm.
- **`height`** (`number`, _optional_, default: `80`): Board outline height in mm.
- **`schematicTarget`** (`object`, _optional_): Expected schematic document target to guard against drift.
- **`pcbTarget`** (`object`, _optional_): Expected PCB document target to guard against drift.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_mutation_result`

**Scope:** Editor RPC (`readOnlyHint: true`, `idempotentHint: true`, default timeout: `10000` ms)

Queries the status, readback evidence, and verification of any prepared or applied mutation by `mutationId`. Safe and read-only; never automatically replays a mutation.

**Parameters:**
- **`mutationId`** (`string`, **required**): The `mutationId` returned during preparation.
- **`timeoutMs`** (`number`, _optional_, default: `10000`): RPC timeout in ms.

---

## Search & Schematic Inspection

### `easyeda_schematic_snapshot`

**Scope:** Schematic RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Builds a normalized snapshot of the active schematic: components, pins, wires, labels, nets, counts, `warnings`, and `confidence` (`high` | `partial` | `low`).

**Parameters:**
- **`includeRaw`** (`boolean`, _optional_, default: `true`): Include compact raw EasyEDA API payloads for fallback reasoning.
- **`allPages`** (`boolean`, _optional_, default: `true`): Collect across all schematic pages when exposed by EasyEDA Pro.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

**Native connectivity:** with `allPages: false`, the extension attempts
`sch_ManufactureData.getNetlistFile("mcp-native-connectivity", "Protel2")` and reads the returned
File in memory. It does not save an export or modify the schematic. The read has a 3-second budget
and a 2 MB limit. Only supported Protel2 component and net records are parsed.

The `nativeNetlist` result reports `status`, `format`, `matchedPins`, `conflicts`, and an optional
`reason`. Pins matched by an exact, project-unique designator and pin number use
`netSource: "native_netlist"`. Native membership takes precedence over geometric inference;
disagreements produce warnings. Conflicting native memberships remain unknown.

An absent member does not prove disconnection: exports may omit components. Missing APIs,
unsupported files, timeouts, duplicate designators, and unmatched pins retain explicit geometric
fallback. Multi-page snapshots currently do not apply native membership because page-local IDs
and duplicate references need a separate scoped reconciliation. This integration requires a real
editor check after reloading the rebuilt extension; parsing tests alone do not establish export
compatibility with every EasyEDA version.

### `easyeda_get_schematic_nets`

**Scope:** Schematic RPC (`readOnlyHint: true`, `idempotentHint: true`, default timeout: `30000` ms)

Queries native schematic nets from EasyEDA Pro per-sheet or project-wide via `eda.sch_Net`. Explicity reports whether native nets are available in the connected EasyEDA version, preserving clarity between native net declarations and heuristic geometric inferences. Empty or conflicting net data is explicitly marked as `inconclusive`.

**Parameters:**
- **`pageId`** (`string`, _optional_): Filter nets by specific schematic sheet/page ID.
- **`pageIndex`** (`number`, _optional_): Filter nets by page index.
- **`allPages`** (`boolean`, _optional_, default: `true`): Collect nets across all schematic sheets.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw net records from EasyEDA API.
- **`target`** (`object`, _optional_): Expected document target specification to assert against active canvas.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_schematic_ports_buses`

**Scope:** Schematic RPC (`readOnlyHint: true`, `idempotentHint: true`, default timeout: `15000` ms)

Inspects net ports (hierarchical/sheet connectors and global net flags), multi-bit buses (`sch_PrimitiveBus`), and diagonal bus entry taps (`sch_PrimitiveBusEntry`) in the active schematic. Parses bus name syntax (`NAME[start..end]`, `NAME[start:end]`, `NAME[A,B,C]`), expands signal sets, checks connectivity distances, and flags diagnostics for dangling taps, bus signal mismatches, and conflicting port directions.

**Parameters:**
- **`includePorts`** (`boolean`, _optional_, default: `true`): Whether to include net ports.
- **`includeBuses`** (`boolean`, _optional_, default: `true`): Whether to include multi-bit buses.
- **`includeBusEntries`** (`boolean`, _optional_, default: `true`): Whether to include bus entry taps.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw primitive records.
- **`target`** (`object`, _optional_): Expected active schematic target to guard against document drift.
- **`timeoutMs`** (`number`, _optional_, default: `15000`): RPC timeout in ms.

---

### `easyeda_compare_schematic_pcb`

**Scope:** Project / Cross-Domain RPC (`readOnlyHint: true`, `idempotentHint: true`, default timeout: `30000` ms)

Performs comprehensive cross-domain differential analysis between Schematic and PCB documents. Identifies unplaced schematic components, untracked PCB parts, package/footprint mismatches, pin/pad count discrepancies, unrouted nets, and overall project synchronicity score (`syncScore`, 0–100%). Generates prioritized recommendations for syncing or board generation.

**Parameters:**
- **`schematicTarget`** (`object`, _optional_): Expected schematic document target.
- **`pcbTarget`** (`object`, _optional_): Expected PCB document target.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_list_schematic_components`

**Scope:** Schematic RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Lists normalized schematic components with designator, value, name, footprint, coordinates, and key properties.

**Parameters:**
- **`query`** (`string`, _optional_): Text filter matched against designator, value, name, or footprint.
- **`limit`** (`number`, _optional_, default: `100`, max: `500`): Maximum components returned.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw primitive fields.
- **`allPages`** (`boolean`, _optional_, default: `true`): Collect across all schematic sheets.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_component_pins`

**Scope:** Schematic RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Returns all known pins for a schematic component, including pin number, pin name, coordinates, and connected net.

**Parameters:**
- **`query`** (`string`, **required**): Component designator or search text (e.g., `"U1"`, `"USB1"`).
- **`includeRaw`** (`boolean`, _optional_, default: `true`): Include raw pin metadata.
- **`allPages`** (`boolean`, _optional_, default: `true`): Search all schematic pages.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_find_component`

**Scope:** Schematic / Project RPC (`readOnlyHint: true`, default timeout: `10000` ms)

Searches the active project for components matching a designator, value, name, footprint, or property string.

**Parameters:**
- **`query`** (`string`, **required**): Search string (e.g., `"U1"`, `"TPS"`, `"0402"`).
- **`limit`** (`number`, _optional_, default: `20`, max: `100`): Maximum results returned.
- **`timeoutMs`** (`number`, _optional_, default: `10000`): RPC timeout in ms.

---

### `easyeda_find_net`

**Scope:** Schematic / PCB RPC (`readOnlyHint: true`, default timeout: `10000` ms)

Searches nets by exact or partial name and returns matching net metadata and pin connections.

**Parameters:**
- **`query`** (`string`, **required**): Net name or substring (e.g., `"GND"`, `"VBUS"`, `"SDA"`).
- **`limit`** (`number`, _optional_, default: `20`, max: `100`): Maximum nets returned.
- **`timeoutMs`** (`number`, _optional_, default: `10000`): RPC timeout in ms.

---

### `easyeda_search_library`

**Scope:** Library RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Searches the official EasyEDA component catalog and JLCPCB/LCSC device database by keyword, manufacturer part number, or LCSC part code (e.g., `C1523`, `ESP32`, `0402 10k`). Returns package details, manufacturer, stock availability, and JLCPCB Basic/Extended part status.

**Parameters:**
- **`query`** (`string`, **required**): Keyword, manufacturer part number, or LCSC part code.
- **`limit`** (`number`, _optional_, default: `20`, max: `100`): Maximum devices returned.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

## Circuit Tracing & Verification

### `easyeda_run_schematic_erc`

**Scope:** Schematic RPC (`readOnlyHint: true`, `idempotentHint: false`, default timeout: `60000` ms)

Executes the native EasyEDA Pro Electrical Rules Check (ERC) on the active schematic document via `eda.sch_Drc.check`. Reports exact rule violations, severity (`error` | `warning`), affected primitive IDs, and page numbers. When native ERC is unavailable in the connected EasyEDA version, reports capability as unavailable rather than masquerading geometric heuristics as native ERC.

**Parameters:**
- **`strict`** (`boolean`, _optional_, default: `true`): Enforce strict electrical rule checking mode.
- **`target`** (`object`, _optional_): Expected document target specification to assert against active canvas.
- **`timeoutMs`** (`number`, _optional_, default: `60000`): RPC timeout in ms.

---

### `easyeda_trace_net`

**Scope:** Schematic RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Traces a schematic net and returns every connected pin, component, wire segment, net label, and port with connection evidence.

**Parameters:**
- **`query`** (`string`, **required**): Net name to trace (e.g., `"GND"`, `"VCC_3V3"`, `"CC1"`).
- **`includeRaw`** (`boolean`, _optional_, default: `true`): Include raw primitive data.
- **`allPages`** (`boolean`, _optional_, default: `true`): Trace across all schematic pages.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_trace_component`

**Scope:** Schematic RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Traces all nets and peer pins connected to a specific schematic component, grouped by pin.

**Parameters:**
- **`query`** (`string`, **required**): Component designator or query (e.g., `"USB1"`, `"U5"`).
- **`includeRaw`** (`boolean`, _optional_, default: `true`): Include raw primitive data.
- **`allPages`** (`boolean`, _optional_, default: `true`): Trace across all schematic pages.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_find_unconnected_pins`

**Scope:** Schematic RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Identifies schematic pins that do not resolve to any confirmed net in the normalized schematic graph.

**Parameters:**
- **`includePowerPins`** (`boolean`, _optional_, default: `true`): Set to `false` to exclude power-named pins (`VCC`, `GND`, `VDD`).
- **`limit`** (`number`, _optional_, default: `100`, max: `500`): Maximum pins returned.
- **`includeRaw`** (`boolean`, _optional_, default: `true`): Include raw pin data.
- **`allPages`** (`boolean`, _optional_, default: `true`): Check all schematic pages.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_validate_schematic_area`

**Scope:** Schematic RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Runs read-only heuristic checks (`pin_without_net`, `single_pin_net`, `single_node_net`, `similar_power_net_names`, `power_net_without_detected_capacitor`) on selected components/nets or the full schematic.

**Parameters:**
- **`components`** (`string[]`, _optional_): Component designators to scope the check.
- **`nets`** (`string[]`, _optional_): Net names to scope the check.
- **`includeGlobalChecks`** (`boolean`, _optional_, default: `true`): Include schematic-wide power rail and net checks.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw primitive data.
- **`allPages`** (`boolean`, _optional_, default: `true`): Check all schematic pages.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_verify_connections`

**Scope:** Schematic RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Evaluates structured circuit assertions (`pin_connected`, `pin_on_net`, `same_node`, `path_exists`, `path_absent`, `pull_to_net`, `decoupled_to_net`) and returns `pass` | `fail` | `unknown` per check with node/net evidence.

**Parameters:**
- **`checks`** (`object[]`, **required**, `1`–`50` items): Discriminated union on `type`:
  - `pin_connected`: `{ type: "pin_connected", component, pin?, pinName?, id? }`
  - `pin_on_net`: `{ type: "pin_on_net", component, pin?, pinName?, net, id? }`
  - `same_node`: `{ type: "same_node", left: Endpoint, right: Endpoint, id? }`
  - `path_exists` / `path_absent`: `{ type, from: Endpoint, to: Endpoint, through?: PassiveConstraint, maxHops?, id? }`
  - `pull_to_net`: `{ type: "pull_to_net", signal: Endpoint, net, through: PassiveConstraint, maxHops?, id? }`
  - `decoupled_to_net`: `{ type: "decoupled_to_net", power: Endpoint, referenceNet, capacitorValue?, maxHops?, id? }`
  *(where `Endpoint` is `{ component, pin?, pinName? }` or `{ net }`, and `PassiveConstraint` is `{ kind?: "resistor" | "capacitor" | "inductor" | "diode" | "led" | "passive", component?, value? }`)*
- **`maxHops`** (`number`, _optional_, default: `4`, max: `20`): Maximum traversal hops for path checks.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw primitive data.
- **`allPages`** (`boolean`, _optional_, default: `true`): Evaluate across all schematic pages.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

**Example:**

```json
{
  "checks": [
    { "id": "usb-gnd", "type": "pin_on_net", "component": "USB1", "pinName": "GND", "net": "GND" },
    {
      "id": "cc1-pulldown",
      "type": "pull_to_net",
      "signal": { "component": "USB1", "pinName": "CC1" },
      "net": "GND",
      "through": { "kind": "resistor", "value": "5.1k" }
    },
    {
      "id": "vbus-decoupling",
      "type": "decoupled_to_net",
      "power": { "net": "VBUS" },
      "referenceNet": "GND"
    }
  ]
}
```

---

## PCB Layout & DRC Rules

::: tip Active PCB Required
PCB and DRC tools require an active **PCB** document (`documentType: 3`). See [DRC Rule Editing](./drc-rules.md) for the full two-phase preview and confirmation workflow.
:::

### `easyeda_run_drc`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `60000` ms)

Executes the native EasyEDA Pro PCB Design Rule Check (DRC) against the active board and returns detailed violations, categorized counts, evidence, document target, execution metadata, and comparison with editor-side DRC state.

**Parameters:**
- **`strict`** (`boolean`, _optional_, default: `true`): Enforce strict DRC validation rules.
- **`severity`** (`"all" | "error" | "warning"`, _optional_, default: `"all"`): Filter reported violations by severity.
- **`rule`** (`string`, _optional_): Filter violations by rule code or name (e.g. `Clearance`, `ShortCircuit`, `UnroutedNet`, `TrackWidth`, `HoleSize`, `KeepoutViolation`).
- **`limit`** (`number`, _optional_, default: `100`, max: `500`): Maximum detailed violation records returned.
- **`compareWithEditor`** (`boolean`, _optional_, default: `true`): Compare check results with editor-side live DRC error list when supported.
- **`target`** (`object`, _optional_): Asserts execution against the expected PCB document (`documentId`, `projectId`, `tabId`, etc.).
- **`timeoutMs`** (`number`, _optional_, default: `60000`): RPC timeout in ms.

**Response Structure:**
- **`executionId`** (`string`): Unique identifier for this DRC run (`drc_<timestamp>_<id>`).
- **`executedAt`** (`string`): ISO timestamp when the check was performed.
- **`status`** (`"passed" | "violations_found"`): High-level check status.
- **`passed`** (`boolean`): True if zero DRC errors were found.
- **`violationsCount`** (`number`): Total violations detected before limit truncation.
- **`errorsCount`** (`number`): Total error-level violations.
- **`warningsCount`** (`number`): Total warning-level violations.
- **`violationsReturned`** (`number`): Count of violations returned in payload after filtering and limit.
- **`violations`** (`array`): Normalized violation objects with `id`, `rule`, `category`, `message`, `severity`, `primitiveIds`, `layer`, `nets`, `coordinates`, `evidence` (`actual`, `expected`, `difference`), and `raw`.
- **`summary`** (`object`): Categorized counts:
  - `byRule`: Counts per rule name.
  - `byCategory`: Counts per category (`Clearance`, `ShortCircuit`, `Unrouted`, `Geometry`, `Hole`, `Keepout`, `Silkscreen`, `Component`).
  - `bySeverity`: `{ error: number, warning: number }`.
  - `byLayer`: Counts per PCB layer.
  - `topViolatedRules`: Sorted list of most violated rules.
- **`editorComparison`** (`object`): Comparison against editor live error panel (`editorApiQueried`, `editorErrorCount`, `checkErrorCount`, `matched`, `ruleConfigName`, `note`).
- **`target`** (`object`): Document identity of the checked board (`documentId`, `projectId`, `title`, `fingerprint`).
- **`durationMs`** (`number`): Check execution time in milliseconds.
- **`errors`** (`array`): Retained for backward compatibility with earlier integrations.

---

### `easyeda_get_pcb_layers`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `10000` ms)

Returns the layer stackup configuration of the active EasyEDA Pro PCB, including layer names, IDs, types (signal, plane, mechanical, silkscreen), visibility, and copper thickness.

**Parameters:**
- **`timeoutMs`** (`number`, _optional_, default: `10000`): RPC timeout in ms.

---

### `easyeda_get_routing_status`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Analyzes the physical routing progress of the active PCB, calculating the completion percentage, total nets, routed nets, unrouted airwires (ratsnest), and optional track lengths per net.

**Parameters:**
- **`includeNetLengths`** (`boolean`, _optional_, default: `false`): Include calculated track length for each net in millimeters.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_list_pcb_components`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Lists normalized components placed on the active PCB layout with designator, footprint, placement layer, coordinates (`x`, `y` in mm), rotation angle, lock state, and side (`top` / `bottom`). Supports optional inclusion of pad summaries and custom properties.

**Parameters:**
- **`query`** (`string`, _optional_): Filter by designator, footprint, value, or primitive ID.
- **`layer`** (`"all" | "top" | "bottom"`, _optional_, default: `"all"`): Filter components by placement side.
- **`limit`** (`number`, _optional_, default: `100`, max: `500`): Maximum components returned.
- **`includePads`** (`boolean`, _optional_, default: `false`): Include normalized pad details and pin counts for each component.
- **`includeProperties`** (`boolean`, _optional_, default: `false`): Include custom properties and component attributes.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw primitive fields.
- **`target`** (`object`, _optional_): Expected document target specification to assert against active canvas.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_pcb_pads`

**Scope:** PCB RPC (`readOnlyHint: true`, `idempotentHint: true`, default timeout: `30000` ms)

Inspects PCB pads across the board or for specific devices. Inspects pad number, assigned net, physical coordinates (`x`, `y`), layer, side (`top`, `bottom`, `multi`), shape, width, height, hole diameter, and through-hole classification. Can filter by component, net, layer, or pad number.

**Parameters:**
- **`component`** (`string`, _optional_): Filter pads by parent component designator (e.g., `"U1"`, `"C5"`) or primitive ID.
- **`net`** (`string`, _optional_): Filter pads by assigned net name (e.g., `"GND"`, `"VCC"`).
- **`layer`** (`"all" | "top" | "bottom" | "multi"`, _optional_, default: `"all"`): Filter by layer or multi-layer through-hole.
- **`padNumber`** (`string`, _optional_): Filter pads by specific pin/pad number (e.g., `"1"`, `"A1"`).
- **`includeComponentPads`** (`boolean`, _optional_, default: `true`): Include pads belonging to footprint devices.
- **`includeStandalonePads`** (`boolean`, _optional_, default: `true`): Include standalone / free canvas pads.
- **`limit`** (`number`, _optional_, default: `200`, max: `1000`): Maximum pads returned.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw primitive fields.
- **`target`** (`object`, _optional_): Expected document target specification to assert against active canvas.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_prepare_pcb_component`

**Scope:** PCB Mutation RPC (`readOnlyHint: false`, `destructiveHint: true`, default timeout: `30000` ms)

Stages a component transformation on the active PCB canvas without applying it directly. Supported actions are:
- `move`: Relocates a component using absolute `x`/`y` coordinates or relative `dx`/`dy` offsets.
- `rotate`: Rotates a component using absolute `rotation` (degrees) or relative `dRotation` offset.
- `flip`: Flips a component between top and bottom board layers, or sets an explicit `layer` (`"top"` | `"bottom"`).
- `delete`: Deletes a footprint component from the PCB layout.

Returns `mutationId`, exact confirmation token `CONFIRM pcb:<action> <mutationId>`, and structured `preview` with `impact`, `before`, `requestedAfter`, and `changedKeys`. Previews expire after 5 minutes and require execution via `easyeda_confirmed_action`.

**Parameters:**
- **`action`** (`"move" | "rotate" | "flip" | "delete"`, **required**): The transformation or removal action to stage.
- **`component`** (`string`, **required**): Target component designator (e.g., `"R1"`, `"U2"`) or primitive ID.
- **`x`** (`number`, _optional_): Absolute target X coordinate (used with `move`).
- **`y`** (`number`, _optional_): Absolute target Y coordinate (used with `move`).
- **`dx`** (`number`, _optional_): Relative X offset delta (used with `move`).
- **`dy`** (`number`, _optional_): Relative Y offset delta (used with `move`).
- **`rotation`** (`number`, _optional_): Absolute angle in degrees `[0, 360)` (used with `rotate`).
- **`dRotation`** (`number`, _optional_): Relative rotation angle delta in degrees (used with `rotate`).
- **`layer`** (`"top" | "bottom" | string`, _optional_): Target layer or side (used with `flip`).
- **`target`** (`object`, _optional_): Expected document target specification to assert against active canvas.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_board_outline`

**Scope:** PCB RPC (`readOnlyHint: true`, `idempotentHint: true`, default timeout: `30000` ms)

Inspects the physical boundary profile of the active PCB on the board outline layer. Computes geometry metrics including bounding box (`minX`, `minY`, `maxX`, `maxY`, `width`, `height`), perimeter, estimated area, loop closure status (`isClosed`), segment count, and segment vectors.

**Parameters:**
- **`includeSegments`** (`boolean`, _optional_, default: `true`): Include individual segment primitives (lines, arcs).
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw primitive payloads.
- **`target`** (`object`, _optional_): Expected document target specification to assert against active canvas.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_prepare_board_outline`

**Scope:** PCB Mutation RPC (`readOnlyHint: false`, `destructiveHint: true`, default timeout: `30000` ms)

Stages creation, rectangular/polygonal sizing, clearing, or segment modification of the board outline on the active PCB without applying changes directly. Supported actions are:
- `set_rectangle`: Defines a rectangular board outline specified by origin `x`, `y`, `width`, and `height`.
- `set_polygon`: Defines an arbitrary closed polygonal board outline from an array of `points` (`[{ x, y }]`).
- `clear`: Deletes all existing board outline primitives from the active canvas.
- `modify_segment`: Updates coordinates or line width of a specific outline segment by `primitiveId`.

Returns `mutationId`, exact confirmation token `CONFIRM pcb:<action> <mutationId>`, and structured `preview` with `impact`, `before`, `requestedAfter`, and `changedKeys`. Previews expire after 5 minutes and require execution via `easyeda_confirmed_action`.

**Parameters:**
- **`action`** (`"set_rectangle" | "create" | "set_polygon" | "clear" | "modify_segment"`, _optional_, default: `"set_rectangle"`): Board outline mutation action to perform.
- **`x`** (`number`, _optional_, default: `0`): Origin X coordinate in mm (used with `set_rectangle` / `create`).
- **`y`** (`number`, _optional_, default: `0`): Origin Y coordinate in mm (used with `set_rectangle` / `create`).
- **`width`** (`number`, _optional_): Board width in mm (used with `set_rectangle` / `create`).
- **`height`** (`number`, _optional_): Board height in mm (used with `set_rectangle` / `create`).
- **`points`** (`array`, _optional_): Array of vertex objects `[{ x: number, y: number }]` (at least 3 vertices, used with `set_polygon`).
- **`lineWidth`** (`number`, _optional_, default: `0.2`): Line width of outline tracks in mm.
- **`clearExisting`** (`boolean`, _optional_, default: `true`): Whether to clear existing outline primitives before placing the new outline.
- **`primitiveId`** (`string`, _optional_): Target segment primitive ID (used with `modify_segment`).
- **`startX`** (`number`, _optional_): New start X coordinate in mm (used with `modify_segment`).
- **`startY`** (`number`, _optional_): New start Y coordinate in mm (used with `modify_segment`).
- **`endX`** (`number`, _optional_): New end X coordinate in mm (used with `modify_segment`).
- **`endY`** (`number`, _optional_): New end Y coordinate in mm (used with `modify_segment`).
- **`target`** (`object`, _optional_): Expected document target specification to assert against active canvas.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_prepare_pcb_routing`

**Scope:** PCB Mutation RPC (`readOnlyHint: false`, `destructiveHint: true`, default timeout: `30000` ms)

Prepares native auto-routing or destructive unrouting of copper tracks and vias on the active PCB canvas. Supported actions:
- `autoroute`: Routes traces natively for specified nets or all unrouted nets, preserving or rebuilding existing routes.
- `unroute`: **Destructive operation** that clears and deletes routed tracks and vias for specified nets or across the entire board.

Returns `mutationId`, exact confirmation token `CONFIRM pcb:<action> <mutationId>`, and structured `preview` with baseline routing metrics, target scope, and expected changes. Previews expire after 5 minutes and require execution via `easyeda_confirmed_action`.

**Parameters:**
- **`action`** (`"autoroute" | "unroute"`, **required**): The routing operation to stage.
- **`nets`** (`string[]`, _optional_): Explicit list of net names to route or unroute (e.g. `["GND", "VCC"]`). If omitted, targets all nets.
- **`ignoreNets`** (`string[]`, _optional_): List of net names to exclude from autorouting.
- **`keepExistingRoutes`** (`boolean`, _optional_, default: `true`): Whether to preserve existing tracks during autorouting.
- **`target`** (`object`, _optional_): Expected document target specification to assert against active canvas.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_prepare_pcb_layout`

**Scope:** PCB Mutation RPC (`readOnlyHint: false`, `destructiveHint: true`, default timeout: `30000` ms)

Prepares native component auto-placement/auto-layout on the active PCB canvas within the board outline. Arranges components automatically based on schematic connectivity, spacing rules, and board dimensions without applying changes directly.

Returns `mutationId`, exact confirmation token `CONFIRM pcb:autolayout <mutationId>`, and structured `preview`. Previews expire after 5 minutes and require execution via `easyeda_confirmed_action`.

**Parameters:**
- **`action`** (`"autolayout"`, _optional_, default: `"autolayout"`): The layout operation to stage.
- **`components`** (`string[]`, _optional_): Explicit array of component designators to arrange (e.g. `["U1", "R1"]`). If omitted, arranges all unlocked components.
- **`target`** (`object`, _optional_): Expected document target specification to assert against active canvas.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_pcb_tracks`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Lists and inspects copper tracks and traces on the active PCB layout with net, layer, geometry coordinates (`startX`, `startY`, `endX`, `endY` in mm), line width, lock state, and calculated Euclidean length.

**Parameters:**
- **`net`** (`string`, _optional_): Filter tracks by connected electrical net name (e.g. `"GND"`, `"VCC"`).
- **`layer`** (`string | number`, _optional_): Filter tracks by placement layer name or ID (e.g. `1`, `"TopLayer"`, `2`, `"BottomLayer"`).
- **`primitiveId`** (`string`, _optional_): Query a single track by its primitive ID.
- **`limit`** (`number`, _optional_, default: `100`, max: `500`): Maximum number of tracks to return.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw underlying primitive data.
- **`target`** (`object`, _optional_): Asserts execution against the expected active PCB document.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_pcb_vias`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Lists and inspects vias on the active PCB layout with net, center coordinates (`x`, `y` in mm), outer diameter, drill hole diameter, start/end layer connection, and lock state.

**Parameters:**
- **`net`** (`string`, _optional_): Filter vias by connected electrical net name (e.g. `"GND"`, `"VCC"`).
- **`primitiveId`** (`string`, _optional_): Query a single via by its primitive ID.
- **`limit`** (`number`, _optional_, default: `100`, max: `500`): Maximum number of vias to return.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw underlying primitive data.
- **`target`** (`object`, _optional_): Asserts execution against the expected active PCB document.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_prepare_pcb_track_via`

**Scope:** PCB Mutation RPC (`readOnlyHint: false`, `destructiveHint: true`, default timeout: `30000` ms)

Stages creating, modifying, or destructively deleting copper tracks and vias on the active PCB layout with safety preview, before-state snapshot, and exact confirmation phrase. Does not modify the PCB until confirmed.

Returns `mutationId`, exact confirmation token `CONFIRM pcb:<track|via>:<create|modify|delete> <mutationId>`, and structured `preview`. Previews expire after 5 minutes and require execution via `easyeda_confirmed_action` with `action="mutation"`.

**Parameters:**
- **`entity`** (`"track" | "via"`, **required**): Entity type to mutate.
- **`action`** (`"create" | "modify" | "delete"`, **required**): Operation to stage.
- **`trackId`** (`string`, _optional_): Primitive ID of track to modify or delete.
- **`viaId`** (`string`, _optional_): Primitive ID of via to modify or delete.
- **`net`** (`string`, _optional_): Net name for created track or via (e.g. `"GND"`, `"VCC"`).
- **`layer`** (`string | number`, _optional_, default: `1`): Placement layer for created track.
- **`startX`** (`number`, _optional_): Start X coordinate in mm (for track creation).
- **`startY`** (`number`, _optional_): Start Y coordinate in mm (for track creation).
- **`endX`** (`number`, _optional_): End X coordinate in mm (for track creation).
- **`endY`** (`number`, _optional_): End Y coordinate in mm (for track creation).
- **`lineWidth`** (`number`, _optional_, default: `0.254`): Track line width in mm.
- **`x`** (`number`, _optional_): Center X coordinate in mm (for via creation).
- **`y`** (`number`, _optional_): Center Y coordinate in mm (for via creation).
- **`diameter`** (`number`, _optional_, default: `0.6`): Outer diameter in mm (for via creation).
- **`holeDiameter`** (`number`, _optional_, default: `0.3`): Drill hole diameter in mm (for via creation).
- **`properties`** (`object`, _optional_): Dictionary of properties to modify on existing track or via.
- **`target`** (`object`, _optional_): Expected document target specification to assert against active canvas.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_highlight_net`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `10000` ms)

Interactively highlights a specified net on the EasyEDA Pro PCB canvas via `eda.pcb_Net.highlightNet()`, or clears all highlights with `clear: true`.

**Parameters:**
- **`net`** (`string`, _optional_): Net name to highlight (e.g., `"GND"`, `"VCC_5V"`).
- **`clear`** (`boolean`, _optional_, default: `false`): When `true`, unhighlights all nets.
- **`timeoutMs`** (`number`, _optional_, default: `10000`): RPC timeout in ms.

---

### `easyeda_get_copper_zones`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Lists and inspects copper zones (copper pours and flood fills) on the active PCB layout with net, layer, clearance spacing, fill type (`solid`, `grid`, `none`), poured status, polygon vertices, and calculated bounding box.

**Parameters:**
- **`net`** (`string`, _optional_): Filter copper zones by connected electrical net name (e.g. `"GND"`, `"VCC"`).
- **`layer`** (`string | number`, _optional_): Filter zones by placement layer (e.g. `1`, `"TopLayer"`, `2`, `"BottomLayer"`).
- **`primitiveId`** (`string`, _optional_): Query a single copper zone by its primitive ID.
- **`limit`** (`number`, _optional_, default: `100`, max: `500`): Maximum number of copper zones to return.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw underlying primitive data.
- **`target`** (`object`, _optional_): Asserts execution against the expected active PCB document.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_keepouts`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Lists and inspects keepout areas on the active PCB layout with layer, restriction type (`all`, `track`, `via`, `copper`, etc.), polygon vertices, and calculated bounding box.

**Parameters:**
- **`layer`** (`string | number`, _optional_): Filter keepouts by layer (e.g. `1`, `2`, or `"AllLayers"`).
- **`primitiveId`** (`string`, _optional_): Query a single keepout area by its primitive ID.
- **`limit`** (`number`, _optional_, default: `100`, max: `500`): Maximum number of keepouts to return.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw underlying primitive data.
- **`target`** (`object`, _optional_): Asserts execution against the expected active PCB document.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_prepare_copper_keepout`

**Scope:** PCB Mutation RPC (`readOnlyHint: false`, `destructiveHint: true`, default timeout: `30000` ms)

Stages creating, modifying, deleting, or recalculating/rebuilding copper zones and keepouts on the active PCB layout with safety preview, before-state snapshot, and exact confirmation phrase. Does not modify the PCB until confirmed.

Supports:
- **`create`**: Adds copper zones or keepout regions using either explicit polygon `points` array or bounding rectangle shortcut (`x`, `y`, `width`, `height`).
- **`modify`**: Modifies net, layer, clearance, fillType, or boundary points of existing zones/keepouts.
- **`delete`**: Removes copper zones or keepouts with readback verification.
- **`rebuild`**: Triggers full copper pour recalculation across all zones or a specific copper zone.

Returns `mutationId`, exact confirmation token `CONFIRM pcb:<action> <mutationId>`, and structured `preview`. Previews expire after 5 minutes and require execution via `easyeda_confirmed_action` with `action="mutation"`.

**Parameters:**
- **`entity`** (`"copperZone" | "keepout"`, **required**): Entity type to mutate.
- **`action`** (`"create" | "modify" | "delete" | "rebuild"`, **required**): Operation to stage.
- **`zoneId`** (`string`, _optional_): Primitive ID of copper zone to modify, delete, or rebuild.
- **`keepoutId`** (`string`, _optional_): Primitive ID of keepout to modify or delete.
- **`net`** (`string`, _optional_): Net name for copper zone creation (e.g. `"GND"`, `"VCC"`).
- **`layer`** (`string | number`, _optional_, default: `1`): Placement layer (e.g. `1`, `"TopLayer"`, or `"AllLayers"` for keepouts).
- **`points`** (`array`, _optional_): Array of boundary vertex coordinates (`[{ x, y }]` in mm). Minimum 3 vertices.
- **`x`** (`number`, _optional_): Shortcut start X coordinate in mm for rectangular area.
- **`y`** (`number`, _optional_): Shortcut start Y coordinate in mm for rectangular area.
- **`width`** (`number`, _optional_): Shortcut width in mm for rectangular area.
- **`height`** (`number`, _optional_): Shortcut height in mm for rectangular area.
- **`clearance`** (`number`, _optional_): Clearance spacing / isolation rule in mm (for copper zones).
- **`fillType`** (`string`, _optional_, default: `"solid"`): Fill style for copper zones (`"solid"`, `"grid"`, or `"none"`).
- **`keepoutType`** (`string`, _optional_, default: `"all"`): Keepout restriction type (`"all"`, `"track"`, `"via"`, `"copper"`).
- **`properties`** (`object`, _optional_): Dictionary of properties to modify on existing copper zone or keepout.
- **`target`** (`object`, _optional_): Expected document target specification to assert against active canvas.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_pcb_airwires`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Inspects unrouted ratsnest airwire lines on the active PCB layout with endpoints, coordinates, Euclidean and Manhattan lengths, and transparent method/tolerance metadata.

Supports native EasyEDA Pro ratsnest line primitives with seamless fallback to topological Minimum Spanning Tree (MST) based on pad center Euclidean distances.

**Parameters:**
- **`net`** (`string`, _optional_): Filter airwires by connected electrical net name (e.g. `"GND"`, `"VCC"`).
- **`limit`** (`number`, _optional_, default: `200`, max: `500`): Maximum number of airwire lines to return.
- **`padSnapTolerance`** (`number`, _optional_, default: `0.1`): Snap distance tolerance in mm.
- **`target`** (`object`, _optional_): Asserts execution against the expected active PCB document.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_pcb_placement_report`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Generates a comprehensive component placement report including density, component bounding boxes, layer distribution, and collision/clearance warnings.

Identifies unplaced components (missing coordinates or positioned outside board outline boundaries), calculates board packing density percentage, and performs pairwise bounding box intersection checks.

**Parameters:**
- **`collisionTolerance`** (`number`, _optional_, default: `0.2`): Clearance margin in mm below which tight spacing or potential collision warnings are flagged.
- **`boardMarginTolerance`** (`number`, _optional_, default: `1.0`): Margin in mm beyond board outline before considering a component placed outside boundaries.
- **`target`** (`object`, _optional_): Asserts execution against the expected active PCB document.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_pcb_net_report`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Generates detailed physical metrics for nets across the active PCB (pad counts, track segment counts, routed track length in mm, via count, copper flood zone coverage, and routing completion percentage).

Categorizes nets automatically into power, ground, and signal rails, and reports overall board-wide routing completion statistics.

**Parameters:**
- **`net`** (`string`, _optional_): Filter by specific net name.
- **`category`** (`"all" | "power" | "ground" | "signal"`, _optional_): Filter nets by electrical category.
- **`status`** (`"all" | "routed" | "partially_routed" | "unrouted"`, _optional_): Filter nets by physical routing status.
- **`limit`** (`number`, _optional_, default: `200`, max: `500`): Maximum number of net records to return.
- **`target`** (`object`, _optional_): Asserts execution against the expected active PCB document.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_pcb_net_classes`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Lists net classes and their member net assignments along with routing constraints (trace width, clearance, via outer diameter, and via drill hole diameter).

Queries native `eda.pcb_NetClass` with seamless fallback to DRC net rules (`eda.pcb_Drc.getNetRules`).

**Parameters:**
- **`name`** (`string`, _optional_): Query a single net class by name.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw underlying primitive data.
- **`target`** (`object`, _optional_): Asserts execution against the expected active PCB document.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_pcb_differential_pairs`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Lists differential pairs with positive and negative net assignments, target impedance, trace width, gap, actual routed track lengths, and skew tolerance compliance.

Queries native `eda.pcb_DifferentialPair` with automatic fallback to heuristic net pair discovery (`_P`/`_N`, `_DP`/`_DM`, `_POS`/`_NEG`, `+`/`-`) based on actual board tracks.

**Parameters:**
- **`name`** (`string`, _optional_): Filter by specific differential pair name.
- **`toleranceMm`** (`number`, _optional_, default: `0.15`): Length matching skew tolerance in mm.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw underlying primitive data.
- **`target`** (`object`, _optional_): Asserts execution against the expected active PCB document.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_pcb_length_groups`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Lists equal length matching groups with member net lengths, reference length, max skew, and tolerance compliance.

Queries native `eda.pcb_LengthGroup` / `eda.pcb_EqualLengthGroup` and measures physical track lengths for all member nets.

**Parameters:**
- **`name`** (`string`, _optional_): Filter by specific length group name.
- **`toleranceMm`** (`number`, _optional_, default: `0.5`): Length matching skew tolerance in mm.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw underlying primitive data.
- **`target`** (`object`, _optional_): Asserts execution against the expected active PCB document.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_prepare_pcb_net_constraint`

**Scope:** PCB Mutation RPC (`readOnlyHint: false`, `destructiveHint: true`, default timeout: `30000` ms)

Stages creating, modifying, or deleting net classes, differential pairs, or equal length groups on the active PCB layout with safety preview, API capability check, and exact confirmation phrase. Does not modify the PCB until confirmed.

Guarantees API-conditioned safety: execution verifies the presence of native APIs (`pcb_NetClass`, `pcb_DifferentialPair`, `pcb_LengthGroup`) before proceeding, preventing false success assertions when native features are not exposed.

Returns `mutationId`, exact confirmation token `CONFIRM pcb:<action> <mutationId>`, and structured `preview`. Previews expire after 5 minutes and require execution via `easyeda_confirmed_action` with `action="mutation"`.

**Parameters:**
- **`entity`** (`"netClass" | "differentialPair" | "lengthGroup"`, **required**): Entity type to mutate.
- **`action`** (`"create" | "modify" | "delete"`, **required**): Operation to stage.
- **`name`** (`string`, **required**): Name of the net class, differential pair, or length group.
- **`nets`** (`array`, _optional_): Member net names (for `netClass` or `lengthGroup`).
- **`positiveNet`** (`string`, _optional_): Positive net name (for `differentialPair`).
- **`negativeNet`** (`string`, _optional_): Negative net name (for `differentialPair`).
- **`targetImpedance`** (`number`, _optional_): Target differential impedance in Ohms (e.g. `90`, `100`).
- **`traceWidth`** (`number`, _optional_): Trace width in mm.
- **`differentialGap`** (`number`, _optional_): Differential pair spacing/gap in mm.
- **`clearance`** (`number`, _optional_): Isolation clearance spacing in mm (for `netClass`).
- **`viaDiameter`** (`number`, _optional_): Via outer diameter in mm (for `netClass`).
- **`viaHoleDiameter`** (`number`, _optional_): Via drill hole diameter in mm (for `netClass`).
- **`toleranceMm`** (`number`, _optional_): Skew matching tolerance in mm.
- **`targetLengthMm`** (`number`, _optional_): Target length in mm for length group.
- **`properties`** (`object`, _optional_): Dictionary of properties to modify on existing constraint.
- **`target`** (`object`, _optional_): Expected document target specification to assert against active canvas.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_pcb_3d_inspection`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Inspects 3D component models, computes the complete vertical board envelope (substrate thickness, max component height on Top layer, max component depth on Bottom layer, and total required enclosure height), identifies missing STEP/OBJ 3D models with mechanical criticality ranking (`HIGH`, `MEDIUM`, `LOW`), checks component height violations against `maxHeightMm`, and performs 3D spatial collision / interference checking between components.

**Parameters:**
- **`maxHeightMm`** (`number`, _optional_): Maximum allowed component vertical height in mm. Flags any component exceeding this value.
- **`enclosureHeightMm`** (`number`, _optional_): Available internal enclosure clearance in mm to evaluate `FIT`, `TIGHT`, or `EXCEEDED` status.
- **`checkInterference`** (`boolean`, _optional_, default: `true`): Whether to check pairwise 3D bounding box spatial collisions between components.
- **`target`** (`object`, _optional_): Expected document target specification.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_pcb_3d_view`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Retrieves 3D camera angles and orientation metadata (`pitch`, `yaw`, `roll`, `distanceMm`), rendering layer visibility status, STEP/OBJ 3D export support, and editor shortcut guidance (`Alt+3`) to access the native 3D WebGL viewport in EasyEDA Pro.

**Parameters:**
- **`viewAngle`** (`"top" | "bottom" | "isometric_ne" | "isometric_sw" | "front" | "side"`, _optional_, default: `"isometric_ne"`): Camera orientation preset.
- **`target`** (`object`, _optional_): Expected document target specification.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_prepare_pcb_external_import`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Validates and stages external layout or routing geometries into a safe 2-phase mutation without modifying the active PCB until explicitly confirmed. Supports Specctra SES routing sessions (FreeRouting / Cadence), EasyEDA router JSON, EasyEDA layout JSON, and AutoCAD DXF 2D outlines and lines. Generates a strict confirmation token (`CONFIRM pcb:import_external <mutationId>`), geometry impact summary, and rollback information.

**Parameters:**
- **`format`** (`"specctra_ses" | "easyeda_router_json" | "easyeda_layout_json" | "dxf"`, **required**): External format to parse and import.
- **`content`** (`string`, _optional_): Inline file or text content.
- **`filePath`** (`string`, _optional_): Local filesystem path to the external file.
- **`targetLayer`** (`number | string`, _optional_): Target layer ID or name (e.g., `10` or `"Border"` for DXF outlines).
- **`defaultNet`** (`string`, _optional_): Default net name for unassigned routes.
- **`layerMapping`** (`object`, _optional_): Dictionary mapping external layer identifiers to EasyEDA layer IDs.
- **`netMapping`** (`object`, _optional_): Dictionary mapping external net names to project net names.
- **`dryRunOnly`** (`boolean`, _optional_, default: `false`): When `true`, validates syntax and returns parsed geometry preview without staging a mutation.
- **`target`** (`object`, _optional_): Expected document target specification.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_drc_rules`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `10000` ms)

Reads native PCB design rules from `eda.pcb_Drc` along with active PCB target identity (`projectId`, `documentId`, `tabId`) and per-method capabilities.

**Parameters:**
- **`scope`** (`"current" | "configurations" | "netRules" | "netByNetRules" | "regionRules"`, _optional_, default: `"current"`): Rule table or configuration scope to read.
- **`timeoutMs`** (`number`, _optional_, default: `10000`): RPC timeout in ms.

---

### `easyeda_prepare_drc_edit`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `10000` ms)

Stages a typed DRC rule operation in extension memory without modifying the PCB. Returns `editId` (UUID), `confirmation` (`CONFIRM editDrcRules <editId>`), `target`, and `preview` (`before`, `requestedAfter`, `changedKeys`, `scope`, `impact`). Previews expire after 15 minutes.

**Parameters:**
- **`operation`** (`object`, **required**): Discriminated union on `type`:
  - `{ type: "createConfiguration", configurationName: string, config: object }`
  - `{ type: "updateCurrentConfiguration", config: object }`
  - `{ type: "replaceNetRules", rules: object[] }`
  - `{ type: "replaceNetByNetRules", rules: object }`
  - `{ type: "replaceRegionRules", rules: object[] }`
- **`timeoutMs`** (`number`, _optional_, default: `10000`): RPC timeout in ms.

---

### `easyeda_get_drc_edit_result`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `10000` ms)

Queries the in-memory status (`prepared` | `running` | `applied` | `failed` | `unknown` | `invalidated` | `expired`) of a prepared DRC edit. Use this after a timeout or disconnection instead of re-sending the edit.

**Parameters:**
- **`editId`** (`string`, **required**, UUID): The `editId` returned by `easyeda_prepare_drc_edit`.
- **`timeoutMs`** (`number`, _optional_, default: `10000`): RPC timeout in ms.

---

## Navigation & Exports

### `easyeda_navigate_component`

**Scope:** Editor RPC (`readOnlyHint: true`, default timeout: `10000` ms)

Focuses and highlights a component in the active EasyEDA Pro schematic or PCB view.

**Parameters:**
- **`query`** (`string`, **required**): Component designator or search query (e.g., `"USB1"`).
- **`timeoutMs`** (`number`, _optional_, default: `10000`): RPC timeout in ms.

---

### `easyeda_navigate_region`

**Scope:** Editor RPC (`readOnlyHint: true`, default timeout: `10000` ms)

Pans or zooms the active EasyEDA Pro editor to a point (`x`, `y`) or bounding box (`left`, `top`, `right`, `bottom`).

**Parameters:**
- **`x`**, **`y`**, **`left`**, **`top`**, **`right`**, **`bottom`** (`number`, _optional_): Target coordinates in editor units.
- **`timeoutMs`** (`number`, _optional_, default: `10000`): RPC timeout in ms.

---

### `easyeda_zoom_board`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `10000` ms)

Zooms the active PCB editor to fit the board outline.

**Parameters:**
- **`timeoutMs`** (`number`, _optional_, default: `10000`): RPC timeout in ms.

---

### `easyeda_export_cpl`

**Scope:** PCB Manufacture RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Exports the component Pick and Place (CPL / Centroid) coordinate file from the active PCB for automated SMT assembly (standard JLCPCB format).

**Parameters:**
- **`fileName`** (`string`, _optional_): Custom output filename without extension.
- **`format`** (`"csv" | "xlsx" | "txt"`, _optional_, default: `"csv"`): File format for the pick and place report.
- **`unit`** (`"mm" | "mil"`, _optional_, default: `"mm"`): Coordinate unit for component positions.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_export_bom`

**Scope:** Manufacture RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Exports a Bill of Materials (BOM) from the active project.

**Parameters:**
- **`format`** (`"csv" | "xlsx" | "json"`, _optional_, default: `"csv"`): Output BOM format.
- **`scope`** (`"pcb" | "schematic" | "auto"`, _optional_, default: `"auto"`): Source document scope.
- **`fileName`** (`string`, _optional_): Custom output filename.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_export_netlist`

**Scope:** Manufacture RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Exports a netlist from the active schematic or PCB.

**Parameters:**
- **`scope`** (`"pcb" | "schematic" | "auto"`, _optional_, default: `"auto"`): Source document scope.
- **`fileName`** (`string`, _optional_): Custom output filename.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_export_gerber`

**Scope:** PCB Manufacture RPC (`readOnlyHint: true`, default timeout: `60000` ms)

Exports Gerber fabrication files from the active PCB.

**Parameters:**
- **`fileName`** (`string`, _optional_): Custom output archive filename.
- **`timeoutMs`** (`number`, _optional_, default: `60000`): RPC timeout in ms.

---

### `easyeda_export_pdf`

**Scope:** Manufacture RPC (`readOnlyHint: true`, default timeout: `60000` ms)

Exports a PDF of the active schematic or PCB document.

**Parameters:**
- **`scope`** (`"pcb" | "schematic" | "auto"`, _optional_, default: `"auto"`): Source document scope.
- **`fileName`** (`string`, _optional_): Custom output filename.
- **`timeoutMs`** (`number`, _optional_, default: `60000`): RPC timeout in ms.

---

### `easyeda_export_image`

**Scope:** Visual Export RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Exports a high-resolution visual rendering or vector graphic (PNG, SVG, JPG) of the active schematic sheet or PCB layer stack with transparent background, resolution scaling (DPI), theme selection, and layer visibility options.

**Parameters:**
- **`fileName`** (`string`, _optional_): Custom output filename without extension.
- **`format`** (`"png" | "svg" | "jpg"`, _optional_, default: `"png"`): Image export format.
- **`scope`** (`"pcb" | "schematic" | "auto"`, _optional_, default: `"auto"`): Source document scope.
- **`theme`** (`"light" | "dark" | "default"`, _optional_, default: `"default"`): Visual color theme for rendering.
- **`transparentBackground`** (`boolean`, _optional_, default: `false`): Render with transparent canvas background.
- **`dpi`** (`integer`, _optional_, default: `300`): Raster resolution in dots per inch (max 1200).
- **`layers`** (`string[]`, _optional_): Specific PCB layers to include (e.g., `["TopLayer", "TopSilkLayer"]`).
- **`destinationPath`** (`string`, _optional_): Target destination directory or output file path.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_export_3d_model`

**Scope:** PCB 3D CAD RPC (`readOnlyHint: true`, default timeout: `60000` ms)

Exports 3D mechanical CAD geometry (STEP, OBJ, STL, WRL) of the board and mounted component bodies for MCAD integration, 3D printing, and thermal/clearance analysis.

**Parameters:**
- **`fileName`** (`string`, _optional_): Custom output filename without extension.
- **`format`** (`"step" | "obj" | "stl" | "wrl"`, _optional_, default: `"step"`): 3D CAD geometry format.
- **`includeComponents3D`** (`boolean`, _optional_, default: `true`): Include 3D component body models.
- **`includeCopper`** (`boolean`, _optional_, default: `true`): Include copper layers in 3D geometry.
- **`includeSilkscreen`** (`boolean`, _optional_, default: `true`): Include silkscreen legends in 3D geometry.
- **`quality`** (`"low" | "medium" | "high"`, _optional_, default: `"high"`): Mesh tessellation and model quality.
- **`destinationPath`** (`string`, _optional_): Target destination directory or output file path.
- **`timeoutMs`** (`number`, _optional_, default: `60000`): RPC timeout in ms.

---

### `easyeda_export_project_archive`

**Scope:** Project Package RPC (`readOnlyHint: true`, default timeout: `60000` ms)

Exports the entire EasyEDA Pro project archive (`.epro`, `.zip`, `.json`) containing all schematic sheets, PCB layout, layer configurations, netlists, and project metadata with integrity validation and document tree manifest inspection.

**Parameters:**
- **`fileName`** (`string`, _optional_): Custom output filename without extension.
- **`format`** (`"epro" | "zip" | "json"`, _optional_, default: `"epro"`): Archive bundle format.
- **`includeLibraries`** (`boolean`, _optional_, default: `true`): Bundle custom library symbols and footprints.
- **`includeHistory`** (`boolean`, _optional_, default: `false`): Include revision and change history.
- **`destinationPath`** (`string`, _optional_): Target destination directory or output file path.
- **`timeoutMs`** (`number`, _optional_, default: `60000`): RPC timeout in ms.

---

### `easyeda_export_dxf`

**Scope:** 2D CAD Manufacture RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Exports 2D CAD DXF drawings of PCB outlines, copper traces, drilling holes, or schematic drawings for mechanical enclosures, CNC routing, laser cutting, and AutoCAD integration.

**Parameters:**
- **`fileName`** (`string`, _optional_): Custom output filename without extension.
- **`scope`** (`"pcb" | "schematic" | "auto"`, _optional_, default: `"pcb"`): Export scope (PCB or schematic).
- **`layers`** (`string[]`, _optional_): Specific layers to include in DXF drawing.
- **`unit`** (`"mm" | "mil" | "inch"`, _optional_, default: `"mm"`): CAD drawing measurement unit.
- **`dxfVersion`** (`"R12" | "R14" | "2000" | "2004" | "2007" | "2018"`, _optional_, default: `"2004"`): AutoCAD DXF format version.
- **`destinationPath`** (`string`, _optional_): Target destination directory or output file path.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_get_device_details`

**Scope:** Library & Component RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Fetches the complete device definition, schematic symbol pinout, PCB footprint pad geometry, and pin-to-pad correspondence mapping by device UUID, LCSC part code (e.g., `"C1523"`), or placed component designator (e.g., `"U1"`). Evaluates mapping integrity and detects unmapped pins or extra footprint pads.

**Parameters:**
- **`deviceUuid`** (`string`, _optional_): Library device UUID.
- **`designator`** (`string`, _optional_): Placed component designator in active schematic/PCB (e.g., `"U1"`).
- **`lcscCode`** (`string`, _optional_): LCSC component part code (e.g., `"C1523"`).
- **`includePinPadMap`** (`boolean`, _optional_, default: `true`): Whether to include the detailed pin-to-pad mapping table.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw underlying primitive data.
- **`target`** (`object`, _optional_): Expected document target specification.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_compare_devices`

**Scope:** Library & Component RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Compares two component devices (by UUID, LCSC code, or designator) evaluating pinout matching, footprint geometry, JLCPCB stock availability, and drop-in replacement feasibility. Normalizes power/ground/reset pin aliases and flags electrical type or naming conflicts.

**Parameters:**
- **`deviceA`** (`string`, **required**): First device UUID, LCSC part number (e.g., `"C1523"`), or component designator (e.g., `"U1"`).
- **`deviceB`** (`string`, **required**): Second device UUID, LCSC part number (e.g., `"C2040"`), or component designator (e.g., `"U2"`).
- **`strictPinout`** (`boolean`, _optional_, default: `true`): Strictly compare pin electrical types in addition to pin names.
- **`target`** (`object`, _optional_): Expected document target specification.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_verify_pin_pad_mapping`

**Scope:** Library & Component RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Validates 1-to-1 correspondence between schematic symbol pins and PCB footprint pads across all components on the active canvas or for a specific component. Identifies unmapped pins, unmapped pads, and potential netlist connectivity breaks.

**Parameters:**
- **`designator`** (`string`, _optional_): Optional component designator to inspect (e.g., `"U1"`). If omitted, verifies all components on active canvas.
- **`deviceUuid`** (`string`, _optional_): Optional library device UUID to verify.
- **`target`** (`object`, _optional_): Expected document target specification.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

## SPICE Simulation Feasibility

### `easyeda_evaluate_spice_support`

**Scope:** Schematic Analysis RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Performs a feasibility study of analog circuit SPICE simulation on the active schematic. Inspects placed components, verifies Node 0 / Ground datum connectivity, checks for power/stimulus sources, audits SPICE model availability, calculates a simulation readiness score (`0`–`100%`), and documents platform constraints and limitations.

**Parameters:**
- **`groundNet`** (`string`, _optional_, default: `"GND"`): Net name expected as ground datum (mapped to SPICE node 0).
- **`target`** (`object`, _optional_): Expected document target specification.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

### `easyeda_generate_spice_netlist`

**Scope:** Netlist Export RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Generates a syntactically valid SPICE circuit netlist (`.cir` / `.sp`) from the active schematic with ground-to-0 normalization, primitive RLC elements, built-in semiconductor models, and configurable simulation directives (`.op`, `.tran`, `.ac`, `.dc`) for execution in external engines (ngspice, LTspice, Xyce).

**Parameters:**
- **`analysisType`** (`"op" | "tran" | "ac" | "dc"`, _optional_, default: `"op"`): Simulation analysis type directive.
- **`analysisParams`** (`string`, _optional_): Directive parameters (e.g., `"1u 10m"` for `.tran`, or `"10 1 1Meg"` for `.ac`).
- **`groundNet`** (`string`, _optional_, default: `"GND"`): Net name to map to SPICE datum node 0.
- **`includeSubcircuits`** (`boolean`, _optional_, default: `true`): Whether to include X subcircuit cards for ICs.
- **`includeDefaultModels`** (`boolean`, _optional_, default: `true`): Include built-in generic diode and BJT `.model` definitions.
- **`fileName`** (`string`, _optional_): Optional output file name without extension.
- **`destinationPath`** (`string`, _optional_): Optional destination directory or output file path.
- **`target`** (`object`, _optional_): Expected document target specification.
- **`timeoutMs`** (`number`, _optional_, default: `30000`): RPC timeout in ms.

---

## Confirmation-Gated Actions

### `easyeda_confirmed_action`

**Scope:** Mutating Editor RPC (`readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, default timeout: `60000` ms)

Executes a mutating EasyEDA Pro action only after human confirmation is verified.

**Parameters:**
- **`action`** (`"save" | "importChanges" | "autoroute" | "autolayout" | "nativeAutoRoute" | "nativeAutoLayout" | "unroute" | "importAutoRouteFile" | "importAutoLayoutFile" | "editDrcRules" | "mutation"`, **required**): Target mutation to execute.
  - Native operations: `autoroute` (when without file) or `nativeAutoRoute`, `autolayout` (when without file) or `nativeAutoLayout`, and `unroute` (destructive track/via clearing).
  - External file imports: `importAutoRouteFile` or `autoroute` with `params.file`, `importAutoLayoutFile` or `autolayout` with `params.file`.
  - Mutation lifecycle: `mutation` (applies staged mutations with `params: { mutationId }`).
- **`confirmation`** (`string`, **required**):
  - For **`editDrcRules`**: exact string `CONFIRM editDrcRules <editId>` matching the prepared UUID.
  - For **`mutation`**: exact token `CONFIRM <domain>:<action> <mutationId>`.
  - For **`save`**, **`importChanges`**, **`autoroute`**, **`autolayout`**, **`unroute`**: explicit phrase containing `I confirm`, `confirmed`, `confirma`, or `confirmo`.
- **`params`** (`object`, _optional_): Required for `editDrcRules` (`{ "editId": "<UUID>" }`) and `mutation` (`{ "mutationId": "<UUID>" }`).
- **`timeoutMs`** (`number`, _optional_, default: `60000`): RPC timeout in ms.

For staged mutations (`action: "mutation"`), the extension also tracks a 45-second execution deadline,
independent of the RPC timeout. A deadline returns `status: "unknown"`, not proof of cancellation.
Query `easyeda_get_mutation_result` with the same mutation ID; never replay an uncertain write.
The result includes `phase`, execution timestamps, and `execution` diagnostics (`timeoutMs`,
`elapsedMs`, `lockHeld`, and recovery guidance). Busy errors include the active mutation record.

The original operation remains observed after the deadline. Late completion runs readback and
updates the retained result; late rejection preserves uncertainty and releases the lock. A completed write whose readback fails validation or serialization remains `unknown`, with the
original error and mutation ID available for inspection; it is not evidence that the write failed.
Wire rename readback stores explicit plain state fields and verifies the returned net name.
A pending
executor retains its lock because the native SDK write cannot be cancelled by a JavaScript timeout.
If it never settles, reload the extension and inspect the document before preparing another write.
A stalled read-only lifecycle readback releases its lock at the deadline; its eventual completion
cannot unlock another mutation. Executors that perform their own writes and readback internally
are conservatively treated as pending writes until the entire executor settles.


::: code-group

```json [Apply Prepared DRC Edit]
{
  "action": "editDrcRules",
  "params": { "editId": "bd549553-e96d-4c9b-bb1f-f8e8ac28cf89" },
  "confirmation": "CONFIRM editDrcRules bd549553-e96d-4c9b-bb1f-f8e8ac28cf89"
}
```

```json [Save Active Document]
{
  "action": "save",
  "confirmation": "I confirm saving the document"
}
```

:::
