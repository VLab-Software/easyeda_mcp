import {
  PROTOCOL_VERSION,
  evaluateProtocolCompatibility,
  type ProtocolCompatibility,
  type BridgeErrorMessage
} from "../../src/protocol/messages.js";
import { EXTENSION_VERSION } from "../../src/version.js";
import { getBridgeUri, type ExtensionBridgeConfig } from "./bridgeConfig.js";
import {
  collectDiagnostics as collectDiagnosticsHelper,
  diagnosticHints,
  isPermissionLikeError
} from "./diagnostics.js";
import {
  apiError,
  ensureApi,
  inferDocumentType,
  log,
  normalizeError,
  optionalCall,
  pickString,
  sanitize,
  showMessage
} from "./helpers.js";
import type { EasyEdaApi } from "./types.js";

export const WS_ID = "easyeda-mcp-bridge";

export type ConnectionPhase = "idle" | "connecting" | "connected" | "blocked";

export type ConnectionState = {
  phase: ConnectionPhase;
  attemptIndex: number;
  lastError?: BridgeErrorMessage["error"];
  lastOpenAt?: string;
  lastStatusAt?: string;
  lastHandshakeAt?: string;
  lastAttemptAt?: string;
  connectedOnce: boolean;
  compatibility: ProtocolCompatibility;
  reconnectTimer?: ReturnType<typeof setTimeout>;
  openTimeoutTimer?: ReturnType<typeof setTimeout>;
  heartbeatTimer?: ReturnType<typeof setInterval>;
};

export interface BridgeConnectionOptions {
  api: () => EasyEdaApi;
  bridgeConfig: ExtensionBridgeConfig;
  onMessage: (raw: string) => Promise<void>;
  getCapabilities: () => Record<string, unknown>;
  onConnectionChanged?: () => void;
}

export interface BridgeConnection {
  ensureConnected(options: { reason: string; manual: boolean; resetAttempts?: boolean }): Promise<void>;
  connect(): void;
  reconnect(): void;
  send(message: Record<string, unknown>): void;
  getStatus(): Promise<Record<string, unknown>>;
  emitStatusUpdate(): Promise<void>;
  collectDiagnostics(): Promise<Record<string, unknown>>;
  getState(): Readonly<ConnectionState>;
}

