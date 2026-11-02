import { collectSchematicSnapshot } from "./schematicHandlers.js";
import { describe, expect, it, vi } from "vitest";
import { collectNativeNetlist } from "./nativeNetlist.js";

describe("native netlist collection", () => {
  it("reads the File in memory, requests Protel2 and detects duplicate project references", async () => {
    const getNetlistFile = vi.fn(async () => ({ size: 12, text: async () => "(\nGND\nU1-1\n)" }));
    const result = await collectNativeNetlist(
      {
        sch_ManufactureData: { getNetlistFile },
        sch_PrimitiveComponent: {
          getAll: async () => [
            { componentType: "part", designator: "U1" },
            { componentType: "part", designator: "U1" }
          ]
        }
      },
      false
    );
    expect(getNetlistFile).toHaveBeenCalledWith("mcp-native-connectivity", "Protel2");
    expect(result).toMatchObject({ status: "available", ambiguousDesignators: ["U1"] });
  });
  it("does not claim support when the API or page scope is unavailable", async () => {
    expect((await collectNativeNetlist({}, false)).status).toBe("unavailable");
    const getNetlistFile = vi.fn();
    expect((await collectNativeNetlist({ sch_ManufactureData: { getNetlistFile } }, true)).status).toBe("unavailable");
    expect(getNetlistFile).not.toHaveBeenCalled();
  });
  it("reports a read failure without changing the editor", async () => {
    const result = await collectNativeNetlist(
      {
        sch_ManufactureData: {
          getNetlistFile: async () => {
            throw new Error("export failed");
          }
        }
      },
      false
    );
    expect(result).toMatchObject({ status: "error", reason: "export failed" });
  });
  it("integrates native membership into the current-page snapshot", async () => {
    const component = { primitiveId: "u", componentType: "part", designator: "U15" };
    const api = () => ({
      dmt_SelectControl: { getCurrentDocumentInfo: async () => ({ uuid: "sheet", documentType: 1 }) },
      sch_PrimitiveComponent: {
        getAll: async () => [component],
        getAllPinsByPrimitiveId: async () => [{ pinNumber: "5", pinName: "V+" }]
      },
      sch_ManufactureData: { getNetlistFile: async () => ({ text: async () => "(\n3V3_LAB\nU15-5\n)" }) }
    });
    const snapshot = await collectSchematicSnapshot(api, { allPages: false, includeRaw: false });
    expect(snapshot.pins[0]).toMatchObject({ net: "3V3_LAB", netSource: "native_netlist" });
    expect(snapshot.nativeNetlist).toMatchObject({ status: "available", matchedPins: 1 });
  });

  it("bounds a hung native read and observes late rejection", async () => {
    vi.useFakeTimers();
    try {
      let reject!: (error: Error) => void;
      const pending = collectNativeNetlist(
        {
          sch_ManufactureData: {
            getNetlistFile: () =>
              new Promise((_, fail) => {
                reject = fail;
              })
          }
        },
        false
      );
      await vi.advanceTimersByTimeAsync(3000);
      expect((await pending).status).toBe("error");
      reject(new Error("late SDK rejection"));
      await vi.advanceTimersByTimeAsync(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
