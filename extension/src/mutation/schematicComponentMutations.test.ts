import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  findComponentInSchematic,
  prepareSchematicComponentMutation,
  executeSchematicComponentMutation
} from "./schematicComponentMutations.js";
import { extensionMutations } from "./mutationManager.js";
import { createActionHandlers } from "../handlers/actionHandlers.js";
import { DrcRules } from "../drcRules.js";

describe("Schematic Component Mutations", () => {
  beforeEach(() => {
    extensionMutations.invalidateAll();
  });

  describe("findComponentInSchematic", () => {
    it("resolves component by primitiveId and by designator case-insensitively", async () => {
      const api = () => ({
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [
            { primitiveId: "prim-1", designator: "R1", x: 100, y: 200, value: "10k" },
            { id: "prim-2", name: "U1", x: 500, y: 600, comment: "ESP32" }
          ])
        }
      });

      const byId = await findComponentInSchematic(api, "prim-1");
      expect(byId.primitiveId).toBe("prim-1");
      expect(byId.designator).toBe("R1");
      expect(byId.x).toBe(100);

      const byDesignator = await findComponentInSchematic(api, "r1");
      expect(byDesignator.primitiveId).toBe("prim-1");

      const byU1 = await findComponentInSchematic(api, "u1");
      expect(byU1.primitiveId).toBe("prim-2");
      expect(byU1.designator).toBe("U1");
    });

    it("throws component_not_found if component does not exist", async () => {
      const api = () => ({
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [])
        }
      });

      await expect(findComponentInSchematic(api, "C99")).rejects.toThrow(/was not found/);
    });
  });

  describe("prepareSchematicComponentMutation", () => {
    const mockSchematicApi =
      (components: any[] = []) =>
      () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "sch-doc-1",
            name: "Sheet1.SchDoc",
            documentType: 1
          }))
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => components)
        }
      });

    it("prepares a create component mutation with preview and confirmation", async () => {
      const api = mockSchematicApi();
      const result = await prepareSchematicComponentMutation(api, {
        action: "create",
        device: "C1523",
        x: 1500,
        y: 2500,
        designator: "R1"
      });

      expect(result.mutationId).toBeDefined();
      expect(result.confirmation).toBe(`CONFIRM schematic:createComponent ${result.mutationId}`);
      expect(result.preview).toMatchObject({
        requestedAfter: {
          device: "C1523",
          x: 1500,
          y: 2500,
          designator: "R1"
        },
        changedKeys: ["device", "x", "y", "designator"]
      });
    });

    it("prepares a move component mutation with relative deltas", async () => {
      const api = mockSchematicApi([{ primitiveId: "prim-1", designator: "R1", x: 100, y: 200 }]);

      const result = await prepareSchematicComponentMutation(api, {
        action: "move",
        component: "R1",
        dx: 50,
        dy: -20
      });

      expect(result.preview).toMatchObject({
        before: { x: 100, y: 200 },
        requestedAfter: { x: 150, y: 180 },
        changedKeys: ["x", "y"]
      });
    });

    it("prepares an update component mutation", async () => {
      const api = mockSchematicApi([{ primitiveId: "prim-1", designator: "R1", x: 100, y: 200, value: "10k" }]);

      const result = await prepareSchematicComponentMutation(api, {
        action: "update",
        component: "R1",
        value: "22k",
        designator: "R2"
      });

      expect(result.preview).toMatchObject({
        before: { designator: "R1", value: "10k" },
        requestedAfter: { designator: "R2", value: "22k" },
        changedKeys: expect.arrayContaining(["designator", "value"])
      });
    });

    it("prepares a delete component mutation", async () => {
      const api = mockSchematicApi([{ primitiveId: "prim-1", designator: "R1", x: 100, y: 200 }]);

      const result = await prepareSchematicComponentMutation(api, {
        action: "delete",
        component: "prim-1"
      });

      expect(result.preview).toMatchObject({
        before: { primitiveId: "prim-1", designator: "R1" },
        requestedAfter: null,
        changedKeys: ["deleted"]
      });
    });

    it("rejects when active document is not schematic", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "pcb-doc-1",
            documentType: 3
          }))
        }
      });

      await expect(
        prepareSchematicComponentMutation(api, { action: "create", device: "C1", x: 0, y: 0 })
      ).rejects.toThrow(/Schematic component mutations require an active schematic document/);
    });

    it("rejects when document target does not match", async () => {
      const api = mockSchematicApi();
      await expect(
        prepareSchematicComponentMutation(api, {
          action: "create",
          device: "C1",
          x: 0,
          y: 0,
          target: { documentId: "other-doc" }
        })
      ).rejects.toThrow(/Active document ID changed/);
    });
  });

  describe("executeSchematicComponentMutation & ActionHandler integration", () => {
    it("executes createComponent mutation and verifies readback", async () => {
      let createdDoc: any = null;
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "sch-doc-1",
            name: "Sheet1.SchDoc",
            documentType: 1
          }))
        },
        lib_Device: {
          search: vi.fn(async () => [{ uuid: "dev-c1523", name: "10k 0603" }])
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => (createdDoc ? [createdDoc] : [])),
          create: vi.fn(async (device, x, y) => {
            createdDoc = { primitiveId: "prim-new-1", designator: "R10", x, y };
            return { getState_PrimitiveId: () => "prim-new-1" };
          }),
          modify: vi.fn(async (id, props) => {
            if (createdDoc) Object.assign(createdDoc, props);
          }),
          get: vi.fn(async (id) => (createdDoc?.primitiveId === id ? createdDoc : null))
        }
      });

      // 1. Prepare
      const prep = await prepareSchematicComponentMutation(api, {
        action: "create",
        device: "10k 0603",
        x: 1000,
        y: 2000,
        designator: "R10"
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
        primitiveId: "prim-new-1",
        designator: "R10",
        x: 1000,
        y: 2000,
        verified: true
      });

      // 3. Query result via getMutationResult
      const queryRes = actionHandlers.getMutationResult({ mutationId: prep.mutationId }) as any;
      expect(queryRes.status).toBe("applied");
      expect(queryRes.after.verified).toBe(true);
    });

    it("executes moveComponent mutation and verifies readback position", async () => {
      const comp = { primitiveId: "prim-1", designator: "R1", x: 100, y: 200 };
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "sch-doc-1",
            documentType: 1
          }))
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => [comp]),
          modify: vi.fn(async (id, props) => {
            if (props.x !== undefined) comp.x = props.x;
            if (props.y !== undefined) comp.y = props.y;
          })
        }
      });

      const prep = await prepareSchematicComponentMutation(api, {
        action: "move",
        component: "R1",
        x: 350,
        y: 450
      });

      const record = extensionMutations.get(String(prep.mutationId));
      const exec = await executeSchematicComponentMutation(record, api);

      expect(exec.executed).toBe(true);
      expect(exec.readback).toMatchObject({
        primitiveId: "prim-1",
        x: 350,
        y: 450,
        verified: true
      });
      expect(comp.x).toBe(350);
      expect(comp.y).toBe(450);
    });

    it("executes deleteComponent and verifies absence in readback", async () => {
      let components = [{ primitiveId: "prim-del", designator: "U5", x: 0, y: 0 }];
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "sch-doc-1",
            documentType: 1
          }))
        },
        sch_PrimitiveComponent: {
          getAll: vi.fn(async () => components),
          delete: vi.fn(async () => {
            components = [];
          })
        }
      });

      const prep = await prepareSchematicComponentMutation(api, {
        action: "delete",
        component: "U5"
      });

      const record = extensionMutations.get(String(prep.mutationId));
      const exec = await executeSchematicComponentMutation(record, api);

      expect(exec.executed).toBe(true);
      expect(exec.readback).toMatchObject({
        primitiveId: "prim-del",
        deleted: true,
        verified: true
      });
      expect(components).toHaveLength(0);
    });
  });
});
