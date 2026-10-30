# Tools Reference

EasyEDA Pro MCP exposes **32 tools** across 6 categories. All inspection, tracing, navigation, and export tools are read-only (`readOnlyHint: true`).

## Tool Catalog

- **[Status & Context](#status-context)** (4 tools)
  - [`easyeda_doctor`](#easyeda_doctor) · [`easyeda_live_status`](#easyeda_live_status) · [`easyeda_get_context`](#easyeda_get_context) · [`easyeda_get_selection`](#easyeda_get_selection)
- **[Search & Schematic Inspection](#search-schematic-inspection)** (6 tools)
  - [`easyeda_schematic_snapshot`](#easyeda_schematic_snapshot) · [`easyeda_list_schematic_components`](#easyeda_list_schematic_components) · [`easyeda_get_component_pins`](#easyeda_get_component_pins) · [`easyeda_find_component`](#easyeda_find_component) · [`easyeda_find_net`](#easyeda_find_net) · [`easyeda_search_library`](#easyeda_search_library)
- **[Circuit Tracing & Verification](#circuit-tracing-verification)** (5 tools)
  - [`easyeda_trace_net`](#easyeda_trace_net) · [`easyeda_trace_component`](#easyeda_trace_component) · [`easyeda_find_unconnected_pins`](#easyeda_find_unconnected_pins) · [`easyeda_validate_schematic_area`](#easyeda_validate_schematic_area) · [`easyeda_verify_connections`](#easyeda_verify_connections)
- **[PCB Layout & DRC Rules](#pcb-layout-drc-rules)** (8 tools)
  - [`easyeda_run_drc`](#easyeda_run_drc) · [`easyeda_get_pcb_layers`](#easyeda_get_pcb_layers) · [`easyeda_get_routing_status`](#easyeda_get_routing_status) · [`easyeda_list_pcb_components`](#easyeda_list_pcb_components) · [`easyeda_highlight_net`](#easyeda_highlight_net) · [`easyeda_get_drc_rules`](#easyeda_get_drc_rules) · [`easyeda_prepare_drc_edit`](#easyeda_prepare_drc_edit) · [`easyeda_get_drc_edit_result`](#easyeda_get_drc_edit_result)
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

## Search & Schematic Inspection

### `easyeda_schematic_snapshot`

**Scope:** Schematic RPC (`readOnlyHint: true`, default timeout: `30000` ms)

Builds a normalized snapshot of the active schematic: components, pins, wires, labels, nets, counts, `warnings`, and `confidence` (`high` | `partial` | `low`).

**Parameters:**
- **`includeRaw`** (`boolean`, _optional_, default: `true`): Include compact raw EasyEDA API payloads for fallback reasoning.
- **`allPages`** (`boolean`, _optional_, default: `true`): Collect across all schematic pages when exposed by EasyEDA Pro.
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

Executes the native EasyEDA Pro PCB Design Rule Check (DRC) against the active board and returns passed status, error counts, warning counts, and detected design violations.

**Parameters:**
- **`strict`** (`boolean`, _optional_, default: `true`): Enforce strict DRC validation rules.
- **`timeoutMs`** (`number`, _optional_, default: `60000`): RPC timeout in ms.

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

Lists normalized components placed on the active PCB layout with designator, footprint, placement layer, coordinates (`x`, `y` in mm), rotation angle, and side (`top` / `bottom`).

**Parameters:**
- **`query`** (`string`, _optional_): Filter by designator, footprint, value, or primitive ID.
- **`layer`** (`"all" | "top" | "bottom"`, _optional_, default: `"all"`): Filter components by placement side.
- **`limit`** (`number`, _optional_, default: `100`, max: `500`): Maximum components returned.
- **`includeRaw`** (`boolean`, _optional_, default: `false`): Include raw primitive fields.
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
- **`action`** (`"save" | "importChanges" | "autoroute" | "autolayout" | "editDrcRules"`, **required**): Target mutation to execute.
- **`confirmation`** (`string`, **required**):
  - For **`editDrcRules`**: exact string `CONFIRM editDrcRules <editId>` matching the prepared UUID.
  - For **`save`**, **`importChanges`**, **`autoroute`**, **`autolayout`**: explicit phrase containing `I confirm`, `confirmed`, `confirma`, or `confirmo`.
- **`params`** (`object`, _optional_): Required for `editDrcRules` (`{ "editId": "<UUID>" }`).
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
