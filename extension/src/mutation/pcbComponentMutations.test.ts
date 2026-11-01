import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  findComponentInPcb,
  preparePcbComponentMutation,
  executePcbComponentMutation
} from "./pcbComponentMutations.js";
import { extensionMutations } from "./mutationManager.js";
import { createActionHandlers } from "../handlers/actionHandlers.js";
import { DrcRules } from "../drcRules.js";

describe("PCB Component Mutations", () => {
  beforeEach(() => {
    extensionMutations.invalidateAll();
  });

  describe("findComponentInPcb", () => {
    it("resolves component by primitiveId and designator case-insensitively", async () => {
      const api = () => ({
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => [
            {
              primitiveId: "prim_r1",
              designator: "R1",
              x: 100,
              y: 200,
              rotation: 90,
              layer: 1,
              footprint: "0805",
              value: "10k"
            },
            {
              id: "prim_u1",
              name: "U1",
              centerX: 50,
              centerY: 60,
              angle: 180,
              layerId: 2,
              package: "SOIC-8"
            }
          ])
        }
      });

      const byId = await findComponentInPcb(api, "prim_r1");
      expect(byId.primitiveId).toBe("prim_r1");
      expect(byId.designator).toBe("R1");
      expect(byId.x).toBe(100);
      expect(byId.y).toBe(200);
      expect(byId.rotation).toBe(90);
      expect(byId.side).toBe("top");
      expect(byId.footprint).toBe("0805");

      const byDesignator = await findComponentInPcb(api, "r1");
      expect(byDesignator.primitiveId).toBe("prim_r1");

      const byU1 = await findComponentInPcb(api, "u1");
      expect(byU1.primitiveId).toBe("prim_u1");
      expect(byU1.designator).toBe("U1");
      expect(byU1.x).toBe(50);
      expect(byU1.y).toBe(60);
      expect(byU1.rotation).toBe(180);
      expect(byU1.side).toBe("bottom");
      expect(byU1.footprint).toBe("SOIC-8");
    });

    it("throws component_not_found if component is absent", async () => {
      const api = () => ({
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => [])
        }
      });

      await expect(findComponentInPcb(api, "C1")).rejects.toThrow(/was not found/);
    });
  });

  describe("preparePcbComponentMutation", () => {
    const mockPcbApi =
      (components: any[] = []) =>
      () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "pcb-doc-1",
            name: "Board.PcbDoc",
            documentType: 3
          }))
        },
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => components)
        }
      });

    it("prepares a move component mutation with absolute coordinates", async () => {
      const api = mockPcbApi([{ primitiveId: "prim_r1", designator: "R1", x: 100, y: 200, rotation: 0, layer: 1 }]);

      const result = await preparePcbComponentMutation(api, {
        action: "move",
        component: "R1",
        x: 150,
        y: 250
      });

      expect(result.mutationId).toBeDefined();
      expect(result.confirmation).toBe(`CONFIRM pcb:move ${result.mutationId}`);
      expect(result.action).toBe("move");
      expect(result.preview).toMatchObject({
        before: { x: 100, y: 200 },
        requestedAfter: { x: 150, y: 250 },
        changedKeys: ["x", "y"]
      });
    });

    it("prepares a move component mutation with relative offsets (dx, dy)", async () => {
      const api = mockPcbApi([{ primitiveId: "prim_r1", designator: "R1", x: 100, y: 200, rotation: 0, layer: 1 }]);

      const result = await preparePcbComponentMutation(api, {
        action: "move",
        component: "R1",
        dx: 20,
        dy: -30
      });

      expect(result.preview).toMatchObject({
        before: { x: 100, y: 200 },
        requestedAfter: { x: 120, y: 170 },
        changedKeys: ["x", "y"]
      });
    });

    it("rejects move if coordinates result in no change", async () => {
      const api = mockPcbApi([{ primitiveId: "prim_r1", designator: "R1", x: 100, y: 200, rotation: 0, layer: 1 }]);

      await expect(
        preparePcbComponentMutation(api, {
          action: "move",
          component: "R1",
          x: 100,
          y: 200
        })
      ).rejects.toThrow(/no change/);
    });

    it("prepares a rotate component mutation with absolute rotation", async () => {
      const api = mockPcbApi([{ primitiveId: "prim_r1", designator: "R1", x: 100, y: 200, rotation: 0, layer: 1 }]);

      const result = await preparePcbComponentMutation(api, {
        action: "rotate",
        component: "R1",
        rotation: 90
      });

      expect(result.confirmation).toBe(`CONFIRM pcb:rotate ${result.mutationId}`);
      expect(result.preview).toMatchObject({
        before: { rotation: 0 },
        requestedAfter: { rotation: 90 },
        changedKeys: ["rotation"]
      });
    });

    it("prepares a rotate component mutation with relative dRotation", async () => {
      const api = mockPcbApi([{ primitiveId: "prim_r1", designator: "R1", x: 100, y: 200, rotation: 90, layer: 1 }]);

      const result = await preparePcbComponentMutation(api, {
        action: "rotate",
        component: "R1",
        dRotation: 180
      });

      expect(result.preview).toMatchObject({
        before: { rotation: 90 },
        requestedAfter: { rotation: 270 },
        changedKeys: ["rotation"]
      });
    });

    it("rejects rotate with no change", async () => {
      const api = mockPcbApi([{ primitiveId: "prim_r1", designator: "R1", x: 100, y: 200, rotation: 90, layer: 1 }]);

      await expect(
        preparePcbComponentMutation(api, {
          action: "rotate",
          component: "R1",
          rotation: 90
        })
      ).rejects.toThrow(/no rotation change/);
    });

    it("prepares a flip component mutation toggling top to bottom", async () => {
      const api = mockPcbApi([{ primitiveId: "prim_r1", designator: "R1", x: 100, y: 200, rotation: 0, layer: 1 }]);

      const result = await preparePcbComponentMutation(api, {
        action: "flip",
        component: "R1"
      });

      expect(result.confirmation).toBe(`CONFIRM pcb:flip ${result.mutationId}`);
      expect(result.preview).toMatchObject({
        before: { layer: 1, side: "top" },
        requestedAfter: { layer: 2, side: "bottom" },
        changedKeys: ["layer", "side"]
      });
    });

    it("prepares a delete component mutation", async () => {
      const api = mockPcbApi([{ primitiveId: "prim_r1", designator: "R1", x: 100, y: 200, rotation: 0, layer: 1 }]);

      const result = await preparePcbComponentMutation(api, {
        action: "delete",
        component: "R1"
      });

      expect(result.confirmation).toBe(`CONFIRM pcb:delete ${result.mutationId}`);
      expect(result.preview).toMatchObject({
        before: { exists: true, primitiveId: "prim_r1", designator: "R1" },
        requestedAfter: { exists: false },
        changedKeys: ["deleted"]
      });
    });

    it("rejects if active document is not a PCB", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "sch-1",
            name: "Sheet1.SchDoc",
            documentType: 1
          }))
        },
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => [])
        }
      });

      await expect(
        preparePcbComponentMutation(api, {
          action: "move",
          component: "R1",
          x: 10,
          y: 20
        })
      ).rejects.toThrow(/require an active PCB document/);
    });
  });

  describe("executePcbComponentMutation and actionHandlers confirmation", () => {
    it("executes move via modify and verifies readback", async () => {
      const state = {
        primitiveId: "prim_r1",
        designator: "R1",
        x: 100,
        y: 200,
        rotation: 0,
        layer: 1
      };

      const modifyMock = vi.fn(async (id: string, updates: any) => {
        Object.assign(state, updates);
        return true;
      });

      const api = () => ({
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => [state]),
          modify: modifyMock
        }
      });

      const result = await executePcbComponentMutation(api, {
        action: "move",
        primitiveId: "prim_r1",
        designator: "R1",
        toX: 120,
        toY: 230
      });

      expect(result.executed).toBe(true);
      expect(result.readback).toMatchObject({
        primitiveId: "prim_r1",
        x: 120,
        y: 230,
        verified: true
      });
      expect(modifyMock).toHaveBeenCalledWith("prim_r1", { x: 120, y: 230 });
    });

    it("executes rotate via toAsync and verifies readback", async () => {
      const state = {
        primitiveId: "prim_r1",
        designator: "R1",
        x: 100,
        y: 200,
        rotation: 0,
        layer: 1
      };

      const setRotationMock = vi.fn(async (rot: number) => {
        state.rotation = rot;
      });
      const doneMock = vi.fn(async () => true);

      const api = () => ({
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => [state]),
          get: vi.fn(async () => ({
            toAsync: () => ({
              setState_Rotation: setRotationMock,
              done: doneMock
            })
          }))
        }
      });

      const result = await executePcbComponentMutation(api, {
        action: "rotate",
        primitiveId: "prim_r1",
        designator: "R1",
        toRotation: 90
      });

      expect(result.executed).toBe(true);
      expect(result.readback).toMatchObject({
        primitiveId: "prim_r1",
        rotation: 90,
        verified: true
      });
      expect(setRotationMock).toHaveBeenCalledWith(90);
      expect(doneMock).toHaveBeenCalled();
    });

    it("throws readback_verification_failed if move did not reflect in state", async () => {
      const state = {
        primitiveId: "prim_r1",
        designator: "R1",
        x: 100,
        y: 200,
        rotation: 0,
        layer: 1
      };

      const api = () => ({
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => [state]),
          modify: vi.fn(async () => {
            // Fails to update state
          })
        }
      });

      await expect(
        executePcbComponentMutation(api, {
          action: "move",
          primitiveId: "prim_r1",
          designator: "R1",
          toX: 120,
          toY: 230
        })
      ).rejects.toThrow(/Move readback failed/);
    });

    it("executes flip and delete, integrated via confirmed_action", async () => {
      let components = [
        {
          primitiveId: "prim_r1",
          designator: "R1",
          x: 100,
          y: 200,
          rotation: 0,
          layer: 1
        }
      ];

      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "pcb-doc-1",
            name: "Board.PcbDoc",
            documentType: 3
          }))
        },
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => components),
          delete: vi.fn(async (ids: string[]) => {
            components = components.filter((c) => !ids.includes(c.primitiveId));
            return true;
          })
        }
      });

      const prepared = await preparePcbComponentMutation(api, {
        action: "delete",
        component: "R1"
      });

      const actionHandlers = createActionHandlers(api, new DrcRules(api));
      const confirmed = (await actionHandlers.confirmedAction({
        action: "mutation",
        confirmation: prepared.confirmation as string,
        params: {
          mutationId: prepared.mutationId as string
        }
      })) as Record<string, any>;

      expect(confirmed.status).toBe("applied");
      expect(confirmed.domain).toBe("pcb");
      expect(confirmed.action).toBe("delete");
      expect(confirmed.after).toMatchObject({
        primitiveId: "prim_r1",
        deleted: true,
        verified: true
      });
      expect(components).toHaveLength(0);
    });
  });
});
