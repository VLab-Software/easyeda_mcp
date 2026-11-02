import type { NativeNetlistData } from "../../../src/schematic/nativeNetlist.js";
import type { EasyEdaApi } from "../types.js";

export async function collectNativeNetlist(eda: EasyEdaApi, allPages: boolean): Promise<NativeNetlistData> {
  const base = { format: "Protel2" as const };
  if (allPages)
    return {
      ...base,
      status: "unavailable",
      reason: "Native mapping currently requires a single-page snapshot to avoid page-local ID collisions"
    };
  if (!eda.sch_ManufactureData?.getNetlistFile)
    return { ...base, status: "unavailable", reason: "sch_ManufactureData.getNetlistFile is unavailable" };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const read = (async (): Promise<NativeNetlistData> => {
      const file = await eda.sch_ManufactureData.getNetlistFile("mcp-native-connectivity", "Protel2");
      if (!file || typeof file.text !== "function")
        return { ...base, status: "unsupported", reason: "Native API did not return a readable File" };
      if (typeof file.size === "number" && file.size > 2_000_000)
        return { ...base, status: "unsupported", reason: "Native netlist exceeds 2 MB" };
      const text: unknown = await file.text();
      if (typeof text !== "string") return { ...base, status: "unsupported", reason: "Netlist content is not text" };
      // Establish uniqueness across the project before matching references from an export.
      const components = await eda.sch_PrimitiveComponent.getAll(undefined, true);
      if (!Array.isArray(components)) throw new Error("Cannot establish project designator uniqueness");
      const counts = new Map<string, number>();
      for (const c of components)
        if (c.componentType === "part" && typeof c.designator === "string")
          counts.set(c.designator, (counts.get(c.designator) ?? 0) + 1);
      return {
        ...base,
        status: "available",
        text,
        ambiguousDesignators: [...counts].filter(([, count]) => count > 1).map(([name]) => name)
      };
    })();
    const timeout = new Promise<NativeNetlistData>((resolve) => {
      timer = setTimeout(
        () =>
          resolve({
            ...base,
            status: "error",
            reason: "Native netlist read timed out after 3000 ms; geometric fallback used"
          }),
        3000
      );
    });
    return await Promise.race([read, timeout]);
  } catch (error) {
    return { ...base, status: "error", reason: error instanceof Error ? error.message : String(error) };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
