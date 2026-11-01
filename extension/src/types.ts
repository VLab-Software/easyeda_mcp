export type EasyEdaApi = Record<string, any>;

export type RpcHandler = (params: Record<string, any>) => Promise<unknown> | unknown;
