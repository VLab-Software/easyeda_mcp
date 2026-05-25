import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import {
  type BridgeCallMessage,
  type ClientToServerMessage,
  createDisconnectedStatus,
  evaluateProtocolCompatibility,
  type EditorStatus,
  parseClientMessage
} from "../protocol/messages.js";
import { BridgeProtocolCompatibilityError, BridgeRpcError, BridgeTimeoutError, BridgeUnavailableError } from "./errors.js";

type PendingCall = {
  method: string;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: NodeJS.Timeout;
};

export type EasyEdaBridgeOptions = {
  host?: string;
  port?: number;
  logger?: Pick<Console, "error" | "warn" | "info">;
};

export class EasyEdaBridge {
  private readonly host: string;
  private readonly port: number;
  private readonly logger: Pick<Console, "error" | "warn" | "info">;
  private wss?: WebSocketServer;
  private socket?: WebSocket;
  private readonly pending = new Map<string, PendingCall>();
  private status: EditorStatus = createDisconnectedStatus();

  constructor(options: EasyEdaBridgeOptions = {}) {
    this.host = options.host ?? process.env.EASYEDA_MCP_WS_HOST ?? "127.0.0.1";
    this.port = options.port ?? Number(process.env.EASYEDA_MCP_WS_PORT ?? 8765);
    this.logger = options.logger ?? console;
  }

  get endpoint(): string {
    const address = this.wss?.address();
    const activePort = typeof address === "object" && address ? address.port : this.port;
    return `ws://${this.host}:${activePort}`;
  }

  getStatus(): EditorStatus {
    return this.status;
  }

  async start(): Promise<void> {
    if (this.wss) {
      return;
    }

    this.wss = new WebSocketServer({ host: this.host, port: this.port });
    this.wss.on("connection", (socket) => this.attachSocket(socket));
    await new Promise<void>((resolve, reject) => {
      this.wss?.once("listening", resolve);
      this.wss?.once("error", reject);
    });
    this.logger.error(`[easyeda-mcp] WebSocket bridge listening at ${this.endpoint}`);
  }

  async stop(): Promise<void> {
    this.rejectAll(new BridgeUnavailableError("EasyEDA Pro bridge is stopping."));
    this.socket?.close();
    await new Promise<void>((resolve, reject) => {
      if (!this.wss) {
        resolve();
        return;
      }
      this.wss.close((error) => (error ? reject(error) : resolve()));
    });
    this.wss = undefined;
    this.socket = undefined;
    this.status = createDisconnectedStatus();
  }

  async call(method: string, params?: unknown, timeoutMs = 10_000): Promise<unknown> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new BridgeUnavailableError();
    }

    if (this.status.compatibility && !this.status.compatibility.compatible) {
      throw new BridgeProtocolCompatibilityError(
        this.status.compatibility.reason ?? "EasyEDA Pro extension protocol is incompatible with the MCP server.",
        this.status.compatibility.expectedProtocolVersion,
        this.status.compatibility.actualProtocolVersion
      );
    }

    const requestId = randomUUID();
    const message: BridgeCallMessage = {
      kind: "call",
      requestId,
      method,
      params,
      timeoutMs
    };

    const response = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new BridgeTimeoutError(method, timeoutMs));
      }, timeoutMs);

      this.pending.set(requestId, {
        method,
        resolve,
        reject,
        timer
      });
    });

    this.socket.send(JSON.stringify(message));
    return response;
  }

  private attachSocket(socket: WebSocket): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.rejectAll(new BridgeUnavailableError("EasyEDA Pro extension reconnected. Retry the MCP tool call."));
      this.socket.close(1012, "A newer EasyEDA Pro extension connection replaced this one.");
    }

    this.socket = socket;
    this.status = {
      connected: true,
      connectionState: "connecting",
      message: "EasyEDA Pro extension connected. Waiting for hello/status.",
      updatedAt: new Date().toISOString()
    };
    this.logger.error("[easyeda-mcp] EasyEDA Pro extension connected");

    socket.on("message", (data) => {
      try {
        this.handleMessage(parseClientMessage(data.toString()));
      } catch (error) {
        this.logger.warn(`[easyeda-mcp] Ignored invalid bridge message: ${String(error)}`);
      }
    });

    socket.on("close", () => {
      if (this.socket === socket) {
        this.socket = undefined;
        this.status = createDisconnectedStatus("EasyEDA Pro extension disconnected. Keep the extension open or reopen EasyEDA Pro.");
        this.rejectAll(new BridgeUnavailableError(this.status.message));
      }
      this.logger.error("[easyeda-mcp] EasyEDA Pro extension disconnected");
    });
  }

  private handleMessage(message: ClientToServerMessage): void {
    if (message.kind === "hello") {
      const compatibility = evaluateProtocolCompatibility(message.protocolVersion);
      this.status = {
        connected: true,
        connectionState: compatibility.compatible ? "connected" : "blocked",
        extensionVersion: message.version,
        protocolVersion: message.protocolVersion,
        compatibility,
        capabilities: message.capabilities,
        ...message.status,
        message: compatibility.compatible
          ? message.status?.message
          : compatibility.reason,
        updatedAt: new Date().toISOString()
      };
      return;
    }

    if (message.kind === "status") {
      const reportedProtocolVersion = message.status.protocolVersion ?? this.status.protocolVersion;
      const compatibility = evaluateProtocolCompatibility(reportedProtocolVersion);
      this.status = {
        ...this.status,
        ...message.status,
        connected: true,
        connectionState: compatibility.compatible ? "connected" : "blocked",
        compatibility,
        message: compatibility.compatible
          ? message.status.message ?? this.status.message
          : compatibility.reason,
        updatedAt: new Date().toISOString()
      };
      return;
    }

    if (message.kind === "result") {
      const pending = this.pending.get(message.requestId);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(message.requestId);
      pending.resolve(message.result);
      return;
    }

    if (message.kind === "error") {
      const pending = this.pending.get(message.requestId);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(message.requestId);
      pending.reject(new BridgeRpcError(message.error.message, message.error.code, message.error.details));
    }
  }

  private rejectAll(error: Error): void {
    for (const [requestId, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(requestId);
    }
  }
}
