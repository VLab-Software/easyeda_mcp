import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  executePcbLayoutMutation,
  executePcbRoutingMutation,
  fetchLayoutSummary,
  fetchRoutingSummary,
  preparePcbLayoutMutation,
  preparePcbRoutingMutation
} from "./pcbRoutingMutations.js";
import { extensionMutations } from "./mutationManager.js";
import { createActionHandlers } from "../handlers/actionHandlers.js";
import { DrcRules } from "../drcRules.js";

describe("PCB Native Layout & Routing Mutations", () => {
  beforeEach(() => {
    extensionMutations.invalidateAll();
  });

  describe("fetchRoutingSummary", () => {
    it("calculates routed and unrouted net counts and completion percent", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "pcb-doc-1",
            name: "Board.PcbDoc",
            documentType: 3
          }))
        },
        pcb_Net: {
          getAllNetsName: vi.fn(async () => ["GND", "VCC", "SDA", "SCL"]),
          getAllNets: vi.fn(async () => [
            { name: "GND", isRouted: true },
            { name: "VCC", isRouted: true },
            { name: "SDA", isRouted: false, unroutedCount: 2 },
            { name: "SCL", isRouted: false, unroutedCount: 1 }
          ])
        }
      });

      const summary = await fetchRoutingSummary(api);
      expect(summary.totalNets).toBe(4);
      expect(summary.routedNets).toBe(2);
      expect(summary.unroutedNets).toBe(2);
      expect(summary.completionPercent).toBe(50);
      expect(summary.unroutedNetNames).toEqual(["SDA", "SCL"]);
    });
  });

  describe("fetchLayoutSummary", () => {
    it("extracts component coordinates and count", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "pcb-doc-1",
            documentType: 3
          }))
        },
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => [
            { primitiveId: "c1", designator: "U1", x: 20, y: 30, layer: 1, locked: false },
            { primitiveId: "c2", designator: "R1", x: 40, y: 50, layer: 1, locked: true }
          ])
        }
      });

      const summary = await fetchLayoutSummary(api);
      expect(summary.totalComponents).toBe(2);
      expect(summary.components).toHaveLength(2);
      expect(summary.components[0]).toMatchObject({
        primitiveId: "c1",
        designator: "U1",
        x: 20,
        y: 30
      });
    });
  });

  describe("preparePcbRoutingMutation", () => {
    const mockPcbApi = (routedCount = 2) => {
      return () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "pcb-doc-1",
            documentType: 3
          }))
        },
        pcb_Net: {
          getAllNetsName: vi.fn(async () => ["GND", "VCC", "SDA", "SCL"]),
          getAllNets: vi.fn(async () => [
            { name: "GND", isRouted: routedCount >= 1 },
            { name: "VCC", isRouted: routedCount >= 2 },
            { name: "SDA", isRouted: routedCount >= 3 },
            { name: "SCL", isRouted: routedCount >= 4 }
          ])
        }
      });
    };

    it("prepares autoroute mutation with confirmation token", async () => {
      const api = mockPcbApi();
      const prepared = (await preparePcbRoutingMutation(api, {
        action: "autoroute",
        nets: ["SDA", "SCL"],
        keepExistingRoutes: true
      })) as Record<string, any>;

      expect(prepared.mutationId).toBeDefined();
      expect(prepared.confirmation).toBe(`CONFIRM pcb:autoroute ${prepared.mutationId}`);
      expect(prepared.action).toBe("autoroute");
      expect(prepared.preview).toMatchObject({
        before: { totalNets: 4, routedNets: 2, unroutedNets: 2 },
        requestedAfter: { action: "autoroute", targetNets: ["SDA", "SCL"], keepExistingRoutes: true },
        changedKeys: ["routing", "routedNets", "completionPercent"]
      });
    });

    it("prepares destructive unroute mutation", async () => {
      const api = mockPcbApi();
      const prepared = (await preparePcbRoutingMutation(api, {
        action: "unroute"
      })) as Record<string, any>;

      expect(prepared.confirmation).toBe(`CONFIRM pcb:unroute ${prepared.mutationId}`);
      expect(prepared.action).toBe("unroute");
      expect(prepared.preview.impact).toMatch(/DESTRUCTIVE/);
      expect(prepared.preview).toMatchObject({
        before: { totalNets: 4, routedNets: 2 },
        requestedAfter: { action: "unroute", clearedRoutes: true }
      });
    });

    it("rejects non-PCB document targets", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "sch-1",
            documentType: 1
          }))
        }
      });

      await expect(preparePcbRoutingMutation(api, { action: "autoroute" })).rejects.toThrow(
        /PCB routing operations require an active PCB document/
      );
    });
  });

  describe("executePcbRoutingMutation", () => {
    it("executes native autorouting and verifies readback", async () => {
      let isRouted = false;
      const autoRoutingMock = vi.fn(async () => {
        isRouted = true;
      });

      const api = () => ({
        pcb_Document: {
          autoRouting: autoRoutingMock
        },
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "pcb-doc-1",
            documentType: 3
          }))
        },
        pcb_Net: {
          getAllNetsName: vi.fn(async () => ["GND", "VCC"]),
          getAllNets: vi.fn(async () => [
            { name: "GND", isRouted: true },
            { name: "VCC", isRouted }
          ])
        }
      });

      const result = await executePcbRoutingMutation(api, {
        action: "autoroute",
        nets: ["VCC"],
        keepExistingRoutes: true
      });

      expect(result.executed).toBe(true);
      expect(autoRoutingMock).toHaveBeenCalledWith(
        expect.objectContaining({
          nets: ["VCC"],
          keepExisting: true
        })
      );
      expect(result.readback).toMatchObject({
        method: "native",
        totalNets: 2,
        routedNets: 2,
        completionPercent: 100,
        verified: true
      });
    });

    it("executes destructive unroute and verifies readback", async () => {
      let unroutedState = false;
      const unRouteMock = vi.fn(async () => {
        unroutedState = true;
      });

      const api = () => ({
        pcb_Document: {
          unRoute: unRouteMock
        },
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "pcb-doc-1",
            documentType: 3
          }))
        },
        pcb_Net: {
          getAllNetsName: vi.fn(async () => ["GND", "VCC"]),
          getAllNets: vi.fn(async () => [
            { name: "GND", isRouted: !unroutedState },
            { name: "VCC", isRouted: !unroutedState }
          ])
        }
      });

      const result = await executePcbRoutingMutation(api, {
        action: "unroute"
      });

      expect(result.executed).toBe(true);
      expect(unRouteMock).toHaveBeenCalled();
      expect(result.readback).toMatchObject({
        method: "native",
        unrouted: true,
        totalNets: 2,
        routedNets: 0,
        unroutedNets: 2,
        completionPercent: 0,
        verified: true
      });
    });
  });

  describe("preparePcbLayoutMutation & executePcbLayoutMutation", () => {
    it("prepares and executes autolayout with readback verification", async () => {
      const autoLayoutMock = vi.fn(async () => true);

      const api = () => ({
        pcb_Document: {
          autoLayout: autoLayoutMock
        },
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "pcb-doc-1",
            documentType: 3
          }))
        },
        pcb_PrimitiveComponent: {
          getAll: vi.fn(async () => [{ primitiveId: "c1", designator: "U1", x: 10, y: 10, layer: 1 }])
        }
      });

      const prepared = (await preparePcbLayoutMutation(api, {
        action: "autolayout",
        components: ["U1"]
      })) as Record<string, any>;

      expect(prepared.mutationId).toBeDefined();
      expect(prepared.confirmation).toBe(`CONFIRM pcb:autolayout ${prepared.mutationId}`);
      expect(prepared.action).toBe("autolayout");

      const result = await executePcbLayoutMutation(api, {
        action: "autolayout",
        components: ["U1"]
      });

      expect(result.executed).toBe(true);
      expect(autoLayoutMock).toHaveBeenCalledWith({ components: ["U1"] });
      expect(result.readback).toMatchObject({
        method: "native",
        totalComponents: 1,
        arranged: true,
        verified: true
      });
    });
  });

  describe("Integration with actionHandlers", () => {
    it("distinguishes native autoroute from external file import", async () => {
      const importMock = vi.fn(async () => true);
      const nativeRouteMock = vi.fn(async () => true);

      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "pcb-doc-1",
            documentType: 3
          }))
        },
        pcb_Document: {
          importAutoRouteJsonFile: importMock,
          autoRouting: nativeRouteMock
        },
        pcb_Net: {
          getAllNetsName: vi.fn(async () => ["GND"])
        }
      });

      const actionHandlers = createActionHandlers(api, new DrcRules(api));

      // 1. External import call with file
      const importResult = (await actionHandlers.confirmedAction({
        action: "autoroute",
        confirmation: "I confirm autoroute",
        params: { file: '{"routes":[]}' }
      })) as Record<string, any>;

      expect(importResult.method).toBe("external_import");
      expect(importMock).toHaveBeenCalledWith('{"routes":[]}');

      // 2. Native autoroute call without file
      const nativeResult = (await actionHandlers.confirmedAction({
        action: "nativeAutoRoute",
        confirmation: "I confirm nativeAutoRoute"
      })) as Record<string, any>;

      expect(nativeResult.method).toBe("native");
      expect(nativeRouteMock).toHaveBeenCalled();
    });

    it("executes staged unroute via confirmed_action mutation", async () => {
      let isUnrouted = false;
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: vi.fn(async () => ({
            uuid: "pcb-doc-1",
            documentType: 3
          }))
        },
        pcb_Document: {
          unRoute: vi.fn(async () => {
            isUnrouted = true;
          })
        },
        pcb_Net: {
          getAllNetsName: vi.fn(async () => ["GND", "VCC"]),
          getAllNets: vi.fn(async () => [
            { name: "GND", isRouted: !isUnrouted },
            { name: "VCC", isRouted: !isUnrouted }
          ])
        }
      });

      const prepared = (await preparePcbRoutingMutation(api, {
        action: "unroute"
      })) as Record<string, any>;

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
      expect(confirmed.action).toBe("unroute");
      expect(confirmed.after).toMatchObject({
        method: "native",
        unrouted: true,
        routedNets: 0,
        unroutedNets: 2,
        verified: true
      });
    });
  });
});
