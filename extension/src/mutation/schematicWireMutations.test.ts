import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  normalizeLineCoordinates,
  extractPointsFromFlat,
  findTouchingConnections,
  findWireById,
  prepareSchematicWireMutation,
  executeSchematicWireMutation
} from "./schematicWireMutations.js";
import { extensionMutations } from "./mutationManager.js";
import { createActionHandlers } from "../handlers/actionHandlers.js";
import { DrcRules } from "../drcRules.js";

describe("Schematic Wire & Net Label Mutations", () => {
  beforeEach(() => {
    extensionMutations.invalidateAll();
  });

  describe("normalizeLineCoordinates & extractPointsFromFlat", () => {
    it("accepts flat array of coordinates [x1, y1, x2, y2]", () => {
      expect(normalizeLineCoordinates([100, 200, 300, 400])).toEqual([100, 200, 300, 400]);
    });

    it("accepts array of coordinate pairs [[x1, y1], [x2, y2]]", () => {
      expect(
        normalizeLineCoordinates([
          [100, 200],
          [300, 400]
        ])
      ).toEqual([100, 200, 300, 400]);
    });

    it("throws on invalid coordinates", () => {
      expect(() => normalizeLineCoordinates([100, 200])).toThrow(/at least 2 points/);
      expect(() => normalizeLineCoordinates([100, 200, 300])).toThrow(/at least 2 points/);
      expect(() => normalizeLineCoordinates("invalid")).toThrow(/at least 2 points/);
    });

    it("extracts points from flat array", () => {
      const points = extractPointsFromFlat([10, 20, 30, 40]);
      expect(points).toEqual([
        { x: 10, y: 20 },
        { x: 30, y: 40 }
      ]);
    });
  });

  describe("findTouchingConnections", () => {
    it("finds component pins within tolerance of wire points", async () => {
      const api = () => ({
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [
            {
              primitiveId: "u1",
              designator: "U1",
              pins: [
                { name: "VCC", pinNumber: "1", x: 100, y: 200, net: "VBUS" },
                { name: "GND", pinNumber: "2", x: 100, y: 250 }
              ]
            }
          ])
        }
      });

      const touching = await findTouchingConnections(api, [{ x: 102, y: 199 }], 5);
      expect(touching).toHaveLength(1);
      expect(touching[0]).toMatchObject({
        component: "U1",
        pin: "VCC",
        net: "VBUS",
        x: 100,
        y: 200
      });
    });
  });

  describe("findWireById", () => {
    it("locates wire by primitiveId", async () => {
      const api = () => ({
        sch_PrimitiveWire: {
          getAll: vi.fn(async () => [{ primitiveId: "w1", net: "GND", line: [0, 0, 10, 10] }])
        }
      });

      const wire = await findWireById(api, "w1");
      expect(wire.primitiveId).toBe("w1");
      expect(wire.net).toBe("GND");
    });

    it("throws wire_not_found if wire does not exist", async () => {
      const api = () => ({
        sch_PrimitiveWire: {
          getAll: vi.fn(async () => [])
        }
      });

      await expect(findWireById(api, "w999")).rejects.toThrow(/was not found/);
    });
  });

  describe("prepareSchematicWireMutation", () => {
    const mockSchematicApi =
      (wires: any[] = []) =>
      () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "sch-doc-1",
            name: "Sheet1.SchDoc",
            documentType: 1
          }))
        },
        sch_PrimitiveWire: {
          getAll: vi.fn(async () => wires)
        }
      });

    it("prepares a createWire mutation with preview and confirmation", async () => {
      const api = mockSchematicApi();
      const result = await prepareSchematicWireMutation(api, {
        action: "createWire",
        coordinates: [100, 200, 300, 200],
        net: "CLK"
      });

      expect(result.mutationId).toBeDefined();
      expect(result.confirmation).toBe(`CONFIRM schematic:createWire ${result.mutationId}`);
      expect(result.preview).toMatchObject({
        requestedAfter: {
          coordinates: [100, 200, 300, 200],
          pointsCount: 2,
          net: "CLK"
        },
        changedKeys: ["coordinates", "net"]
      });
    });

    it("prepares a modifyWire mutation", async () => {
      const api = mockSchematicApi([{ primitiveId: "wire-1", net: "D+", line: [0, 0, 50, 0] }]);
      const result = await prepareSchematicWireMutation(api, {
        action: "modifyWire",
        wireId: "wire-1",
        net: "D-"
      });

      expect(result.preview).toMatchObject({
        before: { net: "D+" },
        requestedAfter: { net: "D-" },
        changedKeys: ["net"]
      });
    });

    it("prepares a deleteWire mutation", async () => {
      const api = mockSchematicApi([{ primitiveId: "wire-1", net: "D+", line: [0, 0, 50, 0] }]);
      const result = await prepareSchematicWireMutation(api, {
        action: "deleteWire",
        wireId: "wire-1"
      });

      expect(result.preview).toMatchObject({
        before: { wireId: "wire-1", net: "D+" },
        requestedAfter: null,
        changedKeys: ["deleted"]
      });
    });

    it("prepares an addNetLabel mutation", async () => {
      const api = mockSchematicApi();
      const result = await prepareSchematicWireMutation(api, {
        action: "addNetLabel",
        net: "RESET",
        x: 500,
        y: 600,
        kind: "label"
      });

      expect(result.preview).toMatchObject({
        requestedAfter: {
          net: "RESET",
          x: 500,
          y: 600,
          kind: "label"
        },
        changedKeys: ["net", "x", "y", "kind"]
      });
    });

    it("rejects non-schematic documents", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "pcb-doc-1",
            documentType: 3
          }))
        }
      });

      await expect(
        prepareSchematicWireMutation(api, {
          action: "createWire",
          coordinates: [0, 0, 10, 10]
        })
      ).rejects.toThrow(/Wire and net label mutations require an active schematic document/);
    });
  });

  describe("executeSchematicWireMutation & ActionHandler integration", () => {
    it("executes createWire, checks affected connections, and records readback", async () => {
      let createdWire: any = null;
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "sch-doc-1",
            name: "Sheet1.SchDoc",
            documentType: 1
          }))
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [
            {
              primitiveId: "u1",
              designator: "U1",
              pins: [{ name: "OUT", pinNumber: "3", x: 100, y: 100 }]
            }
          ])
        },
        sch_PrimitiveWire: {
          create: vi.fn(async (coords, net) => {
            createdWire = { primitiveId: "wire-created-1", line: coords, net };
            return { getState_PrimitiveId: () => "wire-created-1", net };
          }),
          getAll: vi.fn(async () => (createdWire ? [createdWire] : []))
        }
      });

      // 1. Prepare
      const prep = await prepareSchematicWireMutation(api, {
        action: "createWire",
        coordinates: [100, 100, 200, 100],
        net: "SIGNAL"
      });

      // 2. Apply via actionHandlers
      const actionHandlers = createActionHandlers(api, new DrcRules(api));
      const res = (await actionHandlers.confirmedAction({
        action: "mutation",
        confirmation: prep.confirmation,
        params: { mutationId: prep.mutationId }
      })) as any;

      expect(res.status).toBe("applied");
      expect(res.documentSaved).toBe(false);
      expect(res.after).toMatchObject({
        primitiveId: "wire-created-1",
        net: "SIGNAL",
        pointsCount: 2,
        verified: true
      });
      expect(res.after.affectedConnections).toHaveLength(1);
      expect(res.after.affectedConnections[0]).toMatchObject({
        component: "U1",
        pin: "OUT"
      });
    });

    it("executes deleteWire and verifies absence in readback", async () => {
      let wires = [{ primitiveId: "wire-del-1", line: [0, 0, 50, 0], net: "NC" }];
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "sch-doc-1",
            documentType: 1
          }))
        },
        sch_PrimitiveWire: {
          getAll: vi.fn(async () => wires),
          delete: vi.fn(async () => {
            wires = [];
          })
        }
      });

      const prep = await prepareSchematicWireMutation(api, {
        action: "deleteWire",
        wireId: "wire-del-1"
      });

      const record = extensionMutations.get(String(prep.mutationId));
      const exec = await executeSchematicWireMutation(record, api);

      expect(exec.executed).toBe(true);
      expect(exec.readback).toMatchObject({
        wireId: "wire-del-1",
        deleted: true,
        verified: true
      });
      expect(wires).toHaveLength(0);
    });

    it("executes addNetLabel and verifies readback", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "sch-doc-1",
            documentType: 1
          }))
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => []),
          createNetFlag: vi.fn(async () => ({ id: "flag-1" }))
        },
        sch_PrimitiveAttribute: {
          createNetLabel: vi.fn(async (x, y, net) => ({ id: "lbl-1", x, y, net }))
        }
      });

      const prep = await prepareSchematicWireMutation(api, {
        action: "addNetLabel",
        net: "VBUS",
        x: 200,
        y: 300,
        kind: "label"
      });

      const record = extensionMutations.get(String(prep.mutationId));
      const exec = await executeSchematicWireMutation(record, api);

      expect(exec.executed).toBe(true);
      expect(exec.readback).toMatchObject({
        net: "VBUS",
        x: 200,
        y: 300,
        kind: "label",
        verified: true
      });
    });
  });
});

