---
layout: home

hero:
  name: EasyEDA Pro MCP Bridge
  text: Live EasyEDA context for MCP clients
  tagline: Connect to a running EasyEDA Pro session for inspection, tracing, exports, and safe editor actions.
  image:
    src: /mark.svg
    alt: EasyEDA Pro MCP Bridge mark
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: Tools Reference
      link: /tools

features:
  - title: Live editor bridge
    details: Works against the active EasyEDA Pro session instead of an offline archive parser.
  - title: Schematic reasoning
    details: Normalizes components, pins, wires, labels, and nets for tracing and validation.
  - title: Safe by default
    details: Read workflows stay open by default while mutating actions require explicit confirmation.
---

<div class="intro-panel">
  <strong>What it gives you</strong>
  <p>
    This bridge turns EasyEDA Pro into live context for your MCP client, so analysis can happen directly against the project that is already open in the editor.
  </p>
</div>

<div class="quick-grid">
  <div class="quick-card">
    <strong>Runtime</strong>
    <p>Node.js MCP server over <code>stdio</code> with a local WebSocket bridge.</p>
  </div>
  <div class="quick-card">
    <strong>Editor link</strong>
    <p>EasyEDA Pro extension using <code>SYS_WebSocket</code> and native <code>eda.*</code> APIs.</p>
  </div>
  <div class="quick-card">
    <strong>Best use cases</strong>
    <p>Connectivity review, net tracing, pin inspection, exports, and guided navigation.</p>
  </div>
</div>

<div class="subtle-note">
  Start with <a href="/easyeda_mcp/getting-started">Getting Started</a> for first-time setup, use <a href="/easyeda_mcp/tools">Tools Reference</a> for the current MCP surface, and check <a href="/easyeda_mcp/changelog">Changelog</a> when you want project-level updates.
</div>
