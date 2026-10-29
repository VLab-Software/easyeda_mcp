# Tools Reference

EasyEDA Pro MCP exposes **24 tools** grouped into 5 workflows. All read, trace, navigation, and export tools run without modifying project data.

## Status & Context

| Tool | Description |
| --- | --- |
| `easyeda_doctor` | Full bridge diagnosis: server/extension versions, protocol compatibility, active document state, and next steps. Run this first. |
| `easyeda_live_status` | Quick connection and active document status check. |
| `easyeda_get_context` | Active project/document UUIDs, split-screen open tabs, DRC method capabilities, and component/net counts. |

## Search & Schematic Analysis

| Tool | Key Arguments | Description |
| --- | --- | --- |
| `easyeda_find_component` | `query`, `limit?` | Search components by designator (`U1`, `USB1`), value, footprint, or property text. |
| `easyeda_find_net` | `query`, `limit?` | Search nets by name (`GND`, `VBUS`, `SDA`, `CC1`) and inspect connections. |
| `easyeda_schematic_snapshot` | `allPages?`, `includeRaw?` | Normalized schematic snapshot: components, pins, wires, labels, nets, warnings, and confidence. |
| `easyeda_list_schematic_components` | `query?`, `limit?`, `allPages?` | List normalized schematic components with designator, value, footprint, and position. |
| `easyeda_get_component_pins` | `component`, `allPages?` | List all known pins for a component (pin number, name, coordinates, and net). |
| `easyeda_trace_net` | `net`, `allPages?` | Trace a signal or power rail across pins, components, wires, and labels. |
| `easyeda_trace_component` | `component`, `allPages?` | Trace all connections around a component grouped by pin and net. |
| `easyeda_find_unconnected_pins` | `includePowerPins?`, `limit?` | Identify pins without a confirmed net in normalized schematic data. |
| `easyeda_validate_schematic_area` | `components?`, `nets?` | Read-only heuristic checks (`pin_without_net`, `single_pin_net`, `similar_power_net_names`, `power_net_without_detected_capacitor`). |
| `easyeda_verify_connections` | `checks`, `maxHops?` | Verify structured circuit assertions (`pin_connected`, `pin_on_net`, `same_node`, `path_exists`, `path_absent`, `pull_to_net`, `decoupled_to_net`). |

Example `easyeda_verify_connections` payload:

```json
{
  "checks": [
    { "type": "pin_on_net", "component": "USB1", "pinName": "GND", "net": "GND" },
    {
      "type": "path_exists",
      "from": { "component": "USB1", "pinName": "CC1" },
      "to": { "net": "GND" },
      "through": { "kind": "resistor", "value": "5.1k" }
    }
  ]
}
```

## Navigation & Manufacturing Exports

| Tool | Key Arguments | Description |
| --- | --- | --- |
| `easyeda_navigate_component` | `query` | Focus and highlight a component in the active EasyEDA Pro editor. |
| `easyeda_navigate_region` | `x?`, `y?`, `left?`, `top?`, `right?`, `bottom?` | Pan/zoom to coordinates or a bounding box in the active document. |
| `easyeda_zoom_board` | — | Zoom the active PCB view to fit the board outline. |
| `easyeda_export_bom` | `format?` (`csv` \| `xlsx` \| `json`), `scope?`, `fileName?` | Export Bill of Materials from the active project. |
| `easyeda_export_netlist` | `scope?`, `fileName?` | Export netlist from the active schematic or PCB. |
| `easyeda_export_gerber` | `fileName?` | Export Gerber fabrication files from the active PCB. |
| `easyeda_export_pdf` | `scope?`, `fileName?` | Export PDF of the active schematic or PCB. |

## PCB Design Rules (DRC)

Requires an active PCB document (`documentType: 3`). See [DRC Rule Editing](./drc-rules.md) for operation payloads and safeguards.

| Tool | Key Arguments | Description |
| --- | --- | --- |
| `easyeda_get_drc_rules` | `scope` (`current` \| `configurations` \| `netRules` \| `netByNetRules` \| `regionRules`) | Read native PCB design rules and `eda.pcb_Drc` method capabilities without writing. |
| `easyeda_prepare_drc_edit` | `operation` | Stage a typed DRC change without modifying the PCB; returns `editId`, `preview` (`before`, `requestedAfter`, `changedKeys`), and exact confirmation phrase. |
| `easyeda_get_drc_edit_result` | `editId` | Query a retained DRC edit status (`prepared`, `running`, `applied`, `failed`, `unknown`, `invalidated`, `expired`). |

## Confirmation-Gated Actions

### `easyeda_confirmed_action`

Executes mutating editor operations only when explicit human confirmation is supplied:

| `action` | Required `confirmation` | `params` |
| --- | --- | --- |
| `save` | Phrase containing `I confirm`, `confirmed`, `confirma`, or `confirmo` | — |
| `importChanges` | Explicit confirmation phrase | — |
| `autoroute` | Explicit confirmation phrase | — |
| `autolayout` | Explicit confirmation phrase | — |
| `editDrcRules` | Exact `CONFIRM editDrcRules <editId>` | `{ "editId": "<UUID>" }` |

```json
{
  "action": "editDrcRules",
  "params": { "editId": "bd549553-e96d-4c9b-bb1f-f8e8ac28cf89" },
  "confirmation": "CONFIRM editDrcRules bd549553-e96d-4c9b-bb1f-f8e8ac28cf89"
}
```
