import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPcbTools } from "./pcbTools.js";

describe("pcbTools", () => {
  it("registers all PCB inspection and DRC tools", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    const registerToolSpy = vi.spyOn(server, "registerTool");
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn(() => ({ connected: true })),
      call: vi.fn()
    };

    registerPcbTools(server, bridge as never);

    const registeredToolNames = registerToolSpy.mock.calls.map((call) => call[0]);
    expect(registeredToolNames).toEqual([
      "easyeda_run_drc",
      "easyeda_get_pcb_layers",
      "easyeda_get_routing_status",
      "easyeda_list_pcb_components",
      "easyeda_highlight_net"
    ]);
  });
});
