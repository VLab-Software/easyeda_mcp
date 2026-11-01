import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBridgeConnection, WS_ID } from "./connection.js";

describe("Extension BridgeConnection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("registers websocket and transitions through connection lifecycle", async () => {
    let registeredOnMessage: ((event: MessageEvent<string>) => Promise<void>) | undefined;
    let registeredOnOpen: (() => Promise<void>) | undefined;
    const sentMessages: string[] = [];

    const mockApi = {
      sys_WebSocket: {
        register: vi.fn((_id: string, _uri: string, onMsg: any, onOpen: any) => {
          registeredOnMessage = onMsg;
          registeredOnOpen = onOpen;
        }),
        send: vi.fn((_id: string, data: string) => {
          sentMessages.push(data);
        })
      },
      sys_Dialog: {
        showInformationMessage: vi.fn()
      },
      dmt_SelectControl: {
        getCurrentDocumentInfo: vi.fn(async () => ({ uuid: "doc-1", name: "Board.pcb", documentType: 3 }))
      }
    };

    let connectionChangedCalled = false;
    const conn = createBridgeConnection({
      api: () => mockApi,
      bridgeConfig: {
        host: "127.0.0.1",
        port: 8765,
        openTimeoutMs: 2000,
        heartbeatIntervalMs: 10000,
        reconnectDelayMs: [0, 1000, 2000]
      },
      onMessage: async () => {},
      getCapabilities: () => ({ drcCheck: true }),
      onConnectionChanged: () => {
        connectionChangedCalled = true;
      }
    });

    expect(conn.getState().phase).toBe("idle");

    await conn.ensureConnected({ reason: "test", manual: false });
    expect(conn.getState().phase).toBe("connecting");
    expect(mockApi.sys_WebSocket.register).toHaveBeenCalledWith(
      WS_ID,
      "ws://127.0.0.1:8765",
      expect.any(Function),
      expect.any(Function)
    );

    // Trigger onOpen
    await registeredOnOpen?.();
    expect(conn.getState().phase).toBe("connected");
    expect(connectionChangedCalled).toBe(true);
    expect(sentMessages.length).toBeGreaterThan(0);

    const hello = JSON.parse(sentMessages[0]);
    expect(hello.kind).toBe("hello");
    expect(hello.capabilities).toEqual({ drcCheck: true });
    expect(hello.status.connected).toBe(true);
  });

  it("handles open timeout and schedules reconnection", async () => {
    const mockApi = {
      sys_WebSocket: {
        register: vi.fn(),
        send: vi.fn()
      },
      sys_Dialog: {
        showInformationMessage: vi.fn()
      }
    };

    const conn = createBridgeConnection({
      api: () => mockApi,
      bridgeConfig: {
        host: "127.0.0.1",
        port: 8765,
        openTimeoutMs: 1500,
        heartbeatIntervalMs: 10000,
        reconnectDelayMs: [0, 1000]
      },
      onMessage: async () => {},
      getCapabilities: () => ({})
    });

    await conn.ensureConnected({ reason: "timeout-test", manual: false });
    expect(conn.getState().phase).toBe("connecting");

    // Advance past timeout
    vi.advanceTimersByTime(1600);

    // After failure with retry left:
    expect(conn.getState().phase).toBe("idle");
    expect(conn.getState().lastError?.code).toBe("bridge_open_timeout");
  });
});
