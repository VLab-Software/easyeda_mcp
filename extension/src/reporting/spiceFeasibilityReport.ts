import { extractDocumentIdentity } from "../identity.js";
import { inferDocumentType, optionalCall, sanitize, timestamp, toArray } from "../helpers.js";
import { validateExportContent } from "./exportEnhancements.js";
import type { EasyEdaApi } from "../types.js";

export type SpiceAnalysisType = "op" | "tran" | "ac" | "dc";

export type ComponentSpiceCategory =
  | "primitive_r"
  | "primitive_l"
  | "primitive_c"
  | "primitive_diode"
  | "primitive_transistor"
  | "source_voltage"
  | "source_current"
  | "subcircuit"
  | "needs_model"
  | "non_electrical";

export interface ComponentSpiceAudit {
  designator: string;
  prefix: string;
  title: string;
  spiceCategory: ComponentSpiceCategory;
  modelName?: string;
  hasModel: boolean;
  modelSource: "intrinsic" | "embedded" | "library" | "missing" | "none";
  parameters: Record<string, string | number>;
  pinsCount: number;
  pinsConnectedCount: number;
  warnings: string[];
}

export interface SpiceFeasibilityReport {
  documentId?: string;
  documentName?: string;
  documentType: string;
  feasibilityScorePercent: number; // 0 to 100
  isSimulatable: boolean;
  verdict: "simulation_ready" | "minor_setup_needed" | "major_models_missing" | "unsupported";
  engineAvailability: {
    nativeEditorEngine: boolean;
    externalNgspiceCompatible: boolean;
    externalLtspiceCompatible: boolean;
    cloudEngineAvailable: boolean;
    recommendedWorkflow: string;
  };
  groundReference: {
    detected: boolean;
    netName?: string;
    spiceNode: "0";
    nodesCount: number;
  };
  componentsAudit: {
    totalComponents: number;
    simulatableCount: number;
    missingModelsCount: number;
    nonElectricalCount: number;
    items: ComponentSpiceAudit[];
  };
  stimulusSources: {
    hasStimulus: boolean;
    count: number;
    sources: Array<{ designator: string; type: string; value: string }>;
  };
  connectivitySummary: {
    totalNets: number;
    floatingPinsCount: number;
    singlePinNetsCount: number;
  };
  platformLimitations: string[];
  recommendations: string[];
}

export interface EvaluateSpiceFeasibilityParams {
  target?: Record<string, unknown>;
  groundNet?: string;
  timeoutMs?: number;
}

export interface GenerateSpiceNetlistParams {
  analysisType?: SpiceAnalysisType;
  analysisParams?: string;
  groundNet?: string;
  includeSubcircuits?: boolean;
  includeDefaultModels?: boolean;
  fileName?: string;
  destinationPath?: string;
  target?: Record<string, unknown>;
  timeoutMs?: number;
}

/**
 * Classifies a component's designator and attributes into SPICE primitive/subcircuit categories.
 */
