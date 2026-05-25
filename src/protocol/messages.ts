export const PROTOCOL_VERSION = "0.1.0";

export type BridgeCapabilities = {
  websocket: boolean;
  pcbDocument: boolean;
  schDocument: boolean;
  pcbManufactureData: boolean;
  schManufactureData: boolean;
  fileSystem: boolean;
};

export type EditorStatus = {
  connected: boolean;
  extensionVersion?: string;
  protocolVersion?: string;
  capabilities?: Partial<BridgeCapabilities>;
  activeDocumentType?: "pcb" | "schematic" | "symbol" | "footprint" | "unknown";
  projectName?: string;
  documentName?: string;
  message?: string;
  updatedAt: string;
};

export type BridgeHelloMessage = {
  kind: "hello";
  client: "easyeda-pro-extension";
  version: string;
  protocolVersion: string;
  capabilities: Partial<BridgeCapabilities>;
  status?: Partial<EditorStatus>;
};

export type BridgeStatusMessage = {
  kind: "status";
  status: Partial<EditorStatus>;
};

export type BridgeEventMessage = {
  kind: "event";
  event: string;
  payload?: unknown;
};

export type BridgeCallMessage = {
  kind: "call";
  requestId: string;
  method: string;
  params?: unknown;
  timeoutMs?: number;
};

export type BridgeResultMessage = {
  kind: "result";
  requestId: string;
  result: unknown;
};

export type BridgeErrorMessage = {
  kind: "error";
  requestId: string;
  error: {
    code?: string;
    message: string;
    details?: unknown;
  };
};

export type ClientToServerMessage =
  | BridgeHelloMessage
  | BridgeStatusMessage
  | BridgeEventMessage
  | BridgeResultMessage
  | BridgeErrorMessage;

export type ServerToClientMessage = BridgeCallMessage;

export type RpcErrorPayload = BridgeErrorMessage["error"];

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseClientMessage(raw: string): ClientToServerMessage {
  const parsed = JSON.parse(raw) as unknown;
  if (!isObject(parsed) || typeof parsed.kind !== "string") {
    throw new Error("Bridge message must be a JSON object with a string kind.");
  }

  switch (parsed.kind) {
    case "hello":
    case "status":
    case "event":
    case "result":
    case "error":
      return parsed as ClientToServerMessage;
    default:
      throw new Error(`Unsupported bridge message kind: ${parsed.kind}`);
  }
}

export function createDisconnectedStatus(message = "EasyEDA Pro extension is not connected. Open EasyEDA Pro, install the extension, and enable external interaction permission."): EditorStatus {
  return {
    connected: false,
    message,
    updatedAt: new Date().toISOString()
  };
}
