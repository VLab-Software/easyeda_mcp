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
        })),
        getSelectedPrimitives: vi.fn(async () => [
          { id: "$u5", designator: "U5", type: "component", layer: 1 }
        ])
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
      },
      pcb_ManufactureData: {
        getPickAndPlaceFile: vi.fn(async (fileName: string, format: string, unit: string) => ({
          file: { name: `${fileName}.${format}`, content: `designator,x,y\nU1,10,20\n`, unit }
        }))
      },
      pcb_Drc: {
        check: vi.fn(async (_strict: boolean) => ({
          passed: true,
          errors: [],
          warnings: []
        }))
      },
      pcb_Layer: {
        getAllLayers: vi.fn(async () => [
          { id: 1, name: "TopLayer", type: "signal", color: "#ff0000", visible: true, isSignal: true, thickness: 0.035 },
          { id: 2, name: "BottomLayer", type: "signal", color: "#0000ff", visible: true, isSignal: true, thickness: 0.035 },
          { id: 3, name: "TopSilkscreen", type: "silkscreen", color: "#ffffff", visible: true, isSignal: false }
        ])
      },
      pcb_PrimitiveComponent: {
        getAll: vi.fn(async () => [
          { primitiveId: "$pcb-u1", designator: "U1", footprint: "SOP-8", value: "TP4056", x: 10, y: 20, rotation: 0, layer: 1 },
          { primitiveId: "$pcb-c1", designator: "C1", footprint: "0603", value: "10uF", x: 15, y: 25, rotation: 90, layer: 2 }
        ])
      },
      pcb_Net: {
        getAllNetsName: vi.fn(async () => ["GND", "VCC_3V3", "SDA", "SCL"]),
        getNetLength: vi.fn(async (name: string) => (name === "GND" ? 150.5 : name === "VCC_3V3" ? 80.2 : 0)),
        highlightNet: vi.fn(async (_net: string) => undefined),
        unhighlightAllNets: vi.fn(async () => undefined)
      },
      lib_Device: {
        search: vi.fn(async (query: string) => [
          { uuid: "dev-c1523", name: "10uF 0805", lcscCode: "C1523", package: "0805", manufacturer: "Samsung", inStock: 50000, isJlcBasic: true }
        ])
      },
      sys_FileSystem: {
        saveFile: vi.fn(async (_file: unknown, fileName: string) => ({ success: true, fileName }))
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

  it.each([[1, "schematic"], [2, "symbol"], [3, "pcb"], [4, "footprint"]])("infers type %s as %s from official numeric documentType", async (documentType, expected) => {
    vi.stubGlobal("eda", {
      ...(globalThis as unknown as { eda: Record<string, unknown> }).eda,
      dmt_SelectControl: {
        getCurrentDocumentInfo: vi.fn(async () => ({
          uuid: "doc-123",
          documentType
        }))
      }
    });

    const extension = await import("./index.js");

    extension.activate("onStartupFinished");
    await registration.onOpen?.();

    const helloMessage = JSON.parse(sentMessages.at(0)?.message ?? "{}");
    expect(helloMessage.status.activeDocumentType).toBe(expected);
  });

  it("routes DRC previews and enforces confirmation in the extension even without an MCP guard", async () => {
    const overwrite = vi.fn(async () => true);
    vi.stubGlobal("eda", {
      ...(globalThis as unknown as { eda: Record<string, unknown> }).eda,
      dmt_SelectControl: { getCurrentDocumentInfo: async () => ({ documentType: 3, uuid: "pcb", parentProjectUuid: "project", tabId: "pcb@project" }) },
      pcb_Drc: { getCurrentRuleConfiguration: async () => ({ name: "Default", config: { testRule: 10 } }), overwriteCurrentRuleConfiguration: overwrite }
    });
    const extension = await import("./index.js");
    extension.connect(); await registration.onOpen?.();
    await registration.onMessage?.({ data: JSON.stringify({ kind: "call", requestId: "prepare-drc", method: "prepareDrcEdit",
      params: { operation: { type: "updateCurrentConfiguration", config: { testRule: 20 } } } }) } as MessageEvent<string>);
    const edit = JSON.parse(sentMessages.at(-1)!.message).result;
    expect(edit.status).toBe("prepared");
    await registration.onMessage?.({ data: JSON.stringify({ kind: "call", requestId: "apply-drc", method: "confirmedAction",
      params: { action: "editDrcRules", confirmation: "confirmo", params: { editId: edit.editId } } }) } as MessageEvent<string>);
    expect(JSON.parse(sentMessages.at(-1)!.message)).toMatchObject({ kind: "error", error: { code: "confirmation_required" } });
    expect(overwrite).not.toHaveBeenCalled();
    extension.reconnect();
    await registration.onMessage?.({ data: JSON.stringify({ kind: "call", requestId: "query-drc", method: "getDrcEditResult", params: { editId: edit.editId } }) } as MessageEvent<string>);
    expect(JSON.parse(sentMessages.at(-1)!.message).result.status).toBe("invalidated");
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

  it("exports CPL pick and place file", async () => {
    const extension = await import("./index.js");
    extension.connect();
    await registration.onMessage?.({
      data: JSON.stringify({
        kind: "call",
        requestId: "cpl-1",
        method: "exportCpl",
        params: { fileName: "my-cpl", format: "csv", unit: "mm" }
      })
    } as MessageEvent<string>);

    const resultMessage = JSON.parse(sentMessages.at(-1)?.message ?? "{}");
    expect(resultMessage.kind).toBe("result");
    expect(resultMessage.requestId).toBe("cpl-1");
    expect(resultMessage.result).toMatchObject({
      saved: true,
      fileName: "my-cpl.csv",
      betaApi: true
    });
  });

  it("runs PCB DRC check and handles wrong_document error", async () => {
    const extension = await import("./index.js");
    extension.connect();

    // Document is schematic by default, so runDrc should fail with wrong_document
    await registration.onMessage?.({
      data: JSON.stringify({
        kind: "call",
        requestId: "drc-fail",
        method: "runDrc",
        params: { strict: true }
      })
    } as MessageEvent<string>);

    const failMessage = JSON.parse(sentMessages.at(-1)?.message ?? "{}");
    expect(failMessage.kind).toBe("error");
    expect(failMessage.error.code).toBe("wrong_document");

    // Now stub documentType to PCB (3)
    vi.stubGlobal("eda", {
      ...(globalThis as unknown as { eda: Record<string, unknown> }).eda,
      dmt_SelectControl: {
        getCurrentDocumentInfo: vi.fn(async () => ({
          uuid: "pcb-doc-456",
          documentType: 3,
          name: "MainBoard.PCB"
        }))
      }
    });

    await registration.onMessage?.({
      data: JSON.stringify({
        kind: "call",
        requestId: "drc-pass",
        method: "runDrc",
        params: { strict: true }
      })
    } as MessageEvent<string>);

    const passMessage = JSON.parse(sentMessages.at(-1)?.message ?? "{}");
    expect(passMessage.kind).toBe("result");
    expect(passMessage.result).toMatchObject({
      passed: true,
      errorsCount: 0,
      warningsCount: 0
    });
  });

  it("retrieves PCB layers stackup", async () => {
    const extension = await import("./index.js");
    extension.connect();

    await registration.onMessage?.({
      data: JSON.stringify({
        kind: "call",
        requestId: "layers-1",
        method: "getPcbLayers",
        params: {}
      })
    } as MessageEvent<string>);

    const resultMessage = JSON.parse(sentMessages.at(-1)?.message ?? "{}");
    expect(resultMessage.kind).toBe("result");
    expect(resultMessage.result).toMatchObject({
      layerCount: 3,
      copperLayerCount: 2
    });
    expect(resultMessage.result.layers[0]).toMatchObject({
      name: "TopLayer",
      isSignal: true
    });
  });

  it("analyzes PCB routing status and calculates completion percent", async () => {
    const extension = await import("./index.js");
    extension.connect();

    await registration.onMessage?.({
      data: JSON.stringify({
        kind: "call",
        requestId: "routing-1",
        method: "getRoutingStatus",
        params: { includeNetLengths: true }
      })
    } as MessageEvent<string>);

    const resultMessage = JSON.parse(sentMessages.at(-1)?.message ?? "{}");
    expect(resultMessage.kind).toBe("result");
    expect(resultMessage.result).toMatchObject({
      totalNets: 4,
      routedNets: 2,
      unroutedNets: 2,
      completionPercent: 50
    });
    expect(resultMessage.result.unroutedNetNames).toEqual(["SDA", "SCL"]);
    expect(resultMessage.result.netLengths).toMatchObject({
      GND: 150.5,
      VCC_3V3: 80.2,
      SDA: 0,
      SCL: 0
    });
  });

  it("lists normalized PCB components and filters by layer", async () => {
    const extension = await import("./index.js");
    extension.connect();

    await registration.onMessage?.({
      data: JSON.stringify({
        kind: "call",
        requestId: "pcb-comp-1",
        method: "listPcbComponents",
        params: { layer: "top" }
      })
    } as MessageEvent<string>);

    const resultMessage = JSON.parse(sentMessages.at(-1)?.message ?? "{}");
    expect(resultMessage.kind).toBe("result");
    expect(resultMessage.result.total).toBe(2);
    expect(resultMessage.result.count).toBe(1);
    expect(resultMessage.result.components[0]).toMatchObject({
      designator: "U1",
      footprint: "SOP-8",
      side: "top"
    });
  });

  it("highlights and clears nets on PCB", async () => {
    const extension = await import("./index.js");
    extension.connect();

    // Highlight GND
    await registration.onMessage?.({
      data: JSON.stringify({
        kind: "call",
        requestId: "hl-1",
        method: "highlightNet",
        params: { net: "GND" }
      })
    } as MessageEvent<string>);

    const res1 = JSON.parse(sentMessages.at(-1)?.message ?? "{}");
    expect(res1.kind).toBe("result");
    expect(res1.result.highlighted).toBe(true);
    expect(res1.result.net).toBe("GND");

    // Clear highlights
    await registration.onMessage?.({
      data: JSON.stringify({
        kind: "call",
        requestId: "hl-2",
        method: "highlightNet",
        params: { clear: true }
      })
    } as MessageEvent<string>);

    const res2 = JSON.parse(sentMessages.at(-1)?.message ?? "{}");
    expect(res2.kind).toBe("result");
    expect(res2.result.cleared).toBe(true);
  });

  it("retrieves current canvas selection", async () => {
    const extension = await import("./index.js");
    extension.connect();

    await registration.onMessage?.({
      data: JSON.stringify({
        kind: "call",
        requestId: "sel-1",
        method: "getSelection",
        params: {}
      })
    } as MessageEvent<string>);

    const resultMessage = JSON.parse(sentMessages.at(-1)?.message ?? "{}");
    expect(resultMessage.kind).toBe("result");
    expect(resultMessage.result.count).toBe(1);
    expect(resultMessage.result.selection[0]).toMatchObject({
      id: "$u5",
      name: "U5"
    });
  });

  it("searches component library by query", async () => {
    const extension = await import("./index.js");
    extension.connect();

    await registration.onMessage?.({
      data: JSON.stringify({
        kind: "call",
        requestId: "lib-1",
        method: "searchLibrary",
        params: { query: "C1523" }
      })
    } as MessageEvent<string>);

    const resultMessage = JSON.parse(sentMessages.at(-1)?.message ?? "{}");
    expect(resultMessage.kind).toBe("result");
    expect(resultMessage.result.count).toBe(1);
    expect(resultMessage.result.results[0]).toMatchObject({
      lcscCode: "C1523",
      package: "0805",
      isJlcBasic: true
    });
  });
});
