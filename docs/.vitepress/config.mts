import { defineConfig } from "vitepress";

export default defineConfig({
  title: "EasyEDA Pro MCP",
  description: "Live MCP documentation for EasyEDA Pro integration, schematic analysis, and editor workflows.",
  base: "/easyeda_mcp/",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    logo: "/landing.svg",
    nav: [
      { text: "Quick Start", link: "/quick-start" },
      { text: "Guide", link: "/getting-started" },
      { text: "AI Clients", link: "/ai-client-setup" },
      { text: "Tools", link: "/tools" },
      { text: "Architecture", link: "/architecture" },
      { text: "Releases", link: "/changelog" },
      { text: "GitHub", link: "https://github.com/VLab-Software/easyeda_mcp" }
    ],
    sidebar: [
      {
        text: "Start Here",
        items: [
          { text: "Quick Start", link: "/quick-start" },
          { text: "Getting Started", link: "/getting-started" },
          { text: "MCP Client Setup", link: "/mcp-client-setup" },
          { text: "AI Client Setup", link: "/ai-client-setup" },
          { text: "EasyEDA Pro Extension Setup", link: "/easyeda-extension" }
        ]
      },
      {
        text: "Reference",
        items: [
          { text: "Tools Reference", link: "/tools" },
          { text: "Architecture", link: "/architecture" },
          { text: "Safety Model", link: "/safety" },
          { text: "Troubleshooting", link: "/troubleshooting" }
        ]
      },
      {
        text: "Project",
        collapsed: true,
        items: [
          { text: "Documentation Home", link: "/" },
          { text: "Repository Docs Index", link: "/README" },
          { text: "Changelog", link: "/changelog" },
          { text: "Versioning", link: "/versioning" },
          { text: "GitHub Repository", link: "https://github.com/VLab-Software/easyeda_mcp" }
        ]
      }
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/VLab-Software/easyeda_mcp" }
    ],
    search: {
      provider: "local"
    },
    outline: {
      level: [2, 3]
    },
    footer: {
      message: "Built for live MCP-assisted workflows in EasyEDA Pro.",
      copyright: "Copyright © 2026 VLab Software"
    }
  }
});
