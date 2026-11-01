import type { EditorStatus } from "../../protocol/messages.js";
import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerStatusTools } from "./statusTools.js";
import { doctorNextSteps } from "./common.js";

describe("statusTools", () => {
  it("registers status and context tools on the McpServer", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    const registerToolSpy = vi.spyOn(server, "registerTool");
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: vi.fn((): EditorStatus => ({ connected: true, updatedAt: "2026-11-01T00:00:00.000Z" })),
      call: vi.fn()
    };

    registerStatusTools(server, bridge);

    const registeredToolNames = registerToolSpy.mock.calls.map((call) => call[0]);
    expect(registeredToolNames).toEqual([
      "easyeda_live_status",
      "easyeda_doctor",
      "easyeda_get_context",
      "easyeda_get_selection"
    ]);
  });

  it("produces appropriate next steps in doctorNextSteps depending on connection", () => {
    const disconnectedSteps = doctorNextSteps({
      connected: false,
      updatedAt: new Date().toISOString()
    });
    expect(disconnectedSteps[0]).toContain("Open EasyEDA Pro");

    const healthySteps = doctorNextSteps({
      connected: true,
      documentName: "Board.pcb",
      updatedAt: new Date().toISOString()
    });
    expect(healthySteps[0]).toContain("The bridge looks healthy");
  });
});