export function classifyComponentForSpice(rawComp: Record<string, any>, pins: unknown[] = []): ComponentSpiceAudit {
  const designator = String(rawComp.designator ?? rawComp.name ?? rawComp.id ?? "U?").trim();
  const title = String(rawComp.title ?? rawComp.package ?? rawComp.deviceType ?? "").trim();
  const prefixMatch = designator.match(/^([A-Za-z]+)/);
  const prefix = prefixMatch ? prefixMatch[1].toUpperCase() : "U";

  const rawAttrs = rawComp.attributes ?? rawComp.props ?? {};
  const valueAttr = String(rawComp.value ?? rawAttrs.value ?? rawAttrs.Value ?? "").trim();
  const spiceModelAttr = String(rawAttrs.spice_model ?? rawAttrs.SpiceModel ?? rawAttrs.model ?? "").trim();
  const spiceSubcktAttr = String(rawAttrs.spice_subckt ?? rawAttrs.subckt ?? "").trim();

  const parameters: Record<string, string | number> = {};
  if (valueAttr) parameters.value = valueAttr;

  const warnings: string[] = [];
  let spiceCategory: ComponentSpiceCategory;
  let hasModel: boolean;
  let modelSource: "intrinsic" | "embedded" | "library" | "missing" | "none";
  let modelName: string | undefined = spiceModelAttr || spiceSubcktAttr || undefined;

  const connectedPinsCount = pins.filter((p: any) => {
    const net = p.net ?? p.netName ?? p.connectNet;
    return Boolean(net && String(net).trim() !== "");
  }).length;

  // 1. Passives
  if (prefix === "R") {
    spiceCategory = "primitive_r";
    hasModel = true;
    modelSource = "intrinsic";
    if (!valueAttr) warnings.push("Resistor missing resistance value; default 1k will be assumed.");
  } else if (prefix === "C") {
    spiceCategory = "primitive_c";
    hasModel = true;
    modelSource = "intrinsic";
    if (!valueAttr) warnings.push("Capacitor missing capacitance value; default 100n will be assumed.");
  } else if (prefix === "L") {
    spiceCategory = "primitive_l";
    hasModel = true;
    modelSource = "intrinsic";
    if (!valueAttr) warnings.push("Inductor missing inductance value; default 10u will be assumed.");
  }
  // 2. Diodes
  else if (prefix === "D" || prefix === "LED") {
    spiceCategory = "primitive_diode";
    hasModel = Boolean(modelName || valueAttr);
    modelSource = modelName ? "embedded" : "library";
    modelName = modelName ?? (valueAttr ? `D_${valueAttr}` : "D_GENERIC");
  }
  // 3. Transistors
  else if (prefix === "Q" || prefix === "M" || prefix === "T") {
    spiceCategory = "primitive_transistor";
    hasModel = Boolean(modelName || valueAttr);
    modelSource = modelName ? "embedded" : "library";
    modelName = modelName ?? (valueAttr ? `Q_${valueAttr}` : "NPN_GENERIC");
  }
  // 4. Sources
  else if (
    prefix === "V" ||
    designator.startsWith("BAT") ||
    designator.startsWith("VIN") ||
    designator.startsWith("PWR")
  ) {
    spiceCategory = "source_voltage";
    hasModel = true;
    modelSource = "intrinsic";
    parameters.dc = valueAttr || "5V";
  } else if (prefix === "I") {
    spiceCategory = "source_current";
    hasModel = true;
    modelSource = "intrinsic";
    parameters.dc = valueAttr || "1mA";
  }
  // 5. Connectors & Test Points
  else if (
    prefix === "J" ||
    prefix === "CN" ||
    prefix === "HDR" ||
    prefix === "TP" ||
    prefix === "H" ||
    prefix === "MH"
  ) {
    spiceCategory = "non_electrical";
    hasModel = false;
    modelSource = "none";
  }
  // 6. ICs and complex subcircuits
  else {
    spiceCategory = "subcircuit";
    if (spiceSubcktAttr || spiceModelAttr) {
      hasModel = true;
      modelSource = "embedded";
    } else {
      hasModel = false;
      modelSource = "missing";
      warnings.push(
        `Component '${designator}' (${title || "IC"}) has no attached SPICE subcircuit or simulation model.`
      );
    }
  }

  return {
    designator,
    prefix,
    title,
    spiceCategory,
    modelName,
    hasModel,
    modelSource,
    parameters,
    pinsCount: pins.length,
    pinsConnectedCount: connectedPinsCount,
    warnings
  };
}

/**
 * Evaluates SPICE feasibility, engine availability, and circuit readiness of active schematic.
 */
