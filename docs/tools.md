# Tools Reference

EasyEDA Pro MCP exposes **46 tools** across 8 categories. All inspection, tracing, navigation, and export tools are read-only (`readOnlyHint: true`).

## Tool Catalog

- **[Status & Context](#status-context)** (4 tools)
  - [`easyeda_doctor`](#easyeda_doctor) · [`easyeda_live_status`](#easyeda_live_status) · [`easyeda_get_context`](#easyeda_get_context) · [`easyeda_get_selection`](#easyeda_get_selection)
- **[Document Management & Canvas View](#document-management-canvas-view)** (3 tools)
  - [`easyeda_list_documents`](#easyeda_list_documents) · [`easyeda_open_document`](#easyeda_open_document) · [`easyeda_render_document_view`](#easyeda_render_document_view)
- **[Schematic Mutations & Lifecycle](#schematic-mutations-lifecycle)** (3 tools)
  - [`easyeda_prepare_schematic_component`](#easyeda_prepare_schematic_component) · [`easyeda_prepare_schematic_wire`](#easyeda_prepare_schematic_wire) · [`easyeda_get_mutation_result`](#easyeda_get_mutation_result)
- **[Search & Schematic Inspection](#search-schematic-inspection)** (7 tools)
  - [`easyeda_schematic_snapshot`](#easyeda_schematic_snapshot) · [`easyeda_get_schematic_nets`](#easyeda_get_schematic_nets) · [`easyeda_list_schematic_components`](#easyeda_list_schematic_components) · [`easyeda_get_component_pins`](#easyeda_get_component_pins) · [`easyeda_find_component`](#easyeda_find_component) · [`easyeda_find_net`](#easyeda_find_net) · [`easyeda_search_library`](#easyeda_search_library)
- **[Circuit Tracing & Verification](#circuit-tracing-verification)** (6 tools)
  - [`easyeda_run_schematic_erc`](#easyeda_run_schematic_erc) · [`easyeda_trace_net`](#easyeda_trace_net) · [`easyeda_trace_component`](#easyeda_trace_component) · [`easyeda_find_unconnected_pins`](#easyeda_find_unconnected_pins) · [`easyeda_validate_schematic_area`](#easyeda_validate_schematic_area) · [`easyeda_verify_connections`](#easyeda_verify_connections)
- **[PCB Layout & DRC Rules](#pcb-layout-drc-rules)** (14 tools)
  - [`easyeda_run_drc`](#easyeda_run_drc) · [`easyeda_get_pcb_layers`](#easyeda_get_pcb_layers) · [`easyeda_get_routing_status`](#easyeda_get_routing_status) · [`easyeda_list_pcb_components`](#easyeda_list_pcb_components) · [`easyeda_get_pcb_pads`](#easyeda_get_pcb_pads) · [`easyeda_prepare_pcb_component`](#easyeda_prepare_pcb_component) · [`easyeda_get_board_outline`](#easyeda_get_board_outline) · [`easyeda_prepare_board_outline`](#easyeda_prepare_board_outline) · [`easyeda_prepare_pcb_routing`](#easyeda_prepare_pcb_routing) · [`easyeda_prepare_pcb_layout`](#easyeda_prepare_pcb_layout) · [`easyeda_highlight_net`](#easyeda_highlight_net) · [`easyeda_get_drc_rules`](#easyeda_get_drc_rules) · [`easyeda_prepare_drc_edit`](#easyeda_prepare_drc_edit) · [`easyeda_get_drc_edit_result`](#easyeda_get_drc_edit_result)
- **[Navigation & Exports](#navigation-exports)** (8 tools)
  - [`easyeda_export_cpl`](#easyeda_export_cpl) · [`easyeda_export_bom`](#easyeda_export_bom) · [`easyeda_export_netlist`](#easyeda_export_netlist) · [`easyeda_export_gerber`](#easyeda_export_gerber) · [`easyeda_export_pdf`](#easyeda_export_pdf) · [`easyeda_navigate_component`](#easyeda_navigate_component) · [`easyeda_navigate_region`](#easyeda_navigate_region) · [`easyeda_zoom_board`](#easyeda_zoom_board)
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

### `easyeda_highlight_net`

**Scope:** PCB RPC (`readOnlyHint: true`, default timeout: `10000` ms)

Interactively highlights a specified net on the EasyEDA Pro PCB canvas via `eda.pcb_Net.highlightNet()`, or clears all highlights with `clear: true`.

**Parameters:**
- **`net`** (`string`, _optional_): Net name to highlight (e.g., `"GND"`, `"VCC_5V"`).
- **`clear`** (`boolean`, _optional_, default: `false`): When `true`, unhighlights all nets.
- **`timeoutMs`** (`number`, _optional_, default: `10000`): RPC timeout in ms.

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
