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
      text: Quick Start
      link: /quick-start
    - theme: alt
      text: AI Client Setup
      link: /ai-client-setup
---

<div class="support-strip">
  <div class="support-group">
    <div class="support-label">Supported AI Clients</div>
    <div class="support-pill-row support-pill-row-primary">
      <a href="/easyeda_mcp/ai-client-setup#claude-code-cli">Claude Code</a>
      <a href="/easyeda_mcp/ai-client-setup#codex-cli">Codex</a>
      <a href="/easyeda_mcp/ai-client-setup#claude-desktop">Claude Desktop</a>
      <a href="/easyeda_mcp/ai-client-setup#cursor">Cursor</a>
      <a href="/easyeda_mcp/ai-client-setup#vs-code">VS Code</a>
      <a href="/easyeda_mcp/ai-client-setup#antigravity">Antigravity</a>
    </div>
  </div>

  <div class="support-group">
    <div class="support-label">Guides & Reference</div>
    <div class="support-pill-row support-pill-row-secondary">
      <a href="/easyeda_mcp/quick-start">Quick Start</a>
      <a href="/easyeda_mcp/workflows">Workflows</a>
      <a href="/easyeda_mcp/tools">Tools Reference</a>
      <a href="/easyeda_mcp/drc-rules">DRC Rules</a>
      <a href="/easyeda_mcp/upgrading">Upgrading</a>
    </div>
  </div>
</div>

<div class="intro-panel">
  <strong>Why it matters</strong>
  <p>
    Give your AI assistant structured access to the live schematic and PCB open in EasyEDA Pro — instead of guessing from screenshots or manual exports.
  </p>
</div>

<div class="quick-grid">
  <div class="quick-card surface-card">
    <strong>Live context</strong>
    <p>Inspect the active project, open tabs, schematic components, pins, and nets in real time.</p>
  </div>
  <div class="quick-card surface-card">
    <strong>Schematic & DRC review</strong>
    <p>Trace nets, verify circuit connections, and inspect or update native PCB DRC rules.</p>
  </div>
  <div class="quick-card surface-card">
    <strong>Local bridge</strong>
    <p>Runs locally over stdio and WebSocket (<code>127.0.0.1:8765</code>) with no manual file export.</p>
  </div>
  <div class="quick-card surface-card">
    <strong>Confirmation-gated</strong>
    <p>Read-only by default. Editor-changing actions require explicit confirmation.</p>
  </div>
</div>

<div class="about-panel surface-card">
  <strong>About this project</strong>
  <div class="about-grid">
    <div class="about-item">
      <span class="about-label">How it works</span>
      <p>The EasyEDA Pro extension connects to the local MCP server over WebSocket and exposes structured project data to any MCP-compatible AI client.</p>
    </div>
    <div class="about-item">
      <span class="about-label">Requirements</span>
      <p>Node.js <strong>20+</strong> and EasyEDA Pro <strong>2.3.0+</strong>.</p>
    </div>
    <div class="about-item">
      <span class="about-label">License</span>
      <p>Released under the <a href="https://github.com/VLab-Software/easyeda_mcp/blob/master/LICENSE">MIT License</a>.</p>
    </div>
    <div class="about-item">
      <span class="about-label">Not affiliated</span>
      <p>Independent project, not affiliated with, endorsed by, or sponsored by EasyEDA or JLCPCB (Shenzhen Jia Chuang Ban Technology Co., Ltd.).</p>
    </div>
  </div>
</div>

<div class="contact-note surface-card">
  <strong>Contact</strong>
  <p>
    Questions, feedback, or suggestions? Reach out at <a href="mailto:victor.freitas@vlabsoft.com">victor.freitas@vlabsoft.com</a>.
  </p>
</div>

<div class="subtle-note">
  New here? Start with <a href="/easyeda_mcp/quick-start">Quick Start</a>. Configuring your editor or CLI? Open <a href="/easyeda_mcp/ai-client-setup">AI Client Setup</a>. Exploring capabilities? See <a href="/easyeda_mcp/tools">Tools Reference</a>.
</div>
