import {
  buildSchematicSnapshot,
  findUnconnectedPins,
  getComponentPins,
  listSchematicComponents,
  traceComponent,
  traceNet,
  validateSchematicArea,
  verifyConnections,
  type RawSchematicData,
  type SchematicSnapshot
} from "../../../src/schematic/analysis.js";
import {
  ensureApi,
  optionalCall,
  sanitize,
  simplifyPrimitive,
  stringOrUndefined,
  toArray
} from "../helpers.js";
import type { EasyEdaApi, RpcHandler } from "../types.js";
import { getPcbComponents, getPcbNetNames } from "./pcbHandlers.js";

export async function getSchematicComponents(api: () => EasyEdaApi): Promise<unknown[]> {
  ensureApi("sch_PrimitiveComponent", "getAll", api());
  return toArray(await api().sch_PrimitiveComponent.getAll(undefined, true));
}

export async function collectSchematicSnapshot(
  api: () => EasyEdaApi,
  options: { includeRaw: boolean; allPages: boolean }
): Promise<SchematicSnapshot> {
  const eda = api();
  ensureApi("sch_PrimitiveComponent", "getAll", eda);
  const components = toArray(await eda.sch_PrimitiveComponent.getAll(undefined, options.allPages));
  const pinsByComponent: Record<string, unknown[]> = {};

  if (eda.sch_PrimitiveComponent?.getAllPinsByPrimitiveId) {
    for (const component of components) {
      const componentRecord = component && typeof component === "object" ? (component as Record<string, unknown>) : {};
      const primitiveId = stringOrUndefined(componentRecord.primitiveId ?? componentRecord.id ?? componentRecord.uuid);
      if (!primitiveId) {
        continue;
      }
      const pins = await optionalCall(() => eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primitiveId));
      pinsByComponent[primitiveId] = toArray(pins);
    }
  }

  const rawData: RawSchematicData = {
    components,
    pinsByComponent,
    wires: await optionalCall(() => (eda.sch_PrimitiveWire?.getAll ? eda.sch_PrimitiveWire.getAll() : [])),
    texts: await optionalCall(() => (eda.sch_PrimitiveText?.getAll ? eda.sch_PrimitiveText.getAll() : [])),
    includeRaw: options.includeRaw
  };
  return buildSchematicSnapshot(rawData);
}

