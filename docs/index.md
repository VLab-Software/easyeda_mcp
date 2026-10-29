---
layout: home

hero:
  name: EasyEDA Pro MCP
  text: Bring AI into your PCB workflow
  tagline: Independent open-source MCP bridge for PCB enthusiasts and professionals using EasyEDA Pro.
  image:
    src: /landing.svg
    alt: EasyEDA Pro MCP logo
  actions:
    - theme: brand
      text: Start Setup
      link: /getting-started
    - theme: alt
      text: Connect AI Client
      link: /ai-client-setup
---

<div class="support-strip">
  <div class="support-group">
    <div class="support-label">Supported AI Clients</div>
    <div class="support-pill-row support-pill-row-primary">
      <a href="/easyeda_mcp/ai-client-setup#claude-desktop">Claude Desktop</a>
      <a href="/easyeda_mcp/ai-client-setup#claude-code-cli">Claude Code</a>
      <a href="/easyeda_mcp/ai-client-setup#codex-cli">Codex</a>
      <a href="/easyeda_mcp/ai-client-setup#vs-code">VS Code</a>
    </div>
  </div>

  <div class="support-group">
    <div class="support-label">Setup Guides</div>
    <div class="support-pill-row support-pill-row-secondary">
      <a href="/easyeda_mcp/quick-start">Quick Start</a>
      <a href="/easyeda_mcp/getting-started">Getting Started</a>
      <a href="/easyeda_mcp/ai-client-setup">AI Client Setup</a>
      <a href="/easyeda_mcp/mcp-client-setup">Generic MCP client</a>
    </div>
  </div>
</div>

<div class="intro-panel">
  <strong>Why it matters</strong>
  <p>
    AI gets much more useful when it can inspect the actual schematic and board in front of you, not just guess from screenshots or copied text.
  </p>
</div>

<div class="quick-grid">
  <div class="quick-card surface-card">
    <strong>Live context</strong>
    <p>Read the active project, document, components, nets, and editor state.</p>
  </div>
  <div class="quick-card surface-card">
    <strong>Smarter reviews</strong>
    <p>Trace nets, inspect pins, find parts, and validate schematic areas with structured data.</p>
  </div>
  <div class="quick-card surface-card">
    <strong>Local bridge</strong>
    <p>Runs through a local MCP server and EasyEDA Pro extension. No project export required.</p>
  </div>
  <div class="quick-card surface-card">
    <strong>Controlled actions</strong>
    <p>Read-only workflows are easy. Editor-changing actions require explicit confirmation.</p>
  </div>
</div>

<div class="about-panel surface-card">
  <strong>About this project</strong>
  <div class="about-grid">
    <div class="about-item">
      <span class="about-label">How it works</span>
      <p>An EasyEDA Pro extension connects to a local MCP server over WebSocket. The extension reads the open project through EasyEDA's documented extension APIs and forwards structured data to any MCP-compatible AI client. The bridge runs locally; your MCP client and AI provider determine where the returned project data is processed.</p>
    </div>
    <div class="about-item">
      <span class="about-label">EasyEDA Pro version</span>
      <p>The extension manifest targets EasyEDA Pro <strong>2.3.0 or later</strong>. Individual beta APIs require runtime capability checks; this does not certify every method on every version.</p>
    </div>
    <div class="about-item">
      <span class="about-label">License</span>
      <p>Released under the <a href="https://github.com/VLab-Software/easyeda_mcp/blob/master/LICENSE">MIT License</a>.</p>
    </div>
    <div class="about-item">
      <span class="about-label">Not affiliated</span>
      <p>This project is not affiliated with, endorsed by, or sponsored by EasyEDA or JLCPCB (Shenzhen Jia Chuang Ban Technology Co., Ltd.). EasyEDA and EasyEDA Pro are trademarks of their respective owners.</p>
    </div>
  </div>
</div>

## Current development

[Issue #14](https://github.com/VLab-Software/easyeda_mcp/issues/14) adds experimental [PCB design rule editing](./drc-rules.md): native reads, reviewed previews and confirmed changes. The development candidates are server **1.1.0-rc.1** and extension **0.2.0-rc.1**. They are not published releases, and real-editor acceptance remains pending.

See the [project roadmap](./evolution-plan.md) for dependencies, status and completion criteria.

<div class="contact-note surface-card">
  <strong>Contact</strong>
  <p>
    Want to share feedback, send a suggestion, or talk about the project? Reach out at <a href="mailto:victor.freitas@vlabsoft.com">victor.freitas@vlabsoft.com</a>.
  </p>
</div>

<div class="subtle-note">
  New here? Start with <a href="/easyeda_mcp/getting-started">Getting Started</a>. Connecting Claude, Codex, or VS Code? Open <a href="/easyeda_mcp/ai-client-setup">AI Client Setup</a>. Want the full tool list? See <a href="/easyeda_mcp/tools">Tools Reference</a>.
</div>
