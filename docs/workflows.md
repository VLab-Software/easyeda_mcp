# Practical Workflows

Copy-pasteable prompts and workflows for common schematic and PCB tasks in EasyEDA Pro.

> Before running any workflow, open your target schematic or PCB in EasyEDA Pro and confirm `easyeda_doctor` reports `connected: true`.

---

## 1. Pre-Layout Schematic Review

Catch unconnected pins, single-node nets, and power-rail naming typos before starting PCB layout.

```text
Run easyeda_schematic_snapshot and easyeda_validate_schematic_area on the open schematic.
Summarize:
1. Total components and nets
2. Any unconnected non-power pins
3. Power rails with similar names (possible typos) or missing decoupling capacitors
```

To inspect a suspicious part visually in EasyEDA Pro:

```text
Trace U1 with easyeda_trace_component, then focus on it in the editor with easyeda_navigate_component.
```

---

## 2. Targeted Circuit Assertions (USB-C, Power, Buses)

Verify critical hardware rules programmatically with `easyeda_verify_connections` instead of scanning wires by eye.

```text
Verify the USB-C connector (USB1) and 3.3V regulator (U2) using easyeda_verify_connections:
- USB1 GND pins are on net GND
- USB1 CC1 and CC2 each have a 5.1k resistor path to GND
- VBUS and +3V3 are each decoupled to GND through a capacitor
- SDA and SCL are pulled up to +3V3 through resistors
```

---

## 3. PCB Design Rules (DRC) Review & Profile Setup

Switch to your **PCB tab** in EasyEDA Pro to inspect active rules, create a reusable fabrication profile, or update clearances safely.

### Inspect current rules & saved profiles

```text
Run easyeda_get_drc_rules for "current", "configurations", and "netRules".
Summarize the active track width, clearance, via size, and any custom per-net rules.
```

### Create a new named rule profile (with preview)

```text
Read the current PCB DRC configuration, prepare a new named configuration called "Fab-2Layer-0.15mm" with minimum track width and safe spacing adjusted to 0.15 mm using easyeda_prepare_drc_edit, and show me the preview and confirmation string before applying anything.
```

After reviewing the preview (`changedKeys`, `before`, `requestedAfter`), approve the exact `editId` so the AI can call `easyeda_confirmed_action` (`CONFIRM editDrcRules <editId>`).

---

## 4. Manufacturing Sign-Off Package

Generate fabrication and assembly outputs from the active schematic or PCB.

```text
Check easyeda_get_context to confirm the active PCB, zoom to the board outline with easyeda_zoom_board, and export:
1. BOM in CSV format (easyeda_export_bom)
2. Netlist (easyeda_export_netlist)
3. Gerber files (easyeda_export_gerber)
4. PDF documentation (easyeda_export_pdf)
```
