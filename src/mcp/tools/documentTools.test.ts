import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import type { EditorClient } from "../../editor/EditorClient.js";
import type { EditorStatus } from "../../protocol/messages.js";
import { registerDocumentTools } from "./documentTools.js";

async function makeClient(bridge: EditorClient) {
  const server = new McpServer({ name: "test", version: "1.0.0" });
  registerDocumentTools(server, bridge);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("Document MCP Tools", () => {
  it("registers document tools in the MCP catalog", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn()
    };
    const client = await makeClient(bridge);
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name);

    expect(names).toContain("easyeda_list_documents");
    expect(names).toContain("easyeda_open_document");
    expect(names).toContain("easyeda_render_document_view");
  });

  it("lists project documents and open editor tabs", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => ({
        total: 2,
        openCount: 1,
        activeDocument: {
          documentId: "doc-1",
          documentName: "MainBoard.PcbDoc",
          documentType: "pcb"
        },
        documents: [
          {
            documentId: "doc-1",
            documentName: "MainBoard.PcbDoc",
            documentType: "pcb",
            isOpen: true,
            isActive: true
          },
          {
            documentId: "doc-2",
            documentName: "PowerSupply.SchDoc",
            documentType: "schematic",
            isOpen: false,
            isActive: false
          }
        ]
      }))
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_list_documents",
      arguments: {}
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith("listDocuments", {}, 30_000);
    expect(result).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining("Found 2 project document(s) (1 open)") }]
    });
    expect(result.structuredContent).toMatchObject({
      total: 2,
      openCount: 1,
      activeDocument: {
        documentName: "MainBoard.PcbDoc"
      }
    });
  });

  it("opens or activates a document with readback confirmation", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => ({
        opened: true,
        methodUsed: "openDocument",
        documentId: "doc-2",
        tabId: "tab-doc-2",
        previousTarget: { documentId: "doc-1", documentName: "MainBoard.PcbDoc" },
        currentTarget: { documentId: "doc-2", documentName: "PowerSupply.SchDoc" },
        focusChanged: true,
        readbackConfirmed: true,
        viewport: { note: "Focus shifted" }
      }))
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_open_document",
      arguments: {
        documentId: "doc-2",
        activate: true
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "openDocument",
      {
        documentId: "doc-2",
        tabId: undefined,
        target: undefined,
        splitScreenId: undefined,
        activate: true
      },
      30_000
    );
    expect(result).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining("Document opened/activated: PowerSupply.SchDoc") }]
    });
    expect(result.structuredContent).toMatchObject({
      opened: true,
      focusChanged: true,
      readbackConfirmed: true
    });
  });

  it("renders document canvas view and includes image block if base64 is present", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => ({
        target: { documentId: "doc-1", documentName: "MainBoard.PcbDoc", documentType: "pcb" },
        tabId: "tab-1",
        mimeType: "image/png",
        base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        dataUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        viewport: {
          type: "visible_canvas_area",
          limits: ["Captures only the currently rendered area of the active canvas viewport"]
        }
      }))
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_render_document_view",
      arguments: {
        format: "data_url"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(bridge.call).toHaveBeenCalledWith(
      "renderDocumentView",
      {
        target: undefined,
        tabId: undefined,
        format: "data_url"
      },
      30_000
    );
    expect(result.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", text: expect.stringContaining("Canvas viewport rendered") }),
        expect.objectContaining({ type: "image", mimeType: "image/png" })
      ])
    );
  });

  it("handles errors when document rendering capability is missing", async () => {
    const bridge = {
      endpoint: "ws://127.0.0.1:8765",
      getStatus: (): EditorStatus => ({ connected: true, updatedAt: new Date().toISOString() }),
      call: vi.fn(async () => {
        throw new Error("Canvas viewport rendering is not supported by the connected EasyEDA Pro version.");
      })
    };
    const client = await makeClient(bridge);

    const result = await client.callTool({
      name: "easyeda_render_document_view",
      arguments: {}
    });

    expect(result.isError).toBe(true);
    expect(result).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining("not supported") }]
    });
  });
});
