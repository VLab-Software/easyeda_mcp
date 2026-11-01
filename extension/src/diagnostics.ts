import type { BridgeErrorMessage, ProtocolCompatibility } from "../../src/protocol/messages.js";
import { getBridgeUri, type ExtensionBridgeConfig } from "./bridgeConfig.js";
import { optionalCall } from "./helpers.js";
import { detectMethodCapabilities, extractDocumentIdentity } from "./identity.js";
import type { EasyEdaApi } from "./types.js";

export function detectCapabilities(
  api: () => EasyEdaApi,
  drcCapabilities?: () => Record<string, boolean>
): Record<string, unknown> {
  const eda = api();
  return {
    methods: detectMethodCapabilities(api),
    drcRules: drcCapabilities ? drcCapabilities() : {},
    drcCheck: Boolean(eda.pcb_Drc?.check),
    pcbLayers: Boolean(eda.pcb_Layer?.getAllLayers),
    pcbNet: Boolean(eda.pcb_Net?.getAllNetsName || eda.pcb_Net?.getAllNetName),
    pickAndPlace: Boolean(eda.pcb_ManufactureData?.getPickAndPlaceFile),
    highlightNet: Boolean(eda.pcb_Net?.highlightNet),
    selection: Boolean(
      eda.dmt_SelectControl?.getSelectedPrimitives ||
      eda.dmt_SelectControl?.getAllSelectedPrimitives ||
      eda.dmt_SelectControl?.getSelected
    ),
    librarySearch: Boolean(eda.lib_Device?.search || eda.lib_Search?.search),
    websocket: Boolean(eda.sys_WebSocket?.register && eda.sys_WebSocket?.send),
    pcbDocument: Boolean(eda.pcb_Document),
    schDocument: Boolean(eda.sch_Document),
    pcbManufactureData: Boolean(eda.pcb_ManufactureData),
    schManufactureData: Boolean(eda.sch_ManufactureData),
    fileSystem: Boolean(eda.sys_FileSystem?.saveFile)
  };
}

export function isPermissionLikeError(error?: BridgeErrorMessage["error"]): boolean {
  const message = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  return (
    message.includes("permission") || message.includes("external interaction") || message.includes("sys_websocket")
  );
}

export function diagnosticHints(error?: BridgeErrorMessage["error"], bridgeConfig?: ExtensionBridgeConfig): string[] {
  if (isPermissionLikeError(error)) {
    return [
      "Enable external interaction/WebSocket permission for the extension in EasyEDA Pro.",
      "Reload the extension and let it auto-connect again."
    ];
  }

  if (error?.code === "bridge_open_timeout") {
    const uri = bridgeConfig ? getBridgeUri(bridgeConfig) : "the configured bridge URI";
    return ["Make sure the MCP server is running locally.", `Confirm the bridge endpoint is reachable at ${uri}.`];
  }

  return [
    "Keep EasyEDA Pro open while the MCP server is running.",
    "Use Reconnect or Run Diagnostics from the extension menu if the bridge stays unavailable."
  ];
}

export function formatStatusSummary(diagnostics: Record<string, unknown>, bridgeUri: string): string {
  const connection = (diagnostics.connection ?? {}) as Record<string, unknown>;
  const document = (diagnostics.activeDocument ?? {}) as Record<string, unknown>;
  return [
    `Bridge URI: ${bridgeUri}`,
    `Connection phase: ${String(connection.phase ?? "unknown")}`,
    `Last open: ${String(connection.lastOpenAt ?? "never")}`,
    `Document: ${String(document.documentName ?? document.projectName ?? "none")}`
  ].join("\n");
}

export function formatDiagnostics(diagnostics: Record<string, unknown>, bridgeUri: string): string {
  const websocket = (diagnostics.websocket ?? {}) as Record<string, unknown>;
  const connection = (diagnostics.connection ?? {}) as Record<string, unknown>;
  const document = (diagnostics.activeDocument ?? {}) as Record<string, unknown>;
  const nextSteps = Array.isArray(diagnostics.nextSteps) ? (diagnostics.nextSteps as string[]) : [];

  return [
    `Bridge URI: ${bridgeUri}`,
    `WebSocket register available: ${String(websocket.registerAvailable)}`,
    `WebSocket send available: ${String(websocket.sendAvailable)}`,
    `Connection phase: ${String(connection.phase ?? "unknown")}`,
    `Last open: ${String(connection.lastOpenAt ?? "never")}`,
    `Last status: ${String(connection.lastStatusAt ?? "never")}`,
    `Compatibility: ${String((connection.compatibility as Record<string, unknown>)?.compatible ?? false)}`,
    `Document: ${String(document.documentName ?? document.projectName ?? "none")}`,
    nextSteps.length > 0 ? `Next steps:\n- ${nextSteps.join("\n- ")}` : "Next steps: none"
  ].join("\n");
}

export async function collectDiagnostics(
  api: () => EasyEdaApi,
  bridgeConfig: ExtensionBridgeConfig,
  state: {
    phase: string;
    connectedOnce: boolean;
    lastAttemptAt?: string;
    lastOpenAt?: string;
    lastHandshakeAt?: string;
    lastStatusAt?: string;
    lastError?: BridgeErrorMessage["error"];
    compatibility: ProtocolCompatibility;
  }
): Promise<Record<string, unknown>> {
  const eda = api();
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const documentIdentity = extractDocumentIdentity(documentInfo);
  return {
    bridge: {
      uri: getBridgeUri(bridgeConfig),
      config: bridgeConfig
    },
    websocket: {
      registerAvailable: Boolean(eda.sys_WebSocket?.register),
      sendAvailable: Boolean(eda.sys_WebSocket?.send)
    },
    connection: {
      phase: state.phase,
      connectedOnce: state.connectedOnce,
      lastAttemptAt: state.lastAttemptAt,
      lastOpenAt: state.lastOpenAt,
      lastHandshakeAt: state.lastHandshakeAt,
      lastStatusAt: state.lastStatusAt,
      lastError: state.lastError,
      compatibility: state.compatibility
    },
    activeDocument: {
      available: Boolean(documentInfo),
      identity: documentIdentity,
      type: documentIdentity.documentType,
      projectName: documentIdentity.projectName,
      documentName: documentIdentity.documentName
    },
    nextSteps: diagnosticHints(state.lastError, bridgeConfig)
  };
}
