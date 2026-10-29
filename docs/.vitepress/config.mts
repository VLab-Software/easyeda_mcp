import { defineConfig } from "vitepress";

export default defineConfig({
  title: "EasyEDA Pro MCP",
  description: "Independent open-source MCP bridge docs for EasyEDA Pro integration, schematic analysis, and editor workflows.",
  base: "/easyeda_mcp/",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    logo: "/landing.svg",
    nav: [
      { text: "Quick Start", link: "/quick-start" },
      { text: "AI Clients", link: "/ai-client-setup" },
      { text: "Workflows", link: "/workflows" },
      { text: "Tools", link: "/tools" },
      { text: "Upgrading", link: "/upgrading" },
      { text: "Changelog", link: "/changelog" },
      { text: "GitHub", link: "https://github.com/VLab-Software/easyeda_mcp" }
    ],
    sidebar: [
      {
        text: "Start Here",
        items: [
          { text: "Quick Start", link: "/quick-start" },
          { text: "AI Client Setup", link: "/ai-client-setup" },
          { text: "EasyEDA Pro Extension", link: "/easyeda-extension" },
          { text: "Upgrading & Compatibility", link: "/upgrading" }
        ]
      },
      {
        text: "Guides & Reference",
        items: [
          { text: "Practical Workflows", link: "/workflows" },
          { text: "Tools Reference", link: "/tools" },
          { text: "DRC Rule Editing", link: "/drc-rules" },
          { text: "Architecture", link: "/architecture" },
          { text: "Safety Model", link: "/safety" },
          { text: "Troubleshooting", link: "/troubleshooting" },
          { text: "Changelog", link: "/changelog" }
        ]
      },
      {
        text: "Project",
        collapsed: true,
        items: [
          { text: "Documentation Home", link: "/" },
          { text: "Repository Docs Index", link: "/README" },
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
      message: "Released under the <a href=\"https://github.com/VLab-Software/easyeda_mcp/blob/master/LICENSE\">MIT License</a>. Not affiliated with, endorsed by, or sponsored by EasyEDA or JLCPCB (Shenzhen Jia Chuang Ban Technology Co., Ltd.). EasyEDA and EasyEDA Pro are trademarks of their respective owners.",
      copyright: "Copyright © 2026 VLab Software"
    }
  }
});
