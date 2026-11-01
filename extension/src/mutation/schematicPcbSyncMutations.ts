import { apiError, isRecord, numeric, optionalCall, stringOrUndefined, toArray } from "../helpers.js";
import { assertDocumentTargetMatch, extractDocumentIdentity, type DocumentIdentity } from "../identity.js";
import { extensionMutations } from "./mutationManager.js";
import type { EasyEdaApi } from "../types.js";
import type { MutationRecord } from "../../../src/mutation/contracts.js";

export type ComponentSyncStatus =
  "matched" | "schematic_only" | "pcb_only" | "footprint_mismatch" | "pin_pad_count_mismatch";

export type NetSyncStatus = "matched" | "schematic_only" | "pcb_only";

export type SyncOverallStatus = "in_sync" | "drift_detected" | "diverged" | "no_pcb" | "no_schematic";

export interface ComponentSyncItem {
  designator: string;
  status: ComponentSyncStatus;
  schematic?: {
    primitiveId?: string;
    value?: string;
    footprint?: string;
    pinCount?: number;
    sheet?: string;
  };
  pcb?: {
    primitiveId?: string;
    footprint?: string;
    padCount?: number;
    layer?: string | number;
    x?: number;
    y?: number;
  };
  discrepancies: string[];
}

export interface NetSyncItem {
  name: string;
  status: NetSyncStatus;
  inSchematic: boolean;
  inPcb: boolean;
  schematicPinCount?: number;
  pcbPadCount?: number;
  discrepancies: string[];
}

export interface SchematicPcbComparisonReport {
  schematicTarget?: DocumentIdentity;
  pcbTarget?: DocumentIdentity;
  syncStatus: SyncOverallStatus;
  syncScore: number;
  summary: {
    schematicComponentCount: number;
    pcbComponentCount: number;
    matchedComponentCount: number;
    unplacedComponentCount: number;
    untrackedComponentCount: number;
    mismatchedComponentCount: number;
    schematicNetCount: number;
    pcbNetCount: number;
    matchedNetCount: number;
    unroutedSchematicNetCount: number;
    extraPcbNetCount: number;
    totalDiscrepancies: number;
  };
  components: ComponentSyncItem[];
  nets: NetSyncItem[];
  recommendations: string[];
}

export function normalizeFootprintName(name?: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/^([rcldq]|res|cap|ind|diode)[_-]/i, "")
    .replace(/[^a-z0-9]/g, "");
}

export function areFootprintsCompatible(schFp?: string, pcbFp?: string): boolean {
  if (!schFp || !pcbFp) return true; // Cannot determine mismatch if one is omitted
  const normSch = normalizeFootprintName(schFp);
  const normPcb = normalizeFootprintName(pcbFp);
  if (normSch === normPcb) return true;
  if (normSch.includes(normPcb) || normPcb.includes(normSch)) return true;
  return false;
}

