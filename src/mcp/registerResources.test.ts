import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { EasyEdaBridge } from "../bridge/EasyEdaBridge.js";
import { createMcpServer } from "./server.js";

const bridges: EasyEdaBridge[] = [];
const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(bridges.splice(0).map((bridge) => bridge.stop()));
});

describe("EasyEDA MCP Resources", () => {
  it("registers and lists all static and dynamic resources", async () => {
    const bridge = new EasyEdaBridge({
      port: 0,
      logger: { error: () => undefined, warn: () => undefined, info: () => undefined }
    });
    await bridge.start();
    bridges.push(bridge);

    const server = createMcpServer(bridge);
    const client = new Client({ name: "test-resource-client", version: "1.0.0" });
    clients.push(client);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const resourceList = await client.listResources();
    const uris = resourceList.resources.map((r) => r.uri);

    expect(uris).toContain("easyeda://project/status");
    expect(uris).toContain("easyeda://project/context");
    expect(uris).toContain("easyeda://schematic/active");
    expect(uris).toContain("easyeda://pcb/active");
    expect(uris).toContain("easyeda://pcb/layers");
    expect(uris).toContain("easyeda://pcb/drc-rules");
  });

  it("reads easyeda://project/status returning bridge and connection state", async () => {
    const bridge = new EasyEdaBridge({
      port: 0,
      logger: { error: () => undefined, warn: () => undefined, info: () => undefined }
    });
    await bridge.start();
    bridges.push(bridge);

    const server = createMcpServer(bridge);
    const client = new Client({ name: "test-resource-client", version: "1.0.0" });
    clients.push(client);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.readResource({ uri: "easyeda://project/status" });
    expect(response.contents).toHaveLength(1);
    expect(response.contents[0].mimeType).toBe("application/json");

    const parsed = JSON.parse(response.contents[0].text as string);
    expect(parsed.status).toBeDefined();
    expect(parsed.status.connected).toBe(false);
    expect(parsed.bridgeEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/);
  });

  it("reads disconnected fallback for active schematic and pcb resources", async () => {
    const bridge = new EasyEdaBridge({
      port: 0,
      logger: { error: () => undefined, warn: () => undefined, info: () => undefined }
    });
    await bridge.start();
    bridges.push(bridge);

    const server = createMcpServer(bridge);
    const client = new Client({ name: "test-resource-client", version: "1.0.0" });
    clients.push(client);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const schRes = await client.readResource({ uri: "easyeda://schematic/active" });
    const schData = JSON.parse(schRes.contents[0].text as string);
    expect(schData.available).toBe(false);
    expect(schData.reason).toContain("not connected");

    const pcbRes = await client.readResource({ uri: "easyeda://pcb/active" });
    const pcbData = JSON.parse(pcbRes.contents[0].text as string);
    expect(pcbData.available).toBe(false);

    const compRes = await client.readResource({ uri: "easyeda://component/R1" });
    const compData = JSON.parse(compRes.contents[0].text as string);
    expect(compData.available).toBe(false);
  });
});
