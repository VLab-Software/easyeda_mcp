---
layout: home

hero:
  name: EasyEDA Pro MCP Bridge
  text: Live engineering context for MCP clients
  tagline: Connect your MCP client to a running EasyEDA Pro session for schematic inspection, traceable connectivity analysis, exports, and explicitly confirmed editor actions.
  image:
    src: /mark.svg
    alt: EasyEDA Pro MCP Bridge mark
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: Explore Tools
      link: /tools
    - theme: alt
      text: Release Notes
      link: /changelog

features:
  - title: Live editor bridge
    details: Works against the currently open EasyEDA Pro session instead of relying on an offline archive parser.
  - title: Schematic reasoning
    details: Normalizes components, pins, wires, labels, and nets to power tracing, validation, and connection checks.
  - title: Safe by default
    details: Read workflows are open by default, while mutating actions stay behind explicit confirmation.
---

<div class="hero-panel">
  <strong>Why this bridge exists</strong>
  <p>
    Hardware work becomes dramatically more useful when an MCP client can inspect the design you already have open. This project turns EasyEDA Pro into a live context source instead of a disconnected export step.
  </p>

  <div class="hero-grid">
    <div>
      <strong>Runtime</strong>
      <span>Node.js MCP server over <code>stdio</code> plus a local WebSocket bridge.</span>
    </div>
    <div>
      <strong>Editor link</strong>
      <span>EasyEDA Pro extension using <code>SYS_WebSocket</code> and native <code>eda.*</code> APIs.</span>
    </div>
    <div>
      <strong>Best use cases</strong>
      <span>Connectivity review, pin inspection, net tracing, exports, and guided PCB/schematic navigation.</span>
    </div>
  </div>

  <p class="hero-note">
    The current version is intentionally live-session based. EasyEDA Pro must be open, the extension must be connected, and the MCP server must be running.
  </p>
</div>

<div class="doc-callout">
  <p>
    Start with <a href="/easyeda_mcp/getting-started">Getting Started</a> if you are setting this up for the first time, or jump straight to <a href="/easyeda_mcp/tools">Tools Reference</a> if you want to see what the bridge already exposes.
  </p>
</div>

<div class="doc-callout">
  <p>
    Want the project-level view? Check <a href="/easyeda_mcp/changelog">Changelog</a> for notable updates and <a href="/easyeda_mcp/versioning">Versioning</a> for release expectations between the server, extension, and docs.
  </p>
</div>
