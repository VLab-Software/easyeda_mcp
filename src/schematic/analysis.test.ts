import { describe, expect, it } from "vitest";
import {
  buildSchematicSnapshot,
  findUnconnectedPins,
  getComponentPins,
  traceComponent,
  traceNet,
  validateSchematicArea
} from "./analysis.js";

describe("schematic analysis", () => {
  it("normalizes components, pins, wires, labels, and nets", () => {
    const snapshot = buildSchematicSnapshot({
      components: [
        component("U1", "$u1", "MCU"),
        netflag("GND", "$gnd1")
      ],
      pinsByComponent: {
        $u1: [
          pin("1", "VDD", "VCC_5V"),
          pin("2", "GND", "GND")
        ]
      },
      wires: [
        wire("VCC_5V"),
        wire("GND")
      ],
      includeRaw: false
    });

    expect(snapshot.counts).toMatchObject({
      components: 2,
      pins: 2,
      wires: 2,
      labels: 1,
      nets: 2
    });
    expect(snapshot.confidence).toBe("high");
    expect(snapshot.nets.map((net) => net.name)).toEqual(["GND", "VCC_5V"]);
  });

  it("gets pins for a component", () => {
    const snapshot = buildSchematicSnapshot({
      components: [component("USB1", "$usb1", "USB-C")],
      pinsByComponent: {
        $usb1: [
          pin("A4", "VBUS", "VCC_5V"),
          pin("A1", "GND", "GND")
        ]
      },
      wires: [wire("VCC_5V"), wire("GND")]
    });

    const result = getComponentPins(snapshot, "USB1");

    expect(result.component?.designator).toBe("USB1");
    expect(result.pins).toHaveLength(2);
    expect(result.confidence).toBe("high");
  });

  it("traces a net and flags a single node net", () => {
    const snapshot = buildSchematicSnapshot({
      components: [component("R1", "$r1", "10k")],
      pinsByComponent: {
        $r1: [pin("1", "1", "SENSE")]
      },
      wires: []
    });

    const result = traceNet(snapshot, "SENSE");

    expect(result.net?.name).toBe("SENSE");
    expect(result.findings[0]?.type).toBe("single_node_net");
  });

  it("finds unconnected pins", () => {
    const snapshot = buildSchematicSnapshot({
      components: [component("U2", "$u2", "Sensor")],
      pinsByComponent: {
        $u2: [
          pin("1", "VDD", "3V3"),
          pin("2", "INT", undefined)
        ]
      },
      wires: [wire("3V3")]
    });

    const result = findUnconnectedPins(snapshot);

    expect(result.pins.map((pin) => pin.pinName)).toEqual(["INT"]);
    expect(result.findings[0]?.message).toContain("U2#2");
  });

  it("validates area with common generic findings", () => {
    const snapshot = buildSchematicSnapshot({
      components: [
        component("U3", "$u3", "IC"),
        component("R1", "$r1", "10k"),
        netflag("+3V3", "$p1"),
        netflag("3V3", "$p2")
      ],
      pinsByComponent: {
        $u3: [
          pin("1", "VCC", "+3V3"),
          pin("2", "NC", undefined)
        ],
        $r1: [pin("1", "1", "SENSE")]
      },
      wires: [wire("+3V3"), wire("SENSE")]
    });

    const result = validateSchematicArea(snapshot);

    expect(result.findings.map((finding) => finding.type)).toContain("pin_without_net");
    expect(result.findings.map((finding) => finding.type)).toContain("single_pin_net");
    expect(result.findings.map((finding) => finding.type)).toContain("similar_power_net_names");
  });

  it("traces component with per-pin net details", () => {
    const snapshot = buildSchematicSnapshot({
      components: [component("C1", "$c1", "100nF")],
      pinsByComponent: {
        $c1: [
          pin("1", "1", "3V3"),
          pin("2", "2", "GND")
        ]
      },
      wires: [wire("3V3"), wire("GND")]
    });

    const result = traceComponent(snapshot, "C1");

    expect(result.pins[0]?.netDetail?.name).toBe("3V3");
    expect(result.findings).toHaveLength(0);
  });

  it("infers a pin net when the pin touches a named wire endpoint", () => {
    const snapshot = buildSchematicSnapshot({
      components: [component("J1", "$j1", "CONN")],
      pinsByComponent: {
        $j1: [pinAt("1", "VBUS", undefined, 10, 0)]
      },
      wires: [wirePath("VBUS", [[10, 0, 40, 0]])],
      includeRaw: false
    });

    expect(snapshot.pins[0]?.net).toBe("VBUS");
    expect(snapshot.pins[0]?.netSource).toBe("wire_inferred");
    expect(snapshot.pins[0]?.connectivityEvidence?.confidence).toBe("high");
  });

  it("infers a pin net when the pin touches a horizontal or vertical wire segment", () => {
    const snapshot = buildSchematicSnapshot({
      components: [component("U1", "$u1", "IC")],
      pinsByComponent: {
        $u1: [
          pinAt("1", "SDA", undefined, 25, 0),
          pinAt("2", "SCL", undefined, 50, 25)
        ]
      },
      wires: [
        wirePath("I2C_SDA", [[10, 0, 40, 0]]),
        wirePath("I2C_SCL", [[50, 10, 50, 40]])
      ],
      includeRaw: false
    });

    expect(snapshot.pins.map((item) => item.net)).toEqual(["I2C_SDA", "I2C_SCL"]);
  });

  it("propagates a net across touching wire segments", () => {
    const snapshot = buildSchematicSnapshot({
      components: [component("U2", "$u2", "IC")],
      pinsByComponent: {
        $u2: [pinAt("1", "EN", undefined, 80, 0)]
      },
      wires: [
        wirePath("GPS_EN", [[0, 0, 40, 0]]),
        wirePath(undefined, [[40, 0, 80, 0]])
      ],
      includeRaw: false
    });

    expect(snapshot.pins[0]?.net).toBe("GPS_EN");
    expect(snapshot.nets.find((net) => net.name === "GPS_EN")?.wires).toHaveLength(2);
  });

  it("uses a netflag to name an otherwise unnamed wire group", () => {
    const snapshot = buildSchematicSnapshot({
      components: [
        component("U3", "$u3", "IC"),
        netflagAt("+3V3", "$pwr", 20, 0)
      ],
      pinsByComponent: {
        $u3: [pinAt("1", "VCC", undefined, 40, 0)]
      },
      wires: [wirePath(undefined, [[0, 0, 40, 0]])],
      includeRaw: false
    });

    expect(snapshot.pins[0]?.net).toBe("+3V3");
    expect(snapshot.pins[0]?.netSource).toBe("label_inferred");
  });

  it("does not treat decorative text as net labels", () => {
    const snapshot = buildSchematicSnapshot({
      components: [],
      texts: [
        { primitiveId: "$txt1", text: "Pull-up", x: 10, y: 10 },
        { primitiveId: "$txt2", text: "GPIO", x: 20, y: 20 }
      ],
      includeRaw: false
    });

    expect(snapshot.labels).toHaveLength(0);
    expect(snapshot.nets).toHaveLength(0);
  });

  it("resolves a USB-C sink fixture through geometry", () => {
    const snapshot = buildSchematicSnapshot({
      components: [
        component("USB1", "$usb1", "USB-C"),
        component("R1", "$r1", "5.1kΩ"),
        component("R2", "$r2", "5.1kΩ"),
        component("D1", "$d1", "USBLC6-2P6"),
        netflagAt("GND", "$gnd", 0, 20)
      ],
      pinsByComponent: {
        $usb1: [
          pinAt("A4", "VBUS", undefined, 10, 0),
          pinAt("A9", "VBUS", undefined, 20, 0),
          pinAt("B4", "VBUS", undefined, 30, 0),
          pinAt("B9", "VBUS", undefined, 40, 0),
          pinAt("A1", "GND", undefined, 10, 20),
          pinAt("A12", "GND", undefined, 20, 20),
          pinAt("B1", "GND", undefined, 30, 20),
          pinAt("B12", "GND", undefined, 40, 20),
          pinAt("1", "EH", undefined, 50, 20),
          pinAt("A5", "CC1", undefined, 10, 40),
          pinAt("B5", "CC2", undefined, 20, 50),
          pinAt("A6", "DP1", undefined, 10, 60),
          pinAt("B6", "DP2", undefined, 20, 60),
          pinAt("A7", "DN1", undefined, 10, 80),
          pinAt("B7", "DN2", undefined, 20, 80)
        ],
        $r1: [
          pinAt("1", "1", undefined, 60, 40),
          pinAt("2", "2", undefined, 60, 20)
        ],
        $r2: [
          pinAt("1", "1", undefined, 70, 50),
          pinAt("2", "2", undefined, 70, 20)
        ],
        $d1: [
          pinAt("1", "I/O1", undefined, 30, 60),
          pinAt("3", "I/O2", undefined, 30, 80),
          pinAt("6", "I/O1", undefined, 50, 60),
          pinAt("4", "I/O2", undefined, 50, 80)
        ]
      },
      wires: [
        wirePath("VBUS", [[10, 0, 40, 0]]),
        wirePath("GND", [[0, 20, 50, 20]]),
        wirePath("USB_IN_CC1", [[10, 40, 60, 40]]),
        wirePath("USB_IN_CC2", [[20, 50, 70, 50]]),
        wirePath("GND", [[60, 20, 70, 20]]),
        wirePath("USB_IN_D+", [[10, 60, 30, 60]]),
        wirePath("USB_IN_D+", [[20, 60, 30, 60]]),
        wirePath("USB_IN_D-", [[10, 80, 30, 80]]),
        wirePath("USB_IN_D-", [[20, 80, 30, 80]]),
        wirePath("USB_D+", [[50, 60, 70, 60]]),
        wirePath("USB_D-", [[50, 80, 70, 80]])
      ],
      includeRaw: false
    });

    const usbPins = getComponentPins(snapshot, "USB1").pins;
    expect(usbPins.filter((item) => item.pinName === "VBUS").map((item) => item.net)).toEqual(["VBUS", "VBUS", "VBUS", "VBUS"]);
    expect(usbPins.filter((item) => ["GND", "EH"].includes(item.pinName ?? "")).map((item) => item.net)).toEqual(["GND", "GND", "GND", "GND", "GND"]);
    expect(usbPins.find((item) => item.pinName === "CC1")?.net).toBe("USB_IN_CC1");
    expect(usbPins.find((item) => item.pinName === "CC2")?.net).toBe("USB_IN_CC2");
    expect(usbPins.find((item) => item.pinName === "DP1")?.net).toBe("USB_IN_D+");
    expect(usbPins.find((item) => item.pinName === "DP2")?.net).toBe("USB_IN_D+");
    expect(usbPins.find((item) => item.pinName === "DN1")?.net).toBe("USB_IN_D-");
    expect(usbPins.find((item) => item.pinName === "DN2")?.net).toBe("USB_IN_D-");
  });
});

