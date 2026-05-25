export class BridgeUnavailableError extends Error {
  constructor(message = "EasyEDA Pro extension is not connected. Open EasyEDA Pro, install the extension, and enable external interaction permission.") {
    super(message);
    this.name = "BridgeUnavailableError";
  }
}

export class BridgeRpcError extends Error {
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "BridgeRpcError";
    this.code = code;
    this.details = details;
  }
}

export class BridgeTimeoutError extends Error {
  constructor(method: string, timeoutMs: number) {
    super(`Timed out waiting ${timeoutMs}ms for EasyEDA Pro extension method "${method}".`);
    this.name = "BridgeTimeoutError";
  }
}
