import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { installLifecycleHandlers } from "./lifecycle.js";

class MockProcess extends EventEmitter {
  readonly stdin = new EventEmitter();
  readonly exit = vi.fn<(code?: number) => never>();
}

describe("installLifecycleHandlers", () => {
  it("shuts down when stdin ends", async () => {
    const processRef = new MockProcess();
    const server = { close: vi.fn().mockResolvedValue(undefined) };
    const transport = { close: vi.fn().mockResolvedValue(undefined) };
    const bridge = { stop: vi.fn().mockResolvedValue(undefined) };

    installLifecycleHandlers({
      bridge: bridge as never,
      server: server as never,
      transport: transport as never,
      processRef,
      exitOnShutdown: false
    });

    processRef.stdin.emit("end");
    await vi.waitFor(() => {
      expect(server.close).toHaveBeenCalledTimes(1);
      expect(transport.close).toHaveBeenCalledTimes(1);
      expect(bridge.stop).toHaveBeenCalledTimes(1);
    });
  });

  it("runs shutdown only once when stdin emits both end and close", async () => {
    const processRef = new MockProcess();
    const server = { close: vi.fn().mockResolvedValue(undefined) };
    const transport = { close: vi.fn().mockResolvedValue(undefined) };
    const bridge = { stop: vi.fn().mockResolvedValue(undefined) };

    installLifecycleHandlers({
      bridge: bridge as never,
      server: server as never,
      transport: transport as never,
      processRef,
      exitOnShutdown: false
    });

    processRef.stdin.emit("end");
    processRef.stdin.emit("close");

    await vi.waitFor(() => {
      expect(server.close).toHaveBeenCalledTimes(1);
      expect(transport.close).toHaveBeenCalledTimes(1);
      expect(bridge.stop).toHaveBeenCalledTimes(1);
    });
  });
});