function component(designator: string, primitiveId: string, value: string): Record<string, unknown> {
  return {
    primitiveType: "Component",
    componentType: "part",
    primitiveId,
    designator,
    value,
    x: 10,
    y: 20
  };
}

function netflag(net: string, primitiveId: string): Record<string, unknown> {
  return netflagAt(net, primitiveId, 0, 0);
}

function netflagAt(net: string, primitiveId: string, x: number, y: number): Record<string, unknown> {
  return {
    primitiveType: "Component",
    componentType: "netflag",
    primitiveId,
    net,
    x,
    y
  };
}

function pin(pinNumber: string, pinName: string, net: string | undefined): Record<string, unknown> {
  return pinAt(pinNumber, pinName, net, 30, 40);
}

function pinAt(pinNumber: string, pinName: string, net: string | undefined, x: number, y: number): Record<string, unknown> {
  return {
    primitiveId: `$pin-${pinNumber}`,
    pinNumber,
    pinName,
    net,
    x,
    y
  };
}

function wire(net: string): Record<string, unknown> {
  return wirePath(net, [[0, 0], [10, 10]]);
}

function wirePath(net: string | undefined, line: unknown[]): Record<string, unknown> {
  return {
    primitiveId: `$wire-${net}`,
    net,
    line
  };
}
