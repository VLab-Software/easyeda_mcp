import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type WebSocketRegistration = {
  onMessage?: (event: MessageEvent<string>) => Promise<void>;
  onOpen?: () => Promise<void>;
};

function component(designator: string, primitiveId: string, value = designator): Record<string, unknown> {
  return {
    designator,
    primitiveId,
    name: value,
    x: 0,
    y: 0
  };
}

function pin(pinNumber: string, pinName: string, x: number, y: number): Record<string, unknown> {
  return {
    primitiveId: `$pin-${pinNumber}-${pinName}`,
    pinNumber,
    pinName,
    x,
    y
  };
}

function wire(net: string | undefined, path: number[][]): Record<string, unknown> {
  return {
    primitiveId: `$wire-${net ?? "unnamed"}-${path.length}`,
    net,
    line: path
  };
}

describe("EasyEDA extension bridge handlers", () => {
  let sentMessages: Array<{ id: string; message: string }> = [];
  let registration: WebSocketRegistration;
  let dialogMessages: Array<{ title: string; message: string }> = [];
  let savedDocumentUuids: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    sentMessages = [];
    registration = {};
    dialogMessages = [];
    savedDocumentUuids = [];

    vi.stubGlobal("eda", {
      sys_WebSocket: {
        register: vi.fn((_id: string, _uri: string, onMessage: WebSocketRegistration["onMessage"], onOpen: WebSocketRegistration["onOpen"]) => {
          registration = { onMessage, onOpen };
        }),
        send: vi.fn((id: string, message: string) => {
          sentMessages.push({ id, message });
        })
      },
      sys_Dialog: {
        showInformationMessage: vi.fn((message: string, title: string) => {
          dialogMessages.push({ title, message });
        })
      },
      sys_Log: {
        warn: vi.fn(),
        error: vi.fn()
      },
      dmt_SelectControl: {
        getCurrentDocumentInfo: vi.fn(async () => ({
          uuid: "doc-123",
          type: "schematic",
          name: "Power Supply.Schematic"
        }))
      },
      dmt_EditorControl: {
        getSplitScreenTree: vi.fn(async () => []),
        zoomToRegion: vi.fn(async () => undefined)
      },
      sch_PrimitiveComponent: {
        getAll: vi.fn(async () => [component("U5", "$u5", "TP4057"), component("R7", "$r7", "2k"), component("C4", "$c4", "4.7uF")]),
        getAllPinsByPrimitiveId: vi.fn(async (primitiveId: string) => {
          const pinsByPrimitive: Record<string, unknown[]> = {
            $u5: [
              pin("1", "BAT", 60, 0),
              pin("2", "VCC", 20, 0),
              pin("6", "PROG", 90, 20)
            ],
            $r7: [
              pin("1", "1", 90, 20),
              pin("2", "2", 90, 40)
            ],
            $c4: [
              pin("1", "1", 20, 0),
              pin("2", "2", 20, 20)
            ]
          };
          return pinsByPrimitive[primitiveId] ?? [];
        })
      },
      sch_PrimitiveWire: {
        getAll: vi.fn(async () => [
          wire("VBUS", [[0, 0, 20, 0]]),
          wire("VBAT_LIPO", [[60, 0, 80, 0]]),
          wire(undefined, [[90, 20, 100, 20]]),
          wire("GND", [[20, 20, 20, 40], [20, 40, 90, 40]])
        ])
      },
      sch_PrimitiveText: {
        getAll: vi.fn(async () => [])
      },
      sch_Document: {
        save: vi.fn(async (uuid: string) => {
          savedDocumentUuids.push(uuid);
        })
      }
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("auto-connects on activation and sends hello on open", async () => {
    const extension = await import("./index.js");

    extension.activate("onStartupFinished");
    expect(registration.onOpen).toBeTypeOf("function");

    await registration.onOpen?.();

    const helloMessage = JSON.parse(sentMessages.at(0)?.message ?? "{}");
    expect(helloMessage.kind).toBe("hello");
    expect(helloMessage.protocolVersion).toBe("0.1.0");
    expect(helloMessage.compatibility).toMatchObject({
      compatible: true,
      expectedProtocolVersion: "0.1.0"
    });
  });

  it("responds to verifyConnections requests with structured results", async () => {
    const extension = await import("./index.js");

    extension.connect();
    await registration.onOpen?.();

    await registration.onMessage?.({
      data: JSON.stringify({
        kind: "call",
        requestId: "verify-1",
        method: "verifyConnections",
        params: {
          checks: [
            {
              id: "u5-vcc",
              type: "pin_on_net",
              component: "U5",
              pinName: "VCC",
              net: "VBUS"
            },
            {
              id: "u5-prog",
              type: "pull_to_net",
              signal: { component: "U5", pinName: "PROG" },
              net: "GND",
              through: { kind: "resistor" }
            }
          ]
        }
      })
    } as MessageEvent<string>);

    const resultMessage = JSON.parse(sentMessages.at(-1)?.message ?? "{}");
    expect(resultMessage.kind).toBe("result");
    expect(resultMessage.requestId).toBe("verify-1");
    expect(resultMessage.result.summary).toMatchObject({
      passed: 2,
      failed: 0,
      unknown: 0
    });
    expect(resultMessage.result.checks.map((check: { status: string }) => check.status)).toEqual(["pass", "pass"]);
  });

  it("executes confirmed save actions and returns success payload", async () => {
    const extension = await import("./index.js");

    extension.connect();
    await registration.onMessage?.({
      data: JSON.stringify({
        kind: "call",
        requestId: "save-1",
        method: "confirmedAction",
        params: {
          action: "save"
        }
      })
    } as MessageEvent<string>);

    const resultMessage = JSON.parse(sentMessages.at(-1)?.message ?? "{}");
    expect(savedDocumentUuids).toEqual(["doc-123"]);
    expect(resultMessage.kind).toBe("result");
    expect(resultMessage.result).toMatchObject({
      action: "save",
      saved: true,
      documentUuid: "doc-123"
    });
  });

  it("shows diagnostics with connection and document details", async () => {
    const extension = await import("./index.js");

    extension.connect();
    await extension.runDiagnostics();

    expect(dialogMessages.at(-1)).toMatchObject({
      title: "EasyEDA MCP Bridge Diagnostics"
    });
    expect(dialogMessages.at(-1)?.message).toContain("Bridge URI: ws://127.0.0.1:8765");
    expect(dialogMessages.at(-1)?.message).toContain("Connection phase:");
    expect(dialogMessages.at(-1)?.message).toContain("Document: Power Supply.Schematic");
  });
});
