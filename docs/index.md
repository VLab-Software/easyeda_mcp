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
      <a href="/easyeda_mcp/ai-client-setup#claude-code">Claude Code</a>
      <a href="/easyeda_mcp/ai-client-setup#codex">Codex</a>
      <a href="/easyeda_mcp/ai-client-setup#vs-code">VS Code</a>
    </div>
  </div>

  <div class="support-group">
    <div class="support-label">Supported OS</div>
    <div class="support-pill-row support-pill-row-secondary">
      <a href="/easyeda_mcp/quick-start#windows-claude-desktop">Windows</a>
      <a href="/easyeda_mcp/quick-start#macos-claude-desktop">macOS</a>
      <a href="/easyeda_mcp/quick-start#linux-claude-code">Linux</a>
      <a href="/easyeda_mcp/mcp-client-setup#what-the-client-must-run">Node.js local runtime</a>
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
    <p>Read the active project, document, selection, components, nets, and editor state.</p>
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
      <p>An EasyEDA Pro extension connects to a local MCP server over WebSocket. The extension reads the open project through EasyEDA's internal APIs and forwards structured data to any MCP-compatible AI client. Nothing leaves your machine.</p>
    </div>
    <div class="about-item">
      <span class="about-label">EasyEDA Pro version</span>
      <p>Requires EasyEDA Pro <strong>2.3.0 or later</strong>. The extension uses the <code>eda.*</code> API surface introduced in that release.</p>
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

<div class="contact-note surface-card">
  <strong>Contact</strong>
  <p>
    Want to share feedback, send a suggestion, or talk about the project? Reach out at <a href="mailto:victor.freitas@vlabsoft.com">victor.freitas@vlabsoft.com</a>.
  </p>
</div>

<div class="subtle-note">
  New here? Start with <a href="/easyeda_mcp/getting-started">Getting Started</a>. Connecting Claude, Codex, or VS Code? Open <a href="/easyeda_mcp/ai-client-setup">AI Client Setup</a>. Want the full tool list? See <a href="/easyeda_mcp/tools">Tools Reference</a>.
</div>
