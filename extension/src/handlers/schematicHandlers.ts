import { collectNativeNetlist } from "./nativeNetlist.js";
import {
  assertSnapshotFresh,
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
import { assertDocumentTargetMatch, extractDocumentIdentity, type DocumentIdentity } from "../identity.js";
import {
  apiError,
  ensureApi,
  optionalCall,
  sanitize,
  simplifyPrimitive,
  stringOrUndefined,
  toArray
} from "../helpers.js";
import type { EasyEdaApi, RpcHandler } from "../types.js";
import { fetchSchematicPortsBusesReport } from "../mutation/schematicPortBusMutations.js";
import { getPcbComponents, getPcbNetNames } from "./pcbHandlers.js";

export async function getSchematicComponents(api: () => EasyEdaApi): Promise<unknown[]> {
  ensureApi("sch_PrimitiveComponent", "getAll", api());
  return toArray(await api().sch_PrimitiveComponent.getAll(undefined, true));
}

export async function collectSchematicSnapshot(
  api: () => EasyEdaApi,
  options: { includeRaw: boolean; allPages: boolean; expectedTarget?: Partial<DocumentIdentity> }
): Promise<SchematicSnapshot> {
  const eda = api();
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const target = extractDocumentIdentity(documentInfo, undefined, "native_api");

  if (options.expectedTarget) {
    assertDocumentTargetMatch(options.expectedTarget, target);
  }

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
    target,
    source: "native_api",
    capturedAt: target.capturedAt,
    components,
    pinsByComponent,
    wires: await optionalCall(() => (eda.sch_PrimitiveWire?.getAll ? eda.sch_PrimitiveWire.getAll() : [])),
    texts: await optionalCall(() => (eda.sch_PrimitiveText?.getAll ? eda.sch_PrimitiveText.getAll() : [])),
    includeRaw: options.includeRaw,
    nativeNetlist: await collectNativeNetlist(eda, options.allPages)
  };
  const afterInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
  assertDocumentTargetMatch(target, extractDocumentIdentity(afterInfo, undefined, "native_api"));
  return buildSchematicSnapshot(rawData);
}

