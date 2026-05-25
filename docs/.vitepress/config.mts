import { defineConfig } from "vitepress";

export default defineConfig({
  title: "EasyEDA Pro MCP Bridge",
  description: "Live MCP documentation for EasyEDA Pro integration, schematic analysis, and editor workflows.",
  base: "/easyeda_mcp/",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    logo: {
      src: "/mark.svg",
      alt: "EasyEDA Pro MCP Bridge"
    },
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Architecture", link: "/architecture" },
      { text: "Tools", link: "/tools" },
      { text: "Releases", link: "/changelog" },
      { text: "GitHub", link: "https://github.com/VLab-Software/easyeda_mcp" }
    ],
    sidebar: [
      {
        text: "Overview",
        items: [
          { text: "Documentation Home", link: "/" },
          { text: "Repository Docs Index", link: "/README" },
          { text: "Changelog", link: "/changelog" },
          { text: "Versioning", link: "/versioning" }
        ]
      },
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/getting-started" },
          { text: "MCP Client Setup", link: "/mcp-client-setup" },
          { text: "EasyEDA Pro Extension Setup", link: "/easyeda-extension" }
        ]
      },
      {
        text: "Reference",
        items: [
          { text: "Architecture", link: "/architecture" },
          { text: "Tools Reference", link: "/tools" },
          { text: "Safety Model", link: "/safety" },
          { text: "Troubleshooting", link: "/troubleshooting" }
        ]
      },
      {
        text: "Project",
        items: [
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