export function createBridgeConnection(options: BridgeConnectionOptions): BridgeConnection {
  const { api, bridgeConfig, onMessage, getCapabilities, onConnectionChanged } = options;

  const connectionState: ConnectionState = {
    phase: "idle",
    attemptIndex: 0,
    connectedOnce: false,
    compatibility: evaluateProtocolCompatibility(PROTOCOL_VERSION)
  };

  function clearOpenTimeout(): void {
    if (connectionState.openTimeoutTimer) {
      clearTimeout(connectionState.openTimeoutTimer);
      connectionState.openTimeoutTimer = undefined;
    }
  }

  function resetConnectionTimers(): void {
    clearOpenTimeout();
    if (connectionState.reconnectTimer) {
      clearTimeout(connectionState.reconnectTimer);
      connectionState.reconnectTimer = undefined;
    }
    if (connectionState.heartbeatTimer) {
      clearInterval(connectionState.heartbeatTimer);
      connectionState.heartbeatTimer = undefined;
    }
  }

  function send(message: Record<string, unknown>): void {
    ensureApi("sys_WebSocket", "send", api());
    try {
      api().sys_WebSocket.send(WS_ID, JSON.stringify(message));
    } catch (error) {
      handleConnectionFailure(normalizeError(error), {
        manual: false,
        shouldRetry: true
      });
      throw error;
    }
  }

  async function getStatus(): Promise<Record<string, unknown>> {
    const documentInfo = await optionalCall(() => api().dmt_SelectControl?.getCurrentDocumentInfo?.());
    return {
      connected: connectionState.phase === "connected",
      connectionState: connectionState.phase,
      extensionVersion: EXTENSION_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      compatibility: connectionState.compatibility,
      capabilities: getCapabilities(),
      activeDocumentType: inferDocumentType(documentInfo),
      projectName: pickString(documentInfo, ["projectName", "project", "parentName"]),
      documentName: pickString(documentInfo, ["name", "title", "documentName"]),
      message: connectionState.lastError?.message,
      documentInfo: sanitize(documentInfo),
      updatedAt: new Date().toISOString()
    };
  }

  async function emitStatusUpdate(): Promise<void> {
    send({
      kind: "status",
      compatibility: connectionState.compatibility,
      status: await getStatus()
    });
    connectionState.lastStatusAt = new Date().toISOString();
  }

  function startHeartbeat(): void {
    if (connectionState.heartbeatTimer) {
      clearInterval(connectionState.heartbeatTimer);
    }
    connectionState.heartbeatTimer = setInterval(() => {
      void emitStatusUpdate().catch((error) => {
        handleConnectionFailure(normalizeError(error), {
          manual: false,
          shouldRetry: true
        });
      });
    }, bridgeConfig.heartbeatIntervalMs);
  }

  function handleConnectionFailure(
    error: BridgeErrorMessage["error"],
    failureOptions: { manual: boolean; shouldRetry: boolean }
  ): void {
    onConnectionChanged?.();
    clearOpenTimeout();
    if (connectionState.heartbeatTimer) {
      clearInterval(connectionState.heartbeatTimer);
      connectionState.heartbeatTimer = undefined;
    }

    connectionState.lastError = error;
    connectionState.compatibility = evaluateProtocolCompatibility(PROTOCOL_VERSION);
    connectionState.phase = isPermissionLikeError(error) ? "blocked" : "idle";

    const hasRetryLeft = failureOptions.shouldRetry && connectionState.attemptIndex < bridgeConfig.reconnectDelayMs.length - 1;
    if (hasRetryLeft) {
      const nextAttempt = connectionState.attemptIndex + 1;
      const delayMs = bridgeConfig.reconnectDelayMs[nextAttempt];
      connectionState.attemptIndex = nextAttempt;
      connectionState.reconnectTimer = setTimeout(() => {
        connectionState.reconnectTimer = undefined;
        void ensureConnected({
          reason: "retry",
          manual: false
        });
      }, delayMs);
    }

    if (failureOptions.manual || !hasRetryLeft || connectionState.phase === "blocked") {
      showMessage("EasyEDA MCP Bridge", [
        error.message,
        "",
        ...diagnosticHints(error, bridgeConfig)
      ].join("\n"));
    }
  }

  async function startBridge(startOptions: { reason: string; manual: boolean }): Promise<void> {
    ensureApi("sys_WebSocket", "register", api());
    resetConnectionTimers();
    connectionState.phase = "connecting";
    connectionState.lastAttemptAt = new Date().toISOString();

    const wsUri = getBridgeUri(bridgeConfig);
    const attemptIndex = connectionState.attemptIndex;
    const openTimeoutMs = bridgeConfig.openTimeoutMs;

    connectionState.openTimeoutTimer = setTimeout(() => {
      const error = apiError("bridge_open_timeout", `Timed out waiting for EasyEDA MCP Bridge to open ${wsUri}.`);
      handleConnectionFailure(normalizeError(error), {
        manual: startOptions.manual,
        shouldRetry: true
      });
    }, openTimeoutMs);

    try {
      api().sys_WebSocket.register(
        WS_ID,
        wsUri,
        async (event: MessageEvent<string>) => {
          await onMessage(event.data);
        },
        async () => {
          onConnectionChanged?.();
          connectionState.phase = "connected";
          connectionState.lastOpenAt = new Date().toISOString();
          connectionState.lastHandshakeAt = connectionState.lastOpenAt;
          connectionState.lastError = undefined;
          connectionState.compatibility = evaluateProtocolCompatibility(PROTOCOL_VERSION);
          connectionState.attemptIndex = 0;
          clearOpenTimeout();
          send({
            kind: "hello",
            client: "easyeda-pro-extension",
            version: EXTENSION_VERSION,
            protocolVersion: PROTOCOL_VERSION,
            compatibility: connectionState.compatibility,
            capabilities: getCapabilities(),
            status: await getStatus()
          });
          startHeartbeat();
          if (!connectionState.connectedOnce || startOptions.manual) {
            connectionState.connectedOnce = true;
            showMessage("EasyEDA MCP Bridge", `Connected to ${wsUri}.`);
          }
        }
      );
    } catch (error) {
      handleConnectionFailure(normalizeError(error), {
        manual: startOptions.manual,
        shouldRetry: true
      });
      return;
    }

    log("warn", `Bridge connection attempt ${attemptIndex + 1} started for ${startOptions.reason} -> ${wsUri}`);
  }

  async function ensureConnected(connectOptions: { reason: string; manual: boolean; resetAttempts?: boolean }): Promise<void> {
    if (connectOptions.resetAttempts) {
      connectionState.attemptIndex = 0;
    }

    if (connectionState.phase === "connecting") {
      return;
    }

    if (connectionState.phase === "connected" && !connectOptions.manual) {
      return;
    }

    await startBridge(connectOptions);
  }

  return {
    ensureConnected,
    connect(): void {
      void ensureConnected({ reason: "manual-connect", manual: true, resetAttempts: true });
    },
    reconnect(): void {
      onConnectionChanged?.();
      resetConnectionTimers();
      connectionState.phase = "idle";
      connectionState.attemptIndex = 0;
      void ensureConnected({ reason: "manual-reconnect", manual: true, resetAttempts: true });
    },
    send,
    getStatus,
    emitStatusUpdate,
    collectDiagnostics: () => collectDiagnosticsHelper(api, bridgeConfig, connectionState),
    getState: () => connectionState
  };
}
