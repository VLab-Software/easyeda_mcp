import { describe, expect, it } from "vitest";
import { buildSchematicSnapshot, verifyConnections } from "./analysis.js";
import { extractSegments, netNodeId } from "./normalization.js";

describe("schematic wire geometry", () => {
  it("reads all legs of flat and nested polylines", () => {
    const expected = [
      { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
      { start: { x: 10, y: 0 }, end: { x: 10, y: 20 } }
    ];
    expect(extractSegments([0, 0, 10, 0, 10, 20])).toEqual(expected);
    expect(extractSegments([[0, 0, 10, 0, 10, 20]])).toEqual(expected);
    expect(
      extractSegments([
        [0, 0],
        [10, 0],
        [10, 20]
      ])
    ).toEqual(expected);
    expect(
      extractSegments([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 20 }
      ])
    ).toEqual(expected);
  });

  it("does not bridge independent paths or malformed coordinates", () => {
    expect(
      extractSegments([
        [0, 0, 10, 0],
        [20, 0, 30, 0]
      ])
    ).toHaveLength(2);
    expect(
      extractSegments([
        [0, 0],
        [10, 0, 20, 0],
        [30, 0]
      ])
    ).toHaveLength(1);
    expect(extractSegments([{ x: 0, y: 0 }, {}, { x: 30, y: 0 }])).toEqual([]);
    for (const invalid of [
      [0, 0, 10],
      [0, 0, NaN, 10],
      [0, 0, Infinity, 10],
      [0, 0, "10", 10]
    ]) {
      expect(extractSegments(invalid)).toEqual([]);
    }
  });

  it("resolves charger pins and branches from flat wire coordinates", () => {
    const snapshot = buildSchematicSnapshot({
      components: [{ primitiveId: "u5", designator: "U5", componentType: "part" }],
      pinsByComponent: {
        u5: [
          { pinNumber: "3", pinName: "BAT", x: 360, y: 390 },
          { pinNumber: "4", pinName: "VCC", x: 480, y: 390 },
          { pinNumber: "2", pinName: "GND", x: 360, y: 410 }
        ]
      },
      wires: [
        { primitiveId: "bat", net: "VBAT_LIPO", line: [350, 390, 320, 390, 350, 390, 360, 390] },
        { primitiveId: "vcc", net: "VBUS", line: [480, 390, 500, 390] },
        { primitiveId: "gnd", net: "GND", line: [310, 410, 360, 410, 310, 410, 310, 350] }
      ]
    });
    expect(snapshot.pins.map((pin) => pin.net)).toEqual(["VBAT_LIPO", "VBUS", "GND"]);
    expect(snapshot.pins.every((pin) => pin.connected)).toBe(true);
  });
});

describe("schematic net identity", () => {
  it("preserves punctuation and exact names", () => {
    const names = ["USB_D+", "USB_D-", "USB_D", "+3V3", "3V3", "BATT_GND", "BATT-GND", "电源+", "电源-"];
    expect(new Set(names.map(netNodeId)).size).toBe(names.length);
  });

  it("does not report opposite USB signals on the same node", () => {
    const snapshot = buildSchematicSnapshot({
      components: [{ primitiveId: "usb", designator: "USB1", componentType: "part" }],
      pinsByComponent: {
        usb: [
          { pinNumber: "1", pinName: "D+", net: "USB_D+" },
          { pinNumber: "2", pinName: "D-", net: "USB_D-" }
        ]
      }
    });
    const result = verifyConnections(snapshot, [
      {
        type: "same_node",
        left: { component: "USB1", pin: "1" },
        right: { component: "USB1", pin: "2" }
      }
    ]);
    expect(snapshot.pins[0].nodeId).not.toBe(snapshot.pins[1].nodeId);
    expect(result.checks[0].status).toBe("fail");
  });
});