export function createSchematicHandlers(api: () => EasyEdaApi): Record<string, RpcHandler> {
  let cachedSnapshot: SchematicSnapshot | undefined;

  async function getOrFetchSnapshot(params: Record<string, any>, includeRawDefault = true): Promise<SchematicSnapshot> {
    const eda = api();
    const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const currentTarget = extractDocumentIdentity(documentInfo, undefined, "native_api");

    if (params.snapshotId && cachedSnapshot && cachedSnapshot.snapshotId === params.snapshotId) {
      assertSnapshotFresh(cachedSnapshot, { currentTarget, maxAgeMs: 5 * 60_000 });
      return cachedSnapshot;
    }

    if (params.expectedTarget) {
      assertDocumentTargetMatch(params.expectedTarget, currentTarget);
    }

    const fresh = await collectSchematicSnapshot(api, {
      includeRaw: params.includeRaw ?? includeRawDefault,
      allPages: params.allPages !== false,
      expectedTarget: params.expectedTarget
    });
    cachedSnapshot = fresh;
    return fresh;
  }

  async function schematicSnapshot(params: Record<string, any>): Promise<SchematicSnapshot> {
    return getOrFetchSnapshot(params, params.includeRaw !== false);
  }

  async function listSchematicComponentsTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const snapshot = await getOrFetchSnapshot(params, params.includeRaw === true);
    const components = listSchematicComponents(snapshot, stringOrUndefined(params.query), Number(params.limit ?? 100));
    return {
      snapshotId: snapshot.snapshotId,
      target: snapshot.target,
      completeness: snapshot.completeness,
      source: snapshot.source,
      capturedAt: snapshot.capturedAt,
      components,
      count: components.length,
      totalComponents: snapshot.counts.components,
      confidence: snapshot.confidence,
      warnings: snapshot.warnings,
      betaApi: true
    };
  }

  async function getComponentPinsTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const snapshot = await getOrFetchSnapshot(params, params.includeRaw !== false);
    const result = getComponentPins(snapshot, String(params.query ?? ""));
    return {
      snapshotId: snapshot.snapshotId,
      target: snapshot.target,
      completeness: snapshot.completeness,
      source: snapshot.source,
      capturedAt: snapshot.capturedAt,
      ...result,
      betaApi: true
    };
  }

  async function traceNetTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const snapshot = await getOrFetchSnapshot(params, params.includeRaw !== false);
    const result = traceNet(snapshot, String(params.query ?? ""));
    return {
      snapshotId: snapshot.snapshotId,
      target: snapshot.target,
      completeness: snapshot.completeness,
      source: snapshot.source,
      capturedAt: snapshot.capturedAt,
      ...result,
      betaApi: true
    };
  }

  async function traceComponentTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const snapshot = await getOrFetchSnapshot(params, params.includeRaw !== false);
    const result = traceComponent(snapshot, String(params.query ?? ""));
    return {
      snapshotId: snapshot.snapshotId,
      target: snapshot.target,
      completeness: snapshot.completeness,
      source: snapshot.source,
      capturedAt: snapshot.capturedAt,
      ...result,
      betaApi: true
    };
  }

  async function findUnconnectedPinsTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const snapshot = await getOrFetchSnapshot(params, params.includeRaw !== false);
    const result = findUnconnectedPins(snapshot, {
      includePowerPins: params.includePowerPins !== false,
      limit: Number(params.limit ?? 100)
    });
    return {
      snapshotId: snapshot.snapshotId,
      target: snapshot.target,
      completeness: snapshot.completeness,
      source: snapshot.source,
      capturedAt: snapshot.capturedAt,
      ...result,
      betaApi: true
    };
  }

  async function validateSchematicAreaTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const snapshot = await getOrFetchSnapshot(params, params.includeRaw !== false);
    const result = validateSchematicArea(snapshot, {
      components: Array.isArray(params.components) ? params.components.map(String) : undefined,
      nets: Array.isArray(params.nets) ? params.nets.map(String) : undefined,
      includeGlobalChecks: params.includeGlobalChecks !== false
    });
    return {
      snapshotId: snapshot.snapshotId,
      target: snapshot.target,
      completeness: snapshot.completeness,
      source: snapshot.source,
      capturedAt: snapshot.capturedAt,
      ...result,
      snapshotCounts: snapshot.counts,
      snapshotWarnings: snapshot.warnings,
      betaApi: true
    };
  }

  async function verifyConnectionsTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const snapshot = await getOrFetchSnapshot(params, params.includeRaw !== false);
    const result = verifyConnections(snapshot, Array.isArray(params.checks) ? params.checks : [], {
      maxHops: Number(params.maxHops ?? 4)
    });
    return {
      snapshotId: snapshot.snapshotId,
      target: snapshot.target,
      completeness: snapshot.completeness,
      source: snapshot.source,
      capturedAt: snapshot.capturedAt,
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
    const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const currentTarget = extractDocumentIdentity(documentInfo, undefined, "native_api");

    const nets: Array<{
      name: string;
      source: "native_schematic" | "native_pcb" | "inferred_schematic";
      detail?: unknown;
      length?: unknown;
    }> = [];

    // Query native schematic nets if available
    if (eda.sch_Net && (eda.sch_Net.getAllNetsName || eda.sch_Net.getAllNetName || eda.sch_Net.getAllNets)) {
      const rawSchNets: unknown[] = toArray(
        eda.sch_Net.getAllNetsName
          ? await optionalCall(() => eda.sch_Net.getAllNetsName())
          : eda.sch_Net.getAllNetName
            ? await optionalCall(() => eda.sch_Net.getAllNetName())
            : await optionalCall(() => eda.sch_Net.getAllNets())
      );
      for (const item of rawSchNets) {
        const name = typeof item === "string" ? item : String((item as any)?.name ?? (item as any)?.net ?? "");
        if (name && name.toLowerCase().includes(query)) {
          nets.push({
            name,
            source: "native_schematic",
            detail: sanitize(item)
          });
          if (nets.length >= limit) break;
        }
      }
    }

    // Query PCB nets if limit permits
    if (nets.length < limit) {
      const pcbNetNames = toArray(await optionalCall(() => getPcbNetNames(api)))
        .filter((name) => String(name).toLowerCase().includes(query))
        .slice(0, limit - nets.length);

      for (const name of pcbNetNames) {
        const strName = String(name);
        if (!nets.some((n) => n.name === strName)) {
          const detail = await optionalCall(() => (eda.pcb_Net?.getNet ? eda.pcb_Net.getNet(strName) : undefined));
          const length = await optionalCall(() =>
            eda.pcb_Net?.getNetLength ? eda.pcb_Net.getNetLength(strName) : undefined
          );
          nets.push({
            name: strName,
            source: "native_pcb",
            detail: sanitize(detail),
            length
          });
        }
      }
    }

    return {
      query,
      count: nets.length,
      nets,
      target: currentTarget,
      betaApi: true
    };
  }

  async function getSchematicNetsTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const currentTarget = extractDocumentIdentity(documentInfo, undefined, "native_api");

    const expectedTarget = params.expectedTarget ?? params.target;
    if (expectedTarget) {
      assertDocumentTargetMatch(expectedTarget, currentTarget);
    }

    if (currentTarget.documentType && currentTarget.documentType !== "schematic") {
      throw apiError("wrong_document", "Schematic net query requires an active schematic document.");
    }

    const hasNativeNetApi = Boolean(
      eda.sch_Net?.getAllNetsName || eda.sch_Net?.getAllNetName || eda.sch_Net?.getAllNets
    );

    if (!hasNativeNetApi) {
      return {
        available: false,
        status: "unavailable",
        source: "native_api",
        target: currentTarget,
        capturedAt: currentTarget.capturedAt,
        reason:
          "Native schematic net API (sch_Net.getAllNetsName) is not available in the connected EasyEDA Pro version.",
        totalNets: 0,
        nets: [],
        confidence: "none",
        completeness: "empty",
        warnings: ["Native schematic net API is unavailable in the connected EasyEDA Pro version."],
        betaApi: true
      };
    }

    let rawNets: unknown[];
    if (eda.sch_Net.getAllNetsName) {
      rawNets = toArray(await eda.sch_Net.getAllNetsName(params.pageId ?? params.pageIndex, params.allPages !== false));
    } else if (eda.sch_Net.getAllNetName) {
      rawNets = toArray(await eda.sch_Net.getAllNetName(params.pageId ?? params.pageIndex, params.allPages !== false));
    } else {
      rawNets = toArray(await eda.sch_Net.getAllNets(params.pageId ?? params.pageIndex, params.allPages !== false));
    }

    const netNames = Array.from(
      new Set(
        rawNets
          .map((n) => {
            if (typeof n === "string") return n.trim();
            if (n && typeof n === "object") {
              const rec = n as Record<string, unknown>;
              return String(rec.name ?? rec.net ?? rec.netName ?? "").trim();
            }
            return "";
          })
          .filter((name) => name.length > 0)
      )
    ).sort();

    const rawComponents = await optionalCall(() =>
      eda.sch_PrimitiveComponent?.getAll ? eda.sch_PrimitiveComponent.getAll(undefined, false) : []
    );
    const componentCount = Array.isArray(rawComponents) ? rawComponents.length : 0;

    const warnings: string[] = [];
    let status: "complete" | "inconclusive" = "complete";
    let confidence: "high" | "partial" | "low" = "high";
    let completeness: "full" | "partial" | "empty" = "full";

    if (netNames.length === 0) {
      if (componentCount > 0) {
        status = "inconclusive";
        confidence = "low";
        completeness = "partial";
        warnings.push(
          `Native net query returned 0 nets while ${componentCount} components exist on the schematic sheet.`
        );
      } else {
        completeness = "empty";
      }
    }

    return {
      available: true,
      status,
      source: "native_api",
      target: currentTarget,
      capturedAt: currentTarget.capturedAt,
      totalNets: netNames.length,
      nets: netNames,
      confidence,
      completeness,
      warnings,
      rawResult: params.includeRaw ? sanitize(rawNets) : undefined,
      betaApi: true
    };
  }

  async function runSchematicErcTool(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
    const currentTarget = extractDocumentIdentity(documentInfo, undefined, "native_api");

    const expectedTarget = params.expectedTarget ?? params.target;
    if (expectedTarget) {
      assertDocumentTargetMatch(expectedTarget, currentTarget);
    }

    if (currentTarget.documentType && currentTarget.documentType !== "schematic") {
      throw apiError("wrong_document", "Schematic ERC requires an active schematic document.");
    }

    const hasNativeErcApi = Boolean(eda.sch_Drc?.check);
    if (!hasNativeErcApi) {
      return {
        available: false,
        status: "unavailable",
        source: "native_api",
        target: currentTarget,
        capturedAt: currentTarget.capturedAt,
        reason: "Native schematic ERC API (sch_Drc.check) is not available in the connected EasyEDA Pro version.",
        passed: false,
        violationsCount: 0,
        errorsCount: 0,
        warningsCount: 0,
        violations: [],
        warnings: ["Native schematic ERC check is unavailable in the connected EasyEDA Pro version."],
        betaApi: true
      };
    }

    const strict = params.strict !== false;
    const startedAt = Date.now();
    let rawResult: unknown;
    try {
      rawResult = await eda.sch_Drc.check(strict, false, true);
    } catch {
      rawResult = await eda.sch_Drc.check(strict);
    }
    const durationMs = Date.now() - startedAt;

    let violations: unknown[] = [];
    let passed: boolean;
    let errorsCount = 0;
    let warningsCount = 0;
    const warnings: string[] = [];
    let status: "passed" | "violations_found" | "inconclusive";

    if (Array.isArray(rawResult)) {
      violations = rawResult;
      errorsCount = rawResult.length;
      passed = errorsCount === 0;
      status = passed ? "passed" : "violations_found";
    } else if (rawResult && typeof rawResult === "object") {
      const rawObj = rawResult as Record<string, any>;
      if (Array.isArray(rawObj.errors)) {
        errorsCount = rawObj.errors.length;
        violations = violations.concat(rawObj.errors);
      }
      if (Array.isArray(rawObj.warnings)) {
        warningsCount = rawObj.warnings.length;
        violations = violations.concat(rawObj.warnings);
      }
      if (Array.isArray(rawObj.violations)) {
        violations = rawObj.violations;
        errorsCount = violations.length;
      }
      if (typeof rawObj.passed === "boolean") {
        passed = rawObj.passed;
      } else if (typeof rawObj.success === "boolean") {
        passed = rawObj.success;
      } else {
        passed = errorsCount === 0;
      }
      status = passed ? "passed" : "violations_found";
    } else if (typeof rawResult === "boolean") {
      passed = rawResult;
      errorsCount = rawResult ? 0 : 1;
      status = passed ? "passed" : "violations_found";
      if (!passed) {
        violations.push({
          message: "Native schematic ERC failed without detailed violation records.",
          severity: "error"
        });
      }
    } else {
      status = "inconclusive";
      passed = false;
      warnings.push("Native ERC returned unparseable or inconclusive result.");
    }

    const formattedViolations = violations.map((v) => {
      if (typeof v === "string") {
        return {
          message: v,
          severity: "error"
        };
      }
      if (v && typeof v === "object") {
        const rec = v as Record<string, any>;
        return {
          rule: stringOrUndefined(rec.rule ?? rec.ruleCode ?? rec.code ?? rec.type),
          message: String(rec.message ?? rec.desc ?? rec.description ?? rec.text ?? JSON.stringify(rec)),
          severity: (["warning", "warn"].includes(String(rec.severity ?? rec.level).toLowerCase())
            ? "warning"
            : "error") as "error" | "warning",
          primitiveIds: toArray(rec.primitiveIds ?? (rec.primitiveId ? [rec.primitiveId] : [])).map(String),
          pageId: stringOrUndefined(rec.pageId ?? rec.sheetId),
          raw: sanitize(rec)
        };
      }
      return {
        message: String(v),
        severity: "error"
      };
    });

    return {
      available: true,
      status,
      source: "native_api",
      target: currentTarget,
      capturedAt: currentTarget.capturedAt,
      passed,
      violationsCount: formattedViolations.length,
      errorsCount,
      warningsCount,
      violations: formattedViolations,
      warnings,
      durationMs,
      rawResult: sanitize(rawResult),
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
    findNet,
    getSchematicNets: getSchematicNetsTool,
    getSchematicNetsTool,
    runSchematicErc: runSchematicErcTool,
    runSchematicErcTool,
    getSchematicPortsBuses: (params) => fetchSchematicPortsBusesReport(api, params)
  };
}
