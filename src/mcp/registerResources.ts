import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EasyEdaBridge } from "../bridge/EasyEdaBridge.js";
import { projectCompactPcb, projectCompactSchematic } from "./tokenOptimization.js";

function safeJson(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export function registerEasyEdaResources(server: McpServer, bridge: EasyEdaBridge): void {
  // 1. easyeda://project/status
  server.registerResource(
    "project_status",
    "easyeda://project/status",
    {
      title: "EasyEDA Pro Live Status",
      description: "Real-time connection state, extension version, protocol version, capabilities, and active document preview.",
      mimeType: "application/json"
    },
    async (uri) => {
      const status = bridge.getStatus();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: safeJson({
              status,
              bridgeEndpoint: bridge.endpoint,
              timestamp: new Date().toISOString()
            })
          }
        ]
      };
    }
  );

  // 2. easyeda://project/context
  server.registerResource(
    "project_context",
    "easyeda://project/context",
    {
      title: "EasyEDA Pro Editor Context",
      description: "Active project, open documents, active tab, and canvas selection from the live EasyEDA Pro session.",
      mimeType: "application/json"
    },
    async (uri) => {
      const status = bridge.getStatus();
      if (!status.connected) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson({
                available: false,
                reason: "EasyEDA Pro extension is not connected.",
                status
              })
            }
          ]
        };
      }

      try {
        const context = await bridge.call("getContext");
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson(context)
            }
          ]
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson({
                available: false,
                error: String(error),
                status
              })
            }
          ]
        };
      }
    }
  );

  // 3. easyeda://schematic/active
  server.registerResource(
    "schematic_active",
    "easyeda://schematic/active",
    {
      title: "Active Schematic Compact Summary",
      description: "High-density, token-optimized projection of the currently open schematic: components, values, footprints, and net connections.",
      mimeType: "application/json"
    },
    async (uri) => {
      const status = bridge.getStatus();
      if (!status.connected) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson({
                available: false,
                reason: "EasyEDA Pro extension is not connected."
              })
            }
          ]
        };
      }

      try {
        const raw = (await bridge.call("schematicSnapshot", {
          includeRaw: false,
          allPages: false
        })) as any;

        const compact = projectCompactSchematic(raw ?? {}, status.documentName);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson(compact)
            }
          ]
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson({
                available: false,
                error: String(error)
              })
            }
          ]
        };
      }
    }
  );

  // 4. easyeda://pcb/active
  server.registerResource(
    "pcb_active",
    "easyeda://pcb/active",
    {
      title: "Active PCB Compact Summary",
      description: "High-density, token-optimized projection of the active PCB: routing status, completion percentage, unrouted nets, and placed components.",
      mimeType: "application/json"
    },
    async (uri) => {
      const status = bridge.getStatus();
      if (!status.connected) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson({
                available: false,
                reason: "EasyEDA Pro extension is not connected."
              })
            }
          ]
        };
      }

      try {
        const [routingRes, componentsRes] = await Promise.allSettled([
          bridge.call("getRoutingStatus"),
          bridge.call("listPcbComponents", { limit: 100, includeRaw: false })
        ]);

        const routing = routingRes.status === "fulfilled" ? (routingRes.value as any) : {};
        const componentsData = componentsRes.status === "fulfilled" ? (componentsRes.value as any) : {};
        const componentsList = Array.isArray(componentsData.components)
          ? componentsData.components
          : Array.isArray(componentsData)
            ? componentsData
            : [];

        const compact = projectCompactPcb({
          documentName: status.documentName,
          routingStatus: routing,
          components: componentsList
        });

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson(compact)
            }
          ]
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson({
                available: false,
                error: String(error)
              })
            }
          ]
        };
      }
    }
  );

  // 5. easyeda://pcb/layers
  server.registerResource(
    "pcb_layers",
    "easyeda://pcb/layers",
    {
      title: "PCB Physical Layer Stackup",
      description: "Active physical layer stackup, copper thickness, and layer types on the open PCB.",
      mimeType: "application/json"
    },
    async (uri) => {
      const status = bridge.getStatus();
      if (!status.connected) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson({
                available: false,
                reason: "EasyEDA Pro extension is not connected."
              })
            }
          ]
        };
      }

      try {
        const layers = await bridge.call("getPcbLayers");
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson(layers)
            }
          ]
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson({
                available: false,
                error: String(error)
              })
            }
          ]
        };
      }
    }
  );

  // 6. easyeda://pcb/drc-rules
  server.registerResource(
    "pcb_drc_rules",
    "easyeda://pcb/drc-rules",
    {
      title: "PCB DRC Design Rules",
      description: "Current design rule configuration, clearance constraints, track width limits, and via sizes.",
      mimeType: "application/json"
    },
    async (uri) => {
      const status = bridge.getStatus();
      if (!status.connected) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson({
                available: false,
                reason: "EasyEDA Pro extension is not connected."
              })
            }
          ]
        };
      }

      try {
        const rules = await bridge.call("getDrcRules", { configuration: "current" });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson(rules)
            }
          ]
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson({
                available: false,
                error: String(error)
              })
            }
          ]
        };
      }
    }
  );

  // 7. Dynamic template: easyeda://component/{designator}
  const componentTemplate = new ResourceTemplate("easyeda://component/{designator}", { list: undefined });
  server.registerResource(
    "component_by_designator",
    componentTemplate,
    {
      title: "Component Inspection by Designator",
      description: "Inspect pins, values, and net connections for a specific component (e.g., R1, U2, C15) without dumping the full schematic.",
      mimeType: "application/json"
    },
    async (uri, { designator }) => {
      const status = bridge.getStatus();
      if (!status.connected) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson({
                available: false,
                reason: "EasyEDA Pro extension is not connected."
              })
            }
          ]
        };
      }

      try {
        const target = typeof designator === "string" ? designator.trim() : "";
        const result = await bridge.call("findComponent", { query: target, limit: 10 });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson(result)
            }
          ]
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: safeJson({
                available: false,
                error: String(error)
              })
            }
          ]
        };
      }
    }
  );
}