describe("native wire rename readback", () => {
  function fixture(options: { ignoreWrite?: boolean; invalidReadback?: boolean } = {}) {
    class NativeWire {
      primitiveId = "native-wire";
      net = "TEST_USB_GND";
      line = [240, 620, 300, 620];
      // These native members must never be copied into the lifecycle record.
      nativeMetadata = new Map([["editor", "native"]]);
      getState_PrimitiveId() {
        return this.primitiveId;
      }
      getState_Net() {
        return this.net;
      }
      getState_Line() {
        return options.invalidReadback && this.net === "GND" ? [NaN] : this.line;
      }
    }
    const wire = new NativeWire();
    const modify = vi.fn(async (_id: string, properties: Record<string, unknown>) => {
      if (!options.ignoreWrite) wire.net = String(properties.net);
    });
    const api = () => ({
      dmt_SelectControl: { getCurrentDocumentInfo: async () => ({ uuid: "rename-sheet", documentType: 1 }) },
      sch_PrimitiveWire: { get: async () => wire, getAll: async () => [wire], modify }
    });
    return { api, wire, modify };
  }

  it("confirms a native class instance as plain JSON after renaming once", async () => {
    const { api, modify } = fixture();
    const prepared = await prepareSchematicWireMutation(api, {
      action: "modifyWire",
      wireId: "native-wire",
      net: "GND"
    });
    const result: any = await createActionHandlers(api, new DrcRules(api)).confirmedAction({
      action: "mutation",
      confirmation: prepared.confirmation,
      params: { mutationId: prepared.mutationId }
    });
    expect(result.status).toBe("applied");
    expect(result.after).toMatchObject({
      wire: { primitiveId: "native-wire", net: "GND", line: [240, 620, 300, 620] },
      verified: true
    });
    expect((result.after as any).wire.nativeMetadata).toBeUndefined();
    expect(modify).toHaveBeenCalledTimes(1);
  });

  it.each([{ ignoreWrite: true }, { invalidReadback: true }])(
    "preserves uncertainty when native readback fails: %j",
    async (options) => {
      const { api, modify } = fixture(options);
      const prepared = await prepareSchematicWireMutation(api, {
        action: "modifyWire",
        wireId: "native-wire",
        net: "GND"
      });
      const result: any = await createActionHandlers(api, new DrcRules(api)).confirmedAction({
        action: "mutation",
        confirmation: prepared.confirmation,
        params: { mutationId: prepared.mutationId }
      });
      expect(result.status).toBe("unknown");
      expect(result.error).toMatch(/readback/);
      expect(result.execution).toMatchObject({ lockHeld: false });
      expect(modify).toHaveBeenCalledTimes(1);
    }
  );
});