export async function evaluateSpiceFeasibility(
  api: () => EasyEdaApi,
  params: EvaluateSpiceFeasibilityParams = {}
): Promise<SpiceFeasibilityReport> {
  const eda = api();
  const docInfo = (await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.())) ?? {};
  const docId = extractDocumentIdentity(docInfo, undefined, "native_api");
  const docType = inferDocumentType(docInfo);

  // Probe EasyEDA Pro simulation API capabilities
  const nativeSim = Boolean(
    (eda as any).sch_Sim?.check || (eda as any).sim_Document?.run || (eda as any).sim_Engine?.simulate
  );
  const cloudSim = Boolean((eda as any).sch_Sim?.cloudSimulate);

  // Retrieve schematic components
  const rawComponents = toArray(await optionalCall(() => eda.sch_PrimitiveComponent?.getAll?.(undefined, true)));

  // Retrieve nets
  const rawNets = toArray(
    await optionalCall(
      () => eda.sch_Net?.getAllNetsName?.() ?? eda.sch_Net?.getAllNetName?.() ?? eda.sch_Net?.getAllNets?.()
    )
  );

  // Audit components
  const componentAudits: ComponentSpiceAudit[] = [];
  const stimulusSources: Array<{ designator: string; type: string; value: string }> = [];
  let floatingPinsTotal = 0;

  for (const item of rawComponents) {
    if (!item || typeof item !== "object") continue;
    const comp = item as Record<string, any>;
    const compId = comp.primitiveId ?? comp.id;
    let pins: unknown[];
    if (compId && eda.sch_PrimitiveComponent?.getAllPinsByPrimitiveId) {
      try {
        pins = toArray(await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(compId));
      } catch {
        pins = toArray(comp.pins);
      }
    } else {
      pins = toArray(comp.pins);
    }

    const audit = classifyComponentForSpice(comp, pins);
    componentAudits.push(audit);

    const unconnected = audit.pinsCount - audit.pinsConnectedCount;
    if (unconnected > 0) floatingPinsTotal += unconnected;

    if (audit.spiceCategory === "source_voltage" || audit.spiceCategory === "source_current") {
      stimulusSources.push({
        designator: audit.designator,
        type: audit.spiceCategory,
        value: String(audit.parameters.dc ?? audit.parameters.value ?? "5V")
      });
    }
  }

  // Detect Ground reference
  const groundTargetName = params.groundNet?.toUpperCase() ?? "GND";
  const netNames = rawNets.map((n: any) => (typeof n === "string" ? n : String(n?.name ?? n?.netName ?? n)));
  const groundDetected = netNames.some((n) => {
    const norm = String(n).trim().toUpperCase();
    return norm === groundTargetName || norm === "0" || norm === "AGND" || norm === "DGND" || norm === "GND_PWR";
  });
  const matchedGround = netNames.find((n) => {
    const norm = String(n).trim().toUpperCase();
    return norm === groundTargetName || norm === "0" || norm === "AGND" || norm === "DGND";
  });

  // Calculate feasibility score
  const totalComponents = componentAudits.length;
  const simulatable = componentAudits.filter((c) => c.hasModel || c.spiceCategory === "non_electrical");
  const missingModels = componentAudits.filter((c) => c.modelSource === "missing");
  const nonElectrical = componentAudits.filter((c) => c.spiceCategory === "non_electrical");

  let score = 100;
  const recommendations: string[] = [];

  if (!groundDetected) {
    score -= 40;
    recommendations.push(
      "CRITICAL: Add a ground reference net (named 'GND' or '0') to the schematic. SPICE nodal analysis requires node '0' as DC datum."
    );
  }

  if (stimulusSources.length === 0) {
    score -= 20;
    recommendations.push(
      "Add a stimulus source (DC voltage VCC, pulsed clock, or AC source) to excite the circuit during simulation."
    );
  }

  if (missingModels.length > 0) {
    const penalty = Math.min(30, missingModels.length * 10);
    score -= penalty;
    const names = missingModels
      .slice(0, 5)
      .map((m) => m.designator)
      .join(", ");
    recommendations.push(
      `Attach SPICE subcircuits (.subckt) or SPICE model text to IC components lacking models: ${names}${missingModels.length > 5 ? " and others" : ""}.`
    );
  }

  if (floatingPinsTotal > 0) {
    score -= Math.min(10, floatingPinsTotal * 2);
    recommendations.push(
      `Connect or place 'No Connect' flags on ${floatingPinsTotal} floating pin(s) to avoid singular matrix errors during simulation.`
    );
  }

  score = Math.max(0, Math.min(100, score));

  let verdict: SpiceFeasibilityReport["verdict"];
  if (score >= 80) verdict = "simulation_ready";
  else if (score >= 50) verdict = "minor_setup_needed";
  else if (score >= 20) verdict = "major_models_missing";
  else verdict = "unsupported";

  const isSimulatable = score >= 50 && groundDetected;

  const platformLimitations = [
    "EasyEDA Pro operates in a browser/Electron sandbox without an embedded native SPICE binary solver.",
    "Native in-browser simulation requires external simulator integration (ngspice, LTspice, or Xyce).",
    "Complex proprietary ICs and microcontrollers cannot be simulated with pure analog SPICE without vendor behavioral macromodels.",
    "Simulation directives (.tran, .ac, .op, .dc) must be specified as schematic text or injected during netlist generation."
  ];

  return {
    documentId: docId.documentId,
    documentName: docId.documentName,
    documentType: docType,
    feasibilityScorePercent: score,
    isSimulatable,
    verdict,
    engineAvailability: {
      nativeEditorEngine: nativeSim,
      externalNgspiceCompatible: true,
      externalLtspiceCompatible: true,
      cloudEngineAvailable: cloudSim,
      recommendedWorkflow:
        "Export SPICE netlist via easyeda_generate_spice_netlist and execute simulation in ngspice CLI or LTspice."
    },
    groundReference: {
      detected: groundDetected,
      netName: matchedGround,
      spiceNode: "0",
      nodesCount: netNames.length
    },
    componentsAudit: {
      totalComponents,
      simulatableCount: simulatable.length,
      missingModelsCount: missingModels.length,
      nonElectricalCount: nonElectrical.length,
      items: componentAudits
    },
    stimulusSources: {
      hasStimulus: stimulusSources.length > 0,
      count: stimulusSources.length,
      sources: stimulusSources
    },
    connectivitySummary: {
      totalNets: netNames.length,
      floatingPinsCount: floatingPinsTotal,
      singlePinNetsCount: 0
    },
    platformLimitations,
    recommendations
  };
}

