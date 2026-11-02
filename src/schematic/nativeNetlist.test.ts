import { describe, expect, it } from "vitest";
import { applyNativeNetlist, parseProtel2 } from "./nativeNetlist.js";
import { buildSchematicSnapshot } from "./analysis.js";
import type { SchematicPin } from "./types.js";

const text = "[\nUSB2\nUSB-C\nConnector\n]\n(\nUSB_D+\nUSB2-A6\nUSB2-B6\n)\n(\nUSB_D-\nUSB2-A7\nUSB2-B7\n)";
const pin: SchematicPin = {
  componentDesignator: "USB2",
  pinNumber: "A6",
  net: "WRONG",
  nodeId: "net:WRONG",
  connected: true,
  position: {}
};

describe("native Protel2 membership", () => {
  it("parses component records, CRLF and polarity-sensitive net names", () => {
    const nets = parseProtel2("\uFEFF" + text.replace(/\n/g, "\r\n"));
    expect(nets.get("USB_D+")).toEqual(["USB2-A6", "USB2-B6"]);
    expect(nets.get("USB_D-")).toEqual(["USB2-A7", "USB2-B7"]);
  });
  it.each(["", "not a netlist", "(\nNET\nU1-1", "(\n)\n", "(\nNET\ninvalid-memberless\n[\n)"])(
    "rejects unsupported or incomplete data: %j",
    (bad) => {
      expect(() => parseProtel2(bad)).toThrow();
    }
  );
  it("prefers native pin membership and reports a disagreement", () => {
    const result = applyNativeNetlist([pin], { status: "available", format: "Protel2", text });
    expect(result.pins[0]).toMatchObject({ net: "USB_D+", nodeId: "net:USB_D+", netSource: "native_netlist" });
    expect(result.report).toMatchObject({ matchedPins: 1, conflicts: 1 });
    expect(result.warnings[0]).toMatch(/disagreement/);
  });
  it("does not interpret absent pins as disconnected or match duplicate references", () => {
    for (const data of [{ text: "(\nGND\nOTHER-1\n)" }, { text, ambiguousDesignators: ["USB2"] }]) {
      const result = applyNativeNetlist([pin], { ...data, status: "available", format: "Protel2" });
      expect(result.pins[0]).toEqual(pin);
      expect(result.report.matchedPins).toBe(0);
    }
  });
  it("leaves contradictory native memberships unknown", () => {
    const result = applyNativeNetlist([pin], {
      status: "available",
      format: "Protel2",
      text: "(\nA\nUSB2-A6\n)\n(\nB\nUSB2-A6\n)"
    });
    expect(result.pins[0]).toMatchObject({ netSource: "unknown" });
    expect(result.pins[0].net).toBeUndefined();
    expect(result.pins[0].nodeId).toBeUndefined();
    expect(result.report.conflicts).toBe(1);
  });
  it("keeps geometric data when parsing fails", () => {
    const result = applyNativeNetlist([pin], { status: "available", format: "Protel2", text: "ZIP or unknown format" });
    expect(result.report.status).toBe("unsupported");
    expect(result.pins[0]).toEqual(pin);
  });
  it("builds native pin nets without any image or wire geometry", () => {
    const snapshot = buildSchematicSnapshot({
      components: [{ primitiveId: "usb", designator: "USB2", componentType: "part" }],
      pinsByComponent: {
        usb: [
          { pinNumber: "A6", pinName: "D+" },
          { pinNumber: "A7", pinName: "D-" }
        ]
      },
      nativeNetlist: { status: "available", format: "Protel2", text }
    });
    expect(snapshot.pins.map((p) => p.net)).toEqual(["USB_D+", "USB_D-"]);
    expect(snapshot.nativeNetlist?.matchedPins).toBe(2);
    expect(snapshot.nets.map((n) => n.name)).toEqual(["USB_D-", "USB_D+"]);
  });
});
