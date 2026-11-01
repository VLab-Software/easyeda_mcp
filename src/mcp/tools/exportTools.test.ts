import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerExportTools } from "./exportTools.js";

describe("exportTools", () => {
  it("registers all export, navigation and library tools", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    const registerToolSpy = vi.spyOn(server, "registerTool");
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn(() => ({ connected: true })),
      call: vi.fn()
    };

    registerExportTools(server, bridge as never);

    const registeredToolNames = registerToolSpy.mock.calls.map((call) => call[0]);
    expect(registeredToolNames).toEqual([
      "easyeda_navigate_component",
      "easyeda_navigate_region",
      "easyeda_zoom_board",
      "easyeda_export_bom",
      "easyeda_export_netlist",
      "easyeda_export_gerber",
      "easyeda_export_pdf",
      "easyeda_export_cpl",
      "easyeda_search_library"
    ]);
  });
});
