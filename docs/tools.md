# Tools Reference

This document describes the MCP tools exposed by the EasyEDA Pro MCP Bridge.

## Tool Groups

The tools fall into five broad groups:

- status and context
- search and inspection
- schematic analysis
- navigation and export
- explicitly confirmed actions

## Status and Context

### `easyeda_live_status`

Checks whether the EasyEDA Pro extension is connected and returns current bridge and editor status information.

Use it to:

- confirm that the extension is connected
- inspect capabilities exposed by the current EasyEDA Pro session
- verify the active bridge endpoint

### `easyeda_get_context`

Returns a broader summary of the current editor context, including active document details and some available counts for project data.

Use it to:

- confirm the current document state
- inspect high-level project context
- verify that the expected editor session is open

## Search and Inspection

### `easyeda_find_component`

Searches the active project for components matching a designator, name, value, footprint, or property text.

Helpful for:

- locating parts such as `U1`, `USB1`, or a regulator model
- finding likely matches before navigation or tracing

### `easyeda_find_net`

Searches nets by name and returns available net metadata and connections.

Helpful for:

- finding nets such as `GND`, `VCC_5V`, `SDA`, or `VBUS`
- checking available net-level information before deeper tracing

## Schematic Analysis

### `easyeda_schematic_snapshot`

Builds a structured, normalized snapshot of the active schematic, including components, pins, wires, labels, nets, counts, warnings, and confidence metadata.

This is one of the most important tools because higher-level schematic reasoning depends on this normalized view.

### `easyeda_list_schematic_components`

Lists normalized schematic components with key fields such as designator, value, name, footprint, position, and selected properties.

Use it to:

- inventory the active schematic
- filter by query
- inspect what the normalization layer can already see

### `easyeda_get_component_pins`

Returns the pins known for a component, including pin number, pin name, position, and net when available.

Use it to:

- inspect connector or IC pinouts
- verify power pins
- check pin naming before writing connection assertions

### `easyeda_trace_net`

Traces a net and returns the pins, components, wires, labels, and related evidence associated with it.

Use it to:

- inspect signal spread
- analyze power distribution
- validate whether the expected endpoints appear on a named net

### `easyeda_trace_component`

Traces a component's connections grouped by pin and net.

Use it to:

- inspect how a device is wired
- review peripheral connections around a target part
- quickly summarize a component's connectivity

### `easyeda_find_unconnected_pins`

Finds pins that do not have a confirmed net in the normalized schematic data.

Use it to:

- catch incomplete wiring
- surface suspicious symbol connectivity
- quickly identify likely schematic issues

### `easyeda_validate_schematic_area`

Runs generic read-only schematic checks against selected components, selected nets, or the whole schematic.

The current validation layer may report findings such as:

- `pin_without_net`
- `single_pin_net`
- `single_node_net`
- `similar_power_net_names`
- `power_net_without_detected_capacitor`

### `easyeda_verify_connections`

Runs structured connection assertions against the active schematic.

This tool is especially useful when you want targeted checks such as:

- whether a pin is connected at all
- whether a pin is on a specific net
- whether two endpoints resolve to the same node
- whether a path exists or does not exist
- whether a signal is pulled to a reference net through a resistor or other passive component
- whether a power node appears decoupled to a reference net

Supported assertion types include:

- `pin_connected`
- `pin_on_net`
- `same_node`
- `path_exists`
- `path_absent`
- `pull_to_net`
- `decoupled_to_net`

Example shape:

```json
{
  "checks": [
    {
      "type": "pin_on_net",
      "component": "USB1",
      "pinName": "GND",
      "net": "GND"
    },
    {
      "type": "path_exists",
      "from": { "component": "USB1", "pinName": "CC1" },
      "to": { "net": "GND" },
      "through": { "kind": "resistor", "value": "5.1k" }
    }
  ]
}
```

## Navigation and Export

### `easyeda_navigate_component`

Requests navigation to a component in the EasyEDA Pro editor.

Use it after a search or trace when you want to move the editor viewport to a target component.

### `easyeda_navigate_region`

Navigates to coordinates or a rectangular region in the active document.

Use it when:

- you already know the coordinate target
- you want to zoom into a specific area

### `easyeda_zoom_board`

Zooms the active PCB editor to the board outline.

### `easyeda_export_bom`

Exports a BOM from the active project.

Supported formats:

- `csv`
- `xlsx`
- `json`

### `easyeda_export_netlist`

Exports a netlist from the active schematic or PCB context.

### `easyeda_export_gerber`

Exports Gerber fabrication data from the active PCB.

### `easyeda_export_pdf`

Exports a PDF from the active schematic or PCB document.

## Explicitly Confirmed Actions

### `easyeda_confirmed_action`

Runs a mutating EasyEDA Pro action only when the confirmation text explicitly confirms the action.

Supported actions:

- `save`
- `importChanges`
- `autoroute`
- `autolayout`

The confirmation text must include an explicit confirmation phrase such as:

- `I confirm`
- `confirmed`
- `confirma`
- `confirmo`

Example shape:

```json
{
  "action": "save",
  "confirmation": "I confirm"
}
```

## Practical Usage Pattern

A useful workflow is often:

1. `easyeda_live_status`
2. `easyeda_get_context`
3. `easyeda_schematic_snapshot`
4. `easyeda_trace_component` or `easyeda_trace_net`
5. `easyeda_verify_connections` for targeted assertions
6. `easyeda_navigate_component` if you need to inspect the area visually