/**
 * Generates standard SPICE formatted netlist (.cir / .sp) from active schematic.
 */
export async function generateSpiceNetlist(
  api: () => EasyEdaApi,
  saveFileFn: ((file: unknown, name: string) => Promise<Record<string, unknown>>) | undefined,
  params: GenerateSpiceNetlistParams = {}
): Promise<Record<string, unknown>> {
  const eda = api();
  const docInfo = (await optionalCall(() => eda.dmt_SelectControl?.getCurrentDocumentInfo?.())) ?? {};
  const docId = extractDocumentIdentity(docInfo, undefined, "native_api");
  const baseTitle = docId.documentName || "EasyEDA_Circuit";
  const analysisType = params.analysisType ?? "op";
  const analysisParams = params.analysisParams?.trim();

  const baseName = params.fileName?.trim() || `easyeda-spice-${timestamp()}`;
  const fileName = baseName.endsWith(".cir") || baseName.endsWith(".sp") ? baseName : `${baseName}.cir`;

  // Fetch components
  const rawComponents = toArray(await optionalCall(() => eda.sch_PrimitiveComponent?.getAll?.(undefined, true)));

  const lines: string[] = [];
  lines.push(`* EasyEDA Pro Exported SPICE Netlist`);
  lines.push(`* Document: ${baseTitle} (${docId.documentId ?? "active"})`);
  lines.push(`* Generated: ${new Date().toISOString()}`);
  lines.push(`* Simulator Target: ngspice / LTspice / SPICE3f5`);
  lines.push(``);

  const elements: string[] = [];
  const referencedModels = new Set<string>();
  const allNodes = new Set<string>();

  // Ground mapping
  const groundNet = (params.groundNet ?? "GND").toUpperCase();
  const mapNode = (net: unknown, fallbackPin: string): string => {
    if (!net) return `N_${fallbackPin}`;
    const n = String(net).trim();
    const up = n.toUpperCase();
    if (up === groundNet || up === "0" || up === "AGND" || up === "DGND") {
      allNodes.add("0");
      return "0";
    }
    const sanitizedNode = n.replace(/[^A-Za-z0-9_]/g, "_");
    allNodes.add(sanitizedNode);
    return sanitizedNode;
  };

  for (const item of rawComponents) {
    if (!item || typeof item !== "object") continue;
    const comp = item as Record<string, any>;
    const compId = comp.primitiveId ?? comp.id;
    let pins: any[];
    if (compId && eda.sch_PrimitiveComponent?.getAllPinsByPrimitiveId) {
      try {
        pins = toArray(await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(compId));
      } catch {
        pins = toArray(comp.pins);
      }
    } else {
      pins = toArray(comp.pins);
    }

    const audit = classifyComponentForSpice(comp, pins);
    if (audit.spiceCategory === "non_electrical") continue;

    const des = audit.designator;
    const val = String(audit.parameters.value ?? audit.parameters.dc ?? "1k");

    if (
      audit.spiceCategory === "primitive_r" ||
      audit.spiceCategory === "primitive_c" ||
      audit.spiceCategory === "primitive_l"
    ) {
      const p1 = mapNode(pins[0]?.net ?? pins[0]?.netName, `${des}_1`);
      const p2 = mapNode(pins[1]?.net ?? pins[1]?.netName, `${des}_2`);
      elements.push(`${des} ${p1} ${p2} ${val}`);
    } else if (audit.spiceCategory === "primitive_diode") {
      const pAnode = mapNode(pins[0]?.net ?? pins[0]?.netName, `${des}_A`);
      const pCathode = mapNode(pins[1]?.net ?? pins[1]?.netName, `${des}_K`);
      const mod = audit.modelName ?? "D_GENERIC";
      referencedModels.add(mod);
      elements.push(`${des} ${pAnode} ${pCathode} ${mod}`);
    } else if (audit.spiceCategory === "primitive_transistor") {
      const pC = mapNode(pins[0]?.net ?? pins[0]?.netName, `${des}_C`);
      const pB = mapNode(pins[1]?.net ?? pins[1]?.netName, `${des}_B`);
      const pE = mapNode(pins[2]?.net ?? pins[2]?.netName, `${des}_E`);
      const mod = audit.modelName ?? "NPN_GENERIC";
      referencedModels.add(mod);
      elements.push(`${des} ${pC} ${pB} ${pE} ${mod}`);
    } else if (audit.spiceCategory === "source_voltage") {
      const pPos = mapNode(pins[0]?.net ?? pins[0]?.netName, `${des}_P`);
      const pNeg = mapNode(pins[1]?.net ?? pins[1]?.netName, "0");
      elements.push(`${des} ${pPos} ${pNeg} DC ${val}`);
    } else if (audit.spiceCategory === "source_current") {
      const pPos = mapNode(pins[0]?.net ?? pins[0]?.netName, `${des}_P`);
      const pNeg = mapNode(pins[1]?.net ?? pins[1]?.netName, "0");
      elements.push(`${des} ${pPos} ${pNeg} DC ${val}`);
    } else if (audit.spiceCategory === "subcircuit" && params.includeSubcircuits !== false) {
      const pinNodes = pins.map((p, idx) => mapNode(p.net ?? p.netName, `${des}_${idx + 1}`));
      const subName = audit.modelName ?? audit.title ?? "SUBCKT_UNKNOWN";
      elements.push(`X${des.replace(/^U/i, "")} ${pinNodes.join(" ")} ${subName}`);
    }
  }

  // Elements section
  lines.push(`* Circuit Elements`);
  if (elements.length === 0) {
    lines.push(`* (No electrical elements found on active schematic canvas)`);
    // Fallback minimal element for syntax validation
    lines.push(`R_DUMMY 1 0 1Meg`);
    allNodes.add("1");
    allNodes.add("0");
  } else {
    for (const el of elements) lines.push(el);
  }
  lines.push(``);

  // Models section
  if (params.includeDefaultModels !== false) {
    lines.push(`* Built-in Semiconductor Models`);
    lines.push(`.model D_GENERIC D(IS=1e-14 RS=0.1 CJO=2p BV=50)`);
    lines.push(`.model NPN_GENERIC NPN(BF=100 IS=1e-14 VAF=100)`);
    lines.push(`.model PNP_GENERIC PNP(BF=100 IS=1e-14 VAF=100)`);
    lines.push(``);
  }

  // Analysis directive
  lines.push(`* Simulation Directives`);
  let directive: string;
  if (analysisType === "tran") {
    directive = `.tran ${analysisParams || "1u 10m"}`;
  } else if (analysisType === "ac") {
    directive = `.ac dec ${analysisParams || "10 1 1Meg"}`;
  } else if (analysisType === "dc") {
    directive = `.dc ${analysisParams || "V1 0 5 0.1"}`;
  } else {
    directive = ".op";
  }
  lines.push(directive);
  lines.push(``);
  lines.push(`.end`);
  lines.push(``);

  const netlistContent = lines.join("\n");
  const validation = validateExportContent("txt", netlistContent, fileName, params.destinationPath);

  let saveResult: Record<string, unknown> = { saved: false };
  if (saveFileFn) {
    saveResult = await saveFileFn(netlistContent, fileName);
  }

  return {
    ...saveResult,
    fileName,
    analysisType,
    directive,
    elementsCount: elements.length,
    nodesCount: allNodes.size,
    nodes: Array.from(allNodes),
    netlist: netlistContent,
    validation: sanitize(validation),
    metadata: {
      documentId: docId.documentId,
      documentName: docId.documentName,
      destinationPath: validation.destinationPath
    }
  };
}
