import * as z from "zod/v4";

// The official API leaves rule fields opaque. Accept JSON data, never executable values.
export function canonical(value: unknown, maxDepth = 40): string {
  function visit(item: unknown, depth: number): unknown {
    if (depth > maxDepth) throw new Error("Rule JSON exceeds maximum depth");
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (Array.isArray(item)) return item.map(v => visit(v, depth + 1));
    if (typeof item !== "object" || !item || ![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new Error("Rules must contain only finite JSON data");
    const result: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(item).sort()) {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Unsafe rule property");
      result[key] = visit((item as Record<string, unknown>)[key], depth + 1);
    }
    return result;
  }
  const text = JSON.stringify(visit(value, 0));
  if (text.length > 2_000_000) throw new Error("JSON exceeds 2000000 characters");
  return text;
}
const Rule = z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
  try { if (canonical(value).length > 200_000) throw new Error("Rule JSON exceeds 200000 characters"); }
  catch (error) { ctx.addIssue({ code: "custom", message: String(error) }); }
});
const Rules = z.array(Rule).max(1000);
export const DrcScopeSchema = z.enum(["current", "configurations", "netRules", "netByNetRules", "regionRules"]);
export const DrcOperationSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("createConfiguration"), configurationName: z.string().trim().min(1).max(200), config: Rule }),
  z.strictObject({ type: z.literal("updateCurrentConfiguration"), config: Rule }),
  z.strictObject({ type: z.literal("replaceNetRules"), rules: Rules }),
  z.strictObject({ type: z.literal("replaceNetByNetRules"), rules: Rule }),
  z.strictObject({ type: z.literal("replaceRegionRules"), rules: Rules })
]);
export const DrcEditQuerySchema = z.strictObject({ editId: z.string().uuid() });
export type DrcOperation = z.infer<typeof DrcOperationSchema>;
export const drcConfirmation = (editId: string): string => `CONFIRM editDrcRules ${editId}`;