export async function compareSchematicPcb(
  api: () => EasyEdaApi,
  params: Record<string, any> = {}
): Promise<SchematicPcbComparisonReport> {
  const eda = api();

  // 1. Identify active document and project documents
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const activeIdentity = extractDocumentIdentity(documentInfo, undefined, "native_api");

  let schematicTarget: DocumentIdentity | undefined;
  let pcbTarget: DocumentIdentity | undefined;

  if (activeIdentity.documentType === "schematic") {
    schematicTarget = activeIdentity;
  } else if (activeIdentity.documentType === "pcb") {
    pcbTarget = activeIdentity;
  }

  // Check expected target guards if supplied
  if (params.schematicTarget && schematicTarget) {
    assertDocumentTargetMatch(params.schematicTarget, schematicTarget);
  }
  if (params.pcbTarget && pcbTarget) {
    assertDocumentTargetMatch(params.pcbTarget, pcbTarget);
  }

  // 2. Fetch Schematic Data
  let rawSchComponents: unknown[] = [];
  if (eda.sch_PrimitiveComponent?.getAll) {
    rawSchComponents = toArray(await optionalCall(() => eda.sch_PrimitiveComponent.getAll(undefined, true)));
  }

  let rawSchNets: unknown[] = [];
  if (eda.sch_Net?.getAllNetsName) {
    rawSchNets = toArray(await optionalCall(() => eda.sch_Net.getAllNetsName(undefined, true)));
  } else if (eda.sch_Net?.getAllNetName) {
    rawSchNets = toArray(await optionalCall(() => eda.sch_Net.getAllNetName()));
  }

  // 3. Fetch PCB Data
  let rawPcbComponents: unknown[] = [];
  if (eda.pcb_PrimitiveComponent?.getAll) {
    rawPcbComponents = toArray(await optionalCall(() => eda.pcb_PrimitiveComponent.getAll()));
  }

  let rawPcbNets: unknown[] = [];
  if (eda.pcb_Net?.getAllNetsName) {
    rawPcbNets = toArray(await optionalCall(() => eda.pcb_Net.getAllNetsName()));
  }

  // If no PCB components and no PCB nets, and active doc is schematic, check if PCB document exists
  const pcbFound =
    rawPcbComponents.length > 0 || rawPcbNets.length > 0 || (pcbTarget && pcbTarget.documentType === "pcb");

  // Map Schematic Components by designator
  const schCompMap = new Map<
    string,
    {
      primitiveId: string;
      designator: string;
      value?: string;
      footprint?: string;
      pinCount?: number;
      sheet?: string;
    }
  >();

  for (const item of rawSchComponents) {
    if (!isRecord(item)) continue;
    const primitiveId = String(item.primitiveId ?? item.id ?? item.uuid ?? "");
    const designator = String(item.designator ?? item.name ?? item.displayName ?? "").trim();
    if (!designator) continue;

    let pinCount: number | undefined;
    if (eda.sch_PrimitiveComponent?.getAllPinsByPrimitiveId && primitiveId) {
      const pins = toArray(await optionalCall(() => eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primitiveId)));
      pinCount = pins.length;
    } else if (Array.isArray(item.pins)) {
      pinCount = item.pins.length;
    }

    schCompMap.set(designator.toUpperCase(), {
      primitiveId,
      designator,
      value: stringOrUndefined(item.value ?? item.comment),
      footprint: stringOrUndefined(item.footprint ?? item.package),
      pinCount,
      sheet: stringOrUndefined(item.sheet ?? item.pageId)
    });
  }

  // Map PCB Components by designator
  const pcbCompMap = new Map<
    string,
    {
      primitiveId: string;
      designator: string;
      footprint?: string;
      padCount?: number;
      layer?: string | number;
      x?: number;
      y?: number;
    }
  >();

  for (const item of rawPcbComponents) {
    if (!isRecord(item)) continue;
    const primitiveId = String(item.primitiveId ?? item.id ?? item.uuid ?? "");
    const designator = String(item.designator ?? item.name ?? item.displayName ?? "").trim();
    if (!designator) continue;

    let padCount: number | undefined;
    if (Array.isArray(item.pads)) {
      padCount = item.pads.length;
    }

    pcbCompMap.set(designator.toUpperCase(), {
      primitiveId,
      designator,
      footprint: stringOrUndefined(item.footprint ?? item.package),
      padCount,
      layer: item.layer !== undefined ? (item.layer as string | number) : undefined,
      x: numeric(item.x),
      y: numeric(item.y)
    });
  }

  // 4. Compare Components
  const allDesignatorKeys = Array.from(new Set([...schCompMap.keys(), ...pcbCompMap.keys()])).sort();
  const componentResults: ComponentSyncItem[] = [];

  let matchedCompCount = 0;
  let unplacedCompCount = 0;
  let untrackedCompCount = 0;
  let mismatchedCompCount = 0;

  for (const key of allDesignatorKeys) {
    const sch = schCompMap.get(key);
    const pcb = pcbCompMap.get(key);
    const designator = sch?.designator ?? pcb?.designator ?? key;
    const discrepancies: string[] = [];

    if (sch && !pcb) {
      discrepancies.push(`Component '${designator}' exists in schematic but is not placed on the PCB.`);
      componentResults.push({
        designator,
        status: "schematic_only",
        schematic: sch,
        discrepancies
      });
      unplacedCompCount++;
      continue;
    }

    if (!sch && pcb) {
      discrepancies.push(`Component '${designator}' exists on PCB but has no definition in the schematic.`);
      componentResults.push({
        designator,
        status: "pcb_only",
        pcb,
        discrepancies
      });
      untrackedCompCount++;
      continue;
    }

    if (sch && pcb) {
      let isMismatch = false;

      // Check footprint compatibility
      if (sch.footprint && pcb.footprint && !areFootprintsCompatible(sch.footprint, pcb.footprint)) {
        discrepancies.push(
          `Footprint mismatch: schematic specifies '${sch.footprint}' but PCB has '${pcb.footprint}'.`
        );
        isMismatch = true;
      }

      // Check pin count vs pad count
      if (sch.pinCount !== undefined && pcb.padCount !== undefined && sch.pinCount !== pcb.padCount) {
        discrepancies.push(
          `Pin/Pad count mismatch: schematic symbol has ${sch.pinCount} pins but PCB footprint has ${pcb.padCount} pads.`
        );
        isMismatch = true;
      }

      if (isMismatch) {
        mismatchedCompCount++;
        componentResults.push({
          designator,
          status:
            sch.footprint && pcb.footprint && !areFootprintsCompatible(sch.footprint, pcb.footprint)
              ? "footprint_mismatch"
              : "pin_pad_count_mismatch",
          schematic: sch,
          pcb,
          discrepancies
        });
      } else {
        matchedCompCount++;
        componentResults.push({
          designator,
          status: "matched",
          schematic: sch,
          pcb,
          discrepancies: []
        });
      }
    }
  }

  // 5. Compare Nets
  const schNetNames = new Set(rawSchNets.map((n) => String(n).trim()).filter(Boolean));
  const pcbNetNames = new Set(rawPcbNets.map((n) => String(n).trim()).filter(Boolean));
  const allNetNames = Array.from(
    new Set([
      ...Array.from(schNetNames).map((n) => n.toUpperCase()),
      ...Array.from(pcbNetNames).map((n) => n.toUpperCase())
    ])
  ).sort();

  const netResults: NetSyncItem[] = [];
  let matchedNetCount = 0;
  let unroutedNetCount = 0;
  let extraPcbNetCount = 0;

  for (const netUpper of allNetNames) {
    const origSchNet = Array.from(schNetNames).find((n) => n.toUpperCase() === netUpper);
    const origPcbNet = Array.from(pcbNetNames).find((n) => n.toUpperCase() === netUpper);
    const name = origSchNet ?? origPcbNet ?? netUpper;
    const inSchematic = Boolean(origSchNet);
    const inPcb = Boolean(origPcbNet);
    const discrepancies: string[] = [];

    if (inSchematic && !inPcb) {
      discrepancies.push(`Net '${name}' is declared in schematic but does not exist in PCB netlist.`);
      unroutedNetCount++;
      netResults.push({
        name,
        status: "schematic_only",
        inSchematic: true,
        inPcb: false,
        discrepancies
      });
    } else if (!inSchematic && inPcb) {
      discrepancies.push(`Net '${name}' exists on PCB but is not present in the schematic.`);
      extraPcbNetCount++;
      netResults.push({
        name,
        status: "pcb_only",
        inSchematic: false,
        inPcb: true,
        discrepancies
      });
    } else {
      matchedNetCount++;
      netResults.push({
        name,
        status: "matched",
        inSchematic: true,
        inPcb: true,
        discrepancies: []
      });
    }
  }

  // 6. Calculate Synchronicity Status & Score
  const totalDiscrepancies =
    unplacedCompCount + untrackedCompCount + mismatchedCompCount + unroutedNetCount + extraPcbNetCount;

  let syncStatus: SyncOverallStatus;
  let syncScore: number;

  if (!pcbFound && schCompMap.size > 0) {
    syncStatus = "no_pcb";
    syncScore = 0;
  } else if (schCompMap.size === 0 && pcbCompMap.size === 0) {
    syncStatus = "in_sync";
    syncScore = 100;
  } else {
    const totalEntities = schCompMap.size + pcbCompMap.size + schNetNames.size + pcbNetNames.size;
    const matchedEntities = matchedCompCount * 2 + matchedNetCount * 2;
    syncScore =
      totalEntities > 0 ? Math.max(0, Math.min(100, Math.round((matchedEntities / totalEntities) * 100))) : 100;

    if (totalDiscrepancies === 0) {
      syncStatus = "in_sync";
    } else if (totalDiscrepancies <= 2 && mismatchedCompCount === 0) {
      syncStatus = "drift_detected";
    } else {
      syncStatus = "diverged";
    }
  }

  // 7. Formulate actionable recommendations
  const recommendations: string[] = [];

  if (syncStatus === "no_pcb") {
    recommendations.push(
      "No active PCB document was detected for this schematic project. Run 'easyeda_prepare_schematic_pcb_sync' with action='createPcbFromSchematic' to generate a PCB board."
    );
  } else {
    if (unplacedCompCount > 0) {
      recommendations.push(
        `Forward ${unplacedCompCount} unplaced schematic components to the PCB by running 'easyeda_prepare_schematic_pcb_sync' with action='syncToPcb'.`
      );
    }
    if (unroutedNetCount > 0) {
      recommendations.push(`Import ${unroutedNetCount} new schematic nets to PCB by performing a sync to PCB.`);
    }
    if (mismatchedCompCount > 0) {
      recommendations.push(
        `Resolve ${mismatchedCompCount} component footprint/pinout discrepancies between schematic and PCB before routing.`
      );
    }
    if (untrackedCompCount > 0) {
      recommendations.push(
        `Review ${untrackedCompCount} PCB components that have no corresponding symbol in the schematic.`
      );
    }
    if (syncStatus === "in_sync") {
      recommendations.push("Schematic and PCB are fully synchronized. No action required.");
    }
  }

  return {
    schematicTarget,
    pcbTarget,
    syncStatus,
    syncScore,
    summary: {
      schematicComponentCount: schCompMap.size,
      pcbComponentCount: pcbCompMap.size,
      matchedComponentCount: matchedCompCount,
      unplacedComponentCount: unplacedCompCount,
      untrackedComponentCount: untrackedCompCount,
      mismatchedComponentCount: mismatchedCompCount,
      schematicNetCount: schNetNames.size,
      pcbNetCount: pcbNetNames.size,
      matchedNetCount: matchedNetCount,
      unroutedSchematicNetCount: unroutedNetCount,
      extraPcbNetCount: extraPcbNetCount,
      totalDiscrepancies
    },
    components: componentResults,
    nets: netResults,
    recommendations
  };
}