export function createSchematicHandlers(api: () => EasyEdaApi): Record<string, RpcHandler> {
  async function schematicSnapshot(params: Record<string, any>): Promise<SchematicSnapshot> {
    return collectSchematicSnapshot(api, {
      includeRaw: params.includeRaw !== false,
      allPages: params.allPages !== false
    });
  }

  async function listSchematicComponentsTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const snapshot = await collectSchematicSnapshot(api, {
      includeRaw: params.includeRaw === true,
      allPages: params.allPages !== false
    });
    const components = listSchematicComponents(snapshot, stringOrUndefined(params.query), Number(params.limit ?? 100));
    return {
      components,
      count: components.length,
      totalComponents: snapshot.counts.components,
      confidence: snapshot.confidence,
      warnings: snapshot.warnings,
      betaApi: true
    };
  }

  async function getComponentPinsTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const snapshot = await collectSchematicSnapshot(api, {
      includeRaw: params.includeRaw !== false,
      allPages: params.allPages !== false
    });
    const result = getComponentPins(snapshot, String(params.query ?? ""));
    return {
      ...result,
      betaApi: true
    };
  }

  async function traceNetTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const snapshot = await collectSchematicSnapshot(api, {
      includeRaw: params.includeRaw !== false,
      allPages: params.allPages !== false
    });
    const result = traceNet(snapshot, String(params.query ?? ""));
    return {
      ...result,
      betaApi: true
    };
  }

  async function traceComponentTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const snapshot = await collectSchematicSnapshot(api, {
      includeRaw: params.includeRaw !== false,
      allPages: params.allPages !== false
    });
    const result = traceComponent(snapshot, String(params.query ?? ""));
    return {
      ...result,
      betaApi: true
    };
  }

  async function findUnconnectedPinsTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const snapshot = await collectSchematicSnapshot(api, {
      includeRaw: params.includeRaw !== false,
      allPages: params.allPages !== false
    });
    const result = findUnconnectedPins(snapshot, {
      includePowerPins: params.includePowerPins !== false,
      limit: Number(params.limit ?? 100)
    });
    return {
      ...result,
      betaApi: true
    };
  }

  async function validateSchematicAreaTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const snapshot = await collectSchematicSnapshot(api, {
      includeRaw: params.includeRaw !== false,
      allPages: params.allPages !== false
    });
    const result = validateSchematicArea(snapshot, {
      components: Array.isArray(params.components) ? params.components.map(String) : undefined,
      nets: Array.isArray(params.nets) ? params.nets.map(String) : undefined,
      includeGlobalChecks: params.includeGlobalChecks !== false
    });
    return {
      ...result,
      snapshotCounts: snapshot.counts,
      snapshotWarnings: snapshot.warnings,
      betaApi: true
    };
  }

  async function verifyConnectionsTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const snapshot = await collectSchematicSnapshot(api, {
      includeRaw: params.includeRaw !== false,
      allPages: params.allPages !== false
    });
    const result = verifyConnections(snapshot, Array.isArray(params.checks) ? params.checks : [], {
      maxHops: Number(params.maxHops ?? 4)
    });
    return {
      ...result,
      snapshotCounts: snapshot.counts,
      snapshotWarnings: snapshot.warnings,
      betaApi: true
    };
  }

  async function findComponent(params: Record<string, any>): Promise<Record<string, unknown>> {
    const query = String(params.query ?? "").toLowerCase();
    const limit = Number(params.limit ?? 20);
    const pcb = (await optionalCall(() => getPcbComponents(api))) ?? [];
    const schematic = (await optionalCall(() => getSchematicComponents(api))) ?? [];
    const all = [
      ...toArray(pcb).map((item) => ({ source: "pcb", item })),
      ...toArray(schematic).map((item) => ({ source: "schematic", item }))
    ];
    const matches = all.filter(({ item }) => JSON.stringify(item).toLowerCase().includes(query)).slice(0, limit);

    return {
      query,
      count: matches.length,
      matches: matches.map(({ source, item }) => ({ source, component: simplifyPrimitive(item) })),
      betaApi: true
    };
  }

  async function findNet(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    const query = String(params.query ?? "").toLowerCase();
    const limit = Number(params.limit ?? 20);
    const names = toArray(await getPcbNetNames(api)).filter((name) => String(name).toLowerCase().includes(query)).slice(0, limit);
    const nets = [];
    for (const name of names) {
      const detail = await optionalCall(() => (eda.pcb_Net?.getNet ? eda.pcb_Net.getNet(name) : undefined));
      const length = await optionalCall(() => (eda.pcb_Net?.getNetLength ? eda.pcb_Net.getNetLength(name) : undefined));
      nets.push({
        name,
        detail: sanitize(detail),
        length
      });
    }

    return {
      query,
      count: nets.length,
      nets,
      betaApi: true
    };
  }

  return {
    schematicSnapshot,
    listSchematicComponents: listSchematicComponentsTool,
    listSchematicComponentsTool,
    getComponentPins: getComponentPinsTool,
    getComponentPinsTool,
    traceNet: traceNetTool,
    traceNetTool,
    traceComponent: traceComponentTool,
    traceComponentTool,
    findUnconnectedPins: findUnconnectedPinsTool,
    findUnconnectedPinsTool,
    validateSchematicArea: validateSchematicAreaTool,
    validateSchematicAreaTool,
    verifyConnections: verifyConnectionsTool,
    verifyConnectionsTool,
    findComponent,
    findNet
  };
}
