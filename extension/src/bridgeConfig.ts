export type ExtensionBridgeConfig = {
  host: string;
  port: number;
  openTimeoutMs: number;
  heartbeatIntervalMs: number;
  reconnectDelayMs: number[];
};

type BridgeConfigOverride = Partial<ExtensionBridgeConfig>;

const defaultBridgeConfig: ExtensionBridgeConfig = {
  host: "127.0.0.1",
  port: 8765,
  openTimeoutMs: 2_500,
  heartbeatIntervalMs: 15_000,
  reconnectDelayMs: [0, 1_000, 2_500, 5_000]
};

function resolveOverrides(): BridgeConfigOverride {
  const globalOverride = (globalThis as { __EASYEDA_MCP_BRIDGE_CONFIG__?: BridgeConfigOverride }).__EASYEDA_MCP_BRIDGE_CONFIG__;
  return globalOverride ?? {};
}

export function getBridgeConfig(): ExtensionBridgeConfig {
  const override = resolveOverrides();
  return {
    ...defaultBridgeConfig,
    ...override,
    reconnectDelayMs: Array.isArray(override.reconnectDelayMs) && override.reconnectDelayMs.length > 0
      ? override.reconnectDelayMs.filter((delay) => Number.isFinite(delay) && delay >= 0)
      : defaultBridgeConfig.reconnectDelayMs
  };
}

export function getBridgeUri(config = getBridgeConfig()): string {
  return `ws://${config.host}:${config.port}`;
}
