# Changelog

This page tracks notable documentation and product-facing changes for the EasyEDA Pro MCP Bridge.

## Unreleased

### Documentation

- Added a VitePress documentation site inside `docs/`
- Added a custom docs homepage and navigation structure
- Added dedicated guides for setup, architecture, tools, safety, and troubleshooting
- Added GitHub Pages deployment through GitHub Actions

### Project

- Added `easyeda_verify_connections` to the documented MCP tool list

## 0.1.0

Initial public project baseline for the live EasyEDA Pro MCP Bridge.

Included foundations:

- MCP server over `stdio`
- Local WebSocket bridge
- EasyEDA Pro extension integration
- Component and net lookup
- Schematic snapshot and tracing flows
- Export helpers for BOM, netlist, Gerber, and PDF
- Explicit confirmation gate for mutating actions

## Changelog Guidance

Going forward, this page works best when entries are grouped by release or milestone and focus on changes that matter to users, integrators, or contributors.
