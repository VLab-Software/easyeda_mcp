declare const eda: EasyEdaApi;

import { getBridgeConfig, getBridgeUri } from "./bridgeConfig.js";
import { createBridgeConnection, type BridgeConnection } from "./connection.js";
import { detectCapabilities, formatDiagnostics, formatStatusSummary } from "./diagnostics.js";
import { createDispatcher } from "./dispatcher.js";
import { DrcRules } from "./drcRules.js";
import { createActionHandlers } from "./handlers/actionHandlers.js";
import { createContextHandlers } from "./handlers/contextHandlers.js";
import { createExportHandlers } from "./handlers/exportHandlers.js";
import { createNavigationHandlers } from "./handlers/navigationHandlers.js";
import { createPcbHandlers } from "./handlers/pcbHandlers.js";
import { createSchematicHandlers } from "./handlers/schematicHandlers.js";
import { log, showMessage } from "./helpers.js";
import type { EasyEdaApi, RpcHandler } from "./types.js";

const getApi = (): EasyEdaApi => (typeof eda !== "undefined" ? eda : (globalThis as any).eda);

const bridgeConfig = getBridgeConfig();
const drcRules = new DrcRules(getApi);

const pcbHandlers = createPcbHandlers(getApi);
const schematicHandlers = createSchematicHandlers(getApi);
const exportHandlers = createExportHandlers(getApi);
const navigationHandlers = createNavigationHandlers(getApi, schematicHandlers.findComponent as any);
const actionHandlers = createActionHandlers(getApi, drcRules);

let bridgeConnection: BridgeConnection;

const contextHandlers = createContextHandlers(getApi, () => bridgeConnection.getStatus());

const handlers: Record<string, RpcHandler> = {
  getDrcRules: (params) => drcRules.read(params),
  prepareDrcEdit: (params) => drcRules.prepare(params),
  getDrcEditResult: (params) => drcRules.result(params),
  ...contextHandlers,
  ...schematicHandlers,
  ...navigationHandlers,
  ...exportHandlers,
  ...pcbHandlers,
  ...actionHandlers
};

bridgeConnection = createBridgeConnection({
  api: getApi,
  bridgeConfig,
  onMessage: (raw) => dispatchMessage(raw),
  getCapabilities: () => detectCapabilities(getApi, () => drcRules.capabilities()),
  onConnectionChanged: () => drcRules.connectionChanged()
});

const dispatchMessage = createDispatcher(handlers, (msg) => bridgeConnection.send(msg));

export function activate(status?: "onStartupFinished", arg?: string): void {
  log("warn", `EasyEDA MCP Bridge activated: ${status ?? "manual"} ${arg ?? ""}`);
  void bridgeConnection.ensureConnected({ reason: "activation", manual: false });
}

export function connect(): void {
  bridgeConnection.connect();
}

export function reconnect(): void {
  bridgeConnection.reconnect();
}

export async function showStatus(): Promise<void> {
  const diagnostics = await bridgeConnection.collectDiagnostics();
  showMessage("EasyEDA MCP Bridge Status", formatStatusSummary(diagnostics, getBridgeUri(bridgeConfig)));
}

export async function runDiagnostics(): Promise<void> {
  const diagnostics = await bridgeConnection.collectDiagnostics();
  showMessage("EasyEDA MCP Bridge Diagnostics", formatDiagnostics(diagnostics, getBridgeUri(bridgeConfig)));
}
