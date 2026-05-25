import process from "node:process";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { EasyEdaBridge } from "./bridge/EasyEdaBridge.js";

type ProcessLike = {
  exit(code?: number): never;
  once(event: string, listener: () => void): unknown;
  off(event: string, listener: () => void): unknown;
  stdin: {
    once(event: string, listener: () => void): unknown;
    off(event: string, listener: () => void): unknown;
  };
};

type LifecycleOptions = {
  bridge: EasyEdaBridge;
  server: McpServer;
  transport: StdioServerTransport;
  processRef?: ProcessLike;
  exitOnShutdown?: boolean;
};

export function installLifecycleHandlers(options: LifecycleOptions): { shutdown: () => Promise<void> } {
  const {
    bridge,
    server,
    transport,
    processRef = process,
    exitOnShutdown = true
  } = options;

  let shutdownPromise: Promise<void> | undefined;

  const shutdown = (): Promise<void> => {
    if (!shutdownPromise) {
      detach();
      shutdownPromise = (async () => {
        await Promise.allSettled([
          server.close(),
          transport.close(),
          bridge.stop()
        ]);
      })().finally(() => {
        if (exitOnShutdown) {
          processRef.exit(0);
        }
      });
    }

    return shutdownPromise;
  };

  const onSignal = () => {
    void shutdown();
  };

  const onStdinClosed = () => {
    void shutdown();
  };

  const detach = (): void => {
    processRef.off("SIGINT", onSignal);
    processRef.off("SIGTERM", onSignal);
    processRef.stdin.off("end", onStdinClosed);
    processRef.stdin.off("close", onStdinClosed);
  };

  processRef.once("SIGINT", onSignal);
  processRef.once("SIGTERM", onSignal);
  processRef.stdin.once("end", onStdinClosed);
  processRef.stdin.once("close", onStdinClosed);

  return { shutdown };
}