export async function prepareSchematicPcbSyncMutation(
  api: () => EasyEdaApi,
  params: Record<string, any>
): Promise<Record<string, unknown>> {
  const eda = api();
  const documentInfo = await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.());
  const currentTarget = extractDocumentIdentity(documentInfo, undefined, "native_api");

  const action = String(params.action ?? "").trim();
  const validActions = [
    "synctopcb",
    "sync_to_pcb",
    "importchanges",
    "updatepcb",
    "synctoschematic",
    "sync_to_schematic",
    "updateschematic",
    "backannotate",
    "createpcbfromschematic",
    "create_pcb_from_schematic",
    "createpcb",
    "createboard"
  ];

  const normalizedAction = action.toLowerCase();
  if (!validActions.includes(normalizedAction)) {
    throw apiError("invalid_parameters", "Action must be 'syncToPcb', 'syncToSchematic', or 'createPcbFromSchematic'.");
  }

  // Canonical action name
  let canonicalAction: "syncToPcb" | "syncToSchematic" | "createPcbFromSchematic" = "syncToPcb";
  if (["synctoschematic", "sync_to_schematic", "updateschematic", "backannotate"].includes(normalizedAction)) {
    canonicalAction = "syncToSchematic";
  } else if (
    ["createpcbfromschematic", "create_pcb_from_schematic", "createpcb", "createboard"].includes(normalizedAction)
  ) {
    canonicalAction = "createPcbFromSchematic";
  }

  // Run before comparison
  const beforeComparison = await compareSchematicPcb(api, params);

  let impact: string;
  let scope: string;
  let operation: Record<string, unknown>;

  if (canonicalAction === "createPcbFromSchematic") {
    const boardName = stringOrUndefined(params.boardName ?? params.name) ?? "Board";
    const layerCount = numeric(params.layerCount) ?? 2;
    const width = numeric(params.width) ?? 100;
    const height = numeric(params.height) ?? 80;

    operation = {
      action: "createPcbFromSchematic",
      boardName,
      layerCount,
      width,
      height
    };

    impact = `Creates new PCB board '${boardName}' (${layerCount} copper layers, ${width}x${height}mm) populated with ${beforeComparison.summary.schematicComponentCount} components and ${beforeComparison.summary.schematicNetCount} nets from the active schematic.`;
    scope = `schematic:${beforeComparison.schematicTarget?.documentId ?? "active"}`;
  } else if (canonicalAction === "syncToPcb") {
    operation = {
      action: "syncToPcb",
      unplacedComponents: beforeComparison.components
        .filter((c) => c.status === "schematic_only")
        .map((c) => c.designator),
      unroutedNets: beforeComparison.nets.filter((n) => n.status === "schematic_only").map((n) => n.name)
    };

    const compCount = beforeComparison.summary.unplacedComponentCount;
    const netCount = beforeComparison.summary.unroutedSchematicNetCount;
    impact = `Synchronizes schematic to PCB: pushes ${compCount} unplaced component(s) and ${netCount} net(s) to the PCB document.`;
    scope = `pcb:${beforeComparison.pcbTarget?.documentId ?? "active"}`;
  } else {
    // syncToSchematic
    operation = {
      action: "syncToSchematic",
      untrackedPcbComponents: beforeComparison.components
        .filter((c) => c.status === "pcb_only")
        .map((c) => c.designator)
    };

    impact = `Back-annotates PCB changes to schematic: updates footprint assignments and checks ${beforeComparison.summary.untrackedComponentCount} untracked PCB component(s).`;
    scope = `schematic:${beforeComparison.schematicTarget?.documentId ?? "active"}`;
  }

  const preview = {
    before: {
      syncStatus: beforeComparison.syncStatus,
      syncScore: beforeComparison.syncScore,
      summary: beforeComparison.summary
    },
    requestedAfter: {
      action: canonicalAction,
      expectedSyncStatus: "in_sync",
      expectedSyncScore: 100
    },
    changedKeys: ["syncStatus", "components", "nets"],
    scope,
    impact
  };

  const record = extensionMutations.prepare({
    domain: "sync",
    action: canonicalAction,
    target: currentTarget,
    operation,
    before: preview.before,
    requestedAfter: preview.requestedAfter,
    changedKeys: preview.changedKeys,
    scope: preview.scope,
    impact: preview.impact,
    ttlMs: 5 * 60_000
  });

  return {
    mutationId: record.mutationId,
    confirmation: record.confirmation,
    action: record.action,
    target: record.target,
    preview: record.preview,
    expiresAt: record.expiresAt
  };
}

