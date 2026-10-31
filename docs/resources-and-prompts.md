# MCP Resources & Prompts

EasyEDA Pro MCP exposes **7 native MCP Resources** and **4 pre-engineered Prompts** designed to minimize token consumption and provide immediate circuit context to AI assistants.

::: tip Token Optimization
Reading `easyeda://schematic/active` or `easyeda://pcb/active` returns high-density, token-optimized projections that strip coordinate geometry, internal UUIDs, and styling artifacts. This reduces context window usage by **70% to 80%** compared to raw schematic snapshots.
:::

---

## MCP Resources

MCP Resources allow AI clients (Claude Desktop, Cursor, Antigravity, VS Code, Windsurf) to read or attach project state on demand without executing full tool calls.

| Resource URI | Type | Description |
| --- | --- | --- |
| **[`easyeda://project/status`](#easyedaprojectstatus)** | Static | Bridge connection state, capabilities, and active document preview |
| **[`easyeda://project/context`](#easyedaprojectcontext)** | Static | Active project UUIDs, open editor tabs, and canvas selection |
| **[`easyeda://schematic/active`](#easyedaschematicactive)** | Static | High-density schematic projection (components, values, footprints, nets) |
| **[`easyeda://pcb/active`](#easyedapcbactive)** | Static | High-density PCB projection (routing status, completion %, airwires) |
| **[`easyeda://pcb/layers`](#easyedapcblayers)** | Static | Physical copper, silkscreen, mask, and mechanical layer stackup |
| **[`easyeda://pcb/drc-rules`](#easyedapcbdrc-rules)** | Static | Active PCB design rule settings, clearances, and track width limits |
| **[`easyeda://component/{designator}`](#easyedacomponentdesignator)** | Template | On-demand component inspection by designator (e.g. `R1`, `U2`, `C15`) |

---

### `easyeda://project/status`

- **MIME Type:** `application/json`
- **Scope:** Local MCP Bridge Cache

Returns the live status of the WebSocket bridge (`ws://127.0.0.1:8765`), protocol compatibility, extension version, and connected document preview.

```json
{
  "status": {
    "connected": true,
    "connectionState": "connected",
    "extensionVersion": "0.4.0",
    "protocolVersion": "0.1.0",
    "projectName": "USB-C Power Delivery Controller",
    "documentName": "Sheet_1.esys",
    "activeDocumentType": "schematic"
  },
  "bridgeEndpoint": "ws://127.0.0.1:8765",
  "timestamp": "2026-10-31T18:00:00.000Z"
}
```

---

### `easyeda://project/context`

- **MIME Type:** `application/json`
- **Scope:** Live Editor Session

Returns active project metadata, open tabs, and currently selected canvas primitives from EasyEDA Pro.

---

### `easyeda://schematic/active`

- **MIME Type:** `application/json`
- **Scope:** Active Schematic Document

Returns a high-density, compact summary of the open schematic sheet. All coordinate bloat and SVG render paths are eliminated, leaving only the electrical semantic graph:

```json
{
  "sheetName": "Power_Supply.esys",
  "totalComponents": 14,
  "totalNets": 8,
  "componentsByType": { "C": 6, "R": 4, "U": 2, "D": 2 },
  "components": [
    { "ref": "U1", "val": "TPS62840", "name": "BUCK_REGULATOR", "pkg": "WSON-6", "pinsCount": 6 },
    { "ref": "C1", "val": "10uF", "name": "CAP", "pkg": "0603", "pinsCount": 2 },
    { "ref": "R1", "val": "100k", "name": "RES", "pkg": "0402", "pinsCount": 2 }
  ],
  "nets": [
    { "name": "+3V3", "pinsCount": 4, "connections": ["U1.1", "C1.1", "R1.1"] },
    { "name": "GND", "pinsCount": 8, "connections": ["U1.2", "C1.2", "R1.2"] }
  ]
}
```

---

### `easyeda://pcb/active`

- **MIME Type:** `application/json`
- **Scope:** Active PCB Document

Returns routing completion status, unrouted airwires, and placed footprint references:

```json
{
  "documentName": "Power_Supply_PCB.epcb",
  "totalComponents": 14,
  "totalNets": 8,
  "routedNets": 7,
  "unroutedNets": 1,
  "completionRate": "88%",
  "unroutedNetNames": ["BAT_SENSE"],
  "components": [
    { "ref": "U1", "layer": "top", "pkg": "WSON-6" },
    { "ref": "C1", "layer": "top", "pkg": "0603" }
  ]
}
```

---

### `easyeda://component/{designator}`

- **MIME Type:** `application/json`
- **Scope:** Dynamic Resource Template

Inspects a specific component by reference designator without loading or parsing the entire schematic or board.

- **Example URIs:**
  - `easyeda://component/U1`
  - `easyeda://component/C15`
  - `easyeda://component/R2`

---

## MCP Prompts

MCP Prompts are pre-engineered engineering workflows that can be invoked with a single click or slash command in supporting AI clients.

| Prompt | Arguments | Purpose |
| --- | --- | --- |
| **`review_schematic`** | `scope` (`all`, `power`, `signals`), `strict` (`boolean`) | Comprehensive electrical audit for decoupling, floating pins, and protection |
| **`audit_pcb_drc`** | `focus` (`all`, `clearance`, `routing`) | Layout audit checking native DRC violations, airwires, and trace widths |
| **`prepare_manufacturing`** | `manufacturer` (e.g. `jlcpcb`) | Pre-flight validation checklist for BOM, CPL, Gerber, and SMT assembly |
| **`trace_circuit_path`** | `startNet` (`string`), `targetComponent` (`string`) | Signal or power rail trace from origin to load across series elements |

---

### Using Prompts in AI Clients

#### In Claude Desktop
Click the **Prompt (`/`)** icon in the chat input and select:
- `review_schematic`
- `audit_pcb_drc`
- `prepare_manufacturing`
- `trace_circuit_path`

#### In Cursor / VS Code / Antigravity
Type `@easyeda-pro` or select from the prompt actions list, passing arguments as needed.
