import type { SchematicSnapshot } from "../schematic/analysis.js";

export type CompactSchematicSummary = {
  sheetName?: string;
  totalComponents: number;
  totalNets: number;
  componentsByType: Record<string, number>;
  components: Array<{
    ref: string;
    val?: string;
    name?: string;
    pkg?: string;
    pinsCount: number;
  }>;
  nets: Array<{
    name: string;
    pinsCount: number;
    connections: string[];
  }>;
};

export function projectCompactSchematic(
  snapshot: Partial<SchematicSnapshot> & { documentName?: string; sheetName?: string },
  sheetName?: string
): CompactSchematicSummary {
  const components = snapshot.components ?? [];
  const pins = snapshot.pins ?? [];
  const rawNets = snapshot.nets ?? [];

  // Group components by prefix/type
  const componentsByType: Record<string, number> = {};
  const componentPinCounts = new Map<string, number>();

  for (const pin of pins) {
    const designator = pin.componentDesignator;
    if (designator) {
      componentPinCounts.set(designator, (componentPinCounts.get(designator) ?? 0) + 1);
    }
  }

  const compactComponents = components.map((c) => {
    const ref = c.designator ?? c.primitiveId ?? "unknown";
    const prefixMatch = /^[A-Za-z]+/.exec(ref);
    const prefix = prefixMatch ? prefixMatch[0].toUpperCase() : "OTHER";
    componentsByType[prefix] = (componentsByType[prefix] ?? 0) + 1;

    let pkgStr: string | undefined;
    if (typeof c.footprint === "string") {
      pkgStr = c.footprint;
    } else if (c.footprint && typeof c.footprint === "object") {
      pkgStr = (c.footprint as { name?: string; package?: string }).name ?? (c.footprint as { package?: string }).package;
    }

    return {
      ref,
      val: c.value,
      name: c.name,
      pkg: pkgStr,
      pinsCount: componentPinCounts.get(ref) ?? 0
    };
  });

  // Build compact net list
  const netConnections = new Map<string, string[]>();
  for (const pin of pins) {
    if (pin.net && pin.componentDesignator) {
      const pinId = `${pin.componentDesignator}.${pin.pinNumber ?? pin.pinName ?? "?"}`;
      const list = netConnections.get(pin.net) ?? [];
      if (!list.includes(pinId)) {
        list.push(pinId);
      }
      netConnections.set(pin.net, list);
    }
  }

  const allNetNames = new Set<string>();
  for (const n of rawNets) {
    if (n.name) allNetNames.add(n.name);
  }
  for (const netName of netConnections.keys()) {
    allNetNames.add(netName);
  }

  const compactNets = Array.from(allNetNames)
    .sort()
    .map((netName) => {
      const conns = netConnections.get(netName) ?? [];
      return {
        name: netName,
        pinsCount: conns.length,
        connections: conns
      };
    });

  return {
    sheetName: sheetName ?? snapshot.sheetName ?? snapshot.documentName,
    totalComponents: compactComponents.length,
    totalNets: compactNets.length,
    componentsByType,
    components: compactComponents,
    nets: compactNets
  };
}

export type CompactPcbSummary = {
  documentName?: string;
  totalComponents: number;
  totalNets: number;
  routedNets: number;
  unroutedNets: number;
  completionRate: string;
  unroutedNetNames: string[];
  components: Array<{
    ref: string;
    layer?: string;
    pkg?: string;
  }>;
};

export function projectCompactPcb(options: {
  documentName?: string;
  routingStatus?: any;
  components?: any[];
}): CompactPcbSummary {
  const routing = options.routingStatus ?? {};
  const componentsList = options.components ?? [];

  const totalNets = Number(routing.totalNets ?? 0);
  const unroutedNets = Number(routing.unroutedNets ?? 0);
  const routedNets = Number(routing.routedNets ?? (totalNets - unroutedNets));
  const completionRate =
    routing.completionRate ?? (totalNets > 0 ? `${Math.round((routedNets / totalNets) * 100)}%` : "100%");

  let unroutedNetNames: string[] = [];
  if (Array.isArray(routing.unroutedNetDetails)) {
    unroutedNetNames = routing.unroutedNetDetails
      .map((d: any) => d.net ?? d.netName ?? d.name)
      .filter(Boolean);
  } else if (Array.isArray(routing.unroutedNetNames)) {
    unroutedNetNames = routing.unroutedNetNames;
  }

  const compactComponents = componentsList.map((c: any) => ({
    ref: c.designator ?? c.ref ?? c.id ?? "unknown",
    layer: c.layer ?? (c.layerId === 1 ? "top" : c.layerId === 2 ? "bottom" : undefined),
    pkg: c.footprint ?? c.package ?? c.footprintName
  }));

  return {
    documentName: options.documentName,
    totalComponents: compactComponents.length,
    totalNets,
    routedNets,
    unroutedNets,
    completionRate,
    unroutedNetNames,
    components: compactComponents
  };
}