export async function executeSchematicPcbSyncMutation(
  record: MutationRecord,
  api: () => EasyEdaApi
): Promise<{ executed: boolean; readback: Record<string, unknown> }> {
  const eda = api();
  const op = record.operation as Record<string, any>;

  if (op.action === "createPcbFromSchematic") {
    let createdResult: unknown;
    if (eda.pcb_Document?.create) {
      createdResult = await eda.pcb_Document.create({
        name: op.boardName,
        layerCount: op.layerCount,
        width: op.width,
        height: op.height
      });
    } else if (eda.sch_Document?.createPcb) {
      createdResult = await eda.sch_Document.createPcb(op.boardName);
    } else if (eda.dmt_Document?.createBoard) {
      createdResult = await eda.dmt_Document.createBoard({
        name: op.boardName,
        type: "pcb"
      });
    } else {
      throw apiError(
        "capability_unavailable",
        "PCB creation from schematic (pcb_Document.create / sch_Document.createPcb) is not supported in the connected EasyEDA Pro version."
      );
    }

    const afterComparison = await compareSchematicPcb(api);

    return {
      executed: true,
      readback: {
        action: op.action,
        boardName: op.boardName,
        layerCount: op.layerCount,
        createdResult,
        afterSyncStatus: afterComparison.syncStatus,
        afterSyncScore: afterComparison.syncScore,
        verified: true
      }
    };
  }

  if (op.action === "syncToPcb") {
    let syncResult: unknown;
    if (eda.pcb_Document?.importChanges) {
      syncResult = await eda.pcb_Document.importChanges();
    } else if (eda.sch_Document?.updatePcb) {
      syncResult = await eda.sch_Document.updatePcb();
    } else if (eda.dmt_Document?.importChanges) {
      syncResult = await eda.dmt_Document.importChanges();
    } else {
      throw apiError(
        "capability_unavailable",
        "Schematic to PCB sync (pcb_Document.importChanges / sch_Document.updatePcb) is not available in the connected EasyEDA Pro version."
      );
    }

    const afterComparison = await compareSchematicPcb(api);

    return {
      executed: true,
      readback: {
        action: op.action,
        syncResult,
        afterSyncStatus: afterComparison.syncStatus,
        afterSyncScore: afterComparison.syncScore,
        remainingDiscrepancies: afterComparison.summary.totalDiscrepancies,
        verified: true
      }
    };
  }

  if (op.action === "syncToSchematic") {
    let backAnnotateResult: unknown;
    if (eda.pcb_Document?.updateSchematic) {
      backAnnotateResult = await eda.pcb_Document.updateSchematic();
    } else if (eda.sch_Document?.backAnnotate) {
      backAnnotateResult = await eda.sch_Document.backAnnotate();
    } else {
      throw apiError(
        "capability_unavailable",
        "Back-annotation from PCB to schematic (pcb_Document.updateSchematic) is not available in the connected EasyEDA Pro version."
      );
    }

    const afterComparison = await compareSchematicPcb(api);

    return {
      executed: true,
      readback: {
        action: op.action,
        backAnnotateResult,
        afterSyncStatus: afterComparison.syncStatus,
        afterSyncScore: afterComparison.syncScore,
        remainingDiscrepancies: afterComparison.summary.totalDiscrepancies,
        verified: true
      }
    };
  }

  throw apiError("unsupported_action", `Unsupported schematic-pcb sync action "${op.action}".`);
}
