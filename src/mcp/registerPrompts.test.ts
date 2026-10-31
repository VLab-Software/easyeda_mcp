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

describe("EasyEDA MCP Prompts", () => {
  it("registers and lists all MCP workflow prompts", async () => {
    const bridge = new EasyEdaBridge({
      port: 0,
      logger: { error: () => undefined, warn: () => undefined, info: () => undefined }
    });
    await bridge.start();
    bridges.push(bridge);

    const server = createMcpServer(bridge);
    const client = new Client({ name: "test-prompt-client", version: "1.0.0" });
    clients.push(client);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const promptList = await client.listPrompts();
    const promptNames = promptList.prompts.map((p) => p.name);

    expect(promptNames).toContain("review_schematic");
    expect(promptNames).toContain("audit_pcb_drc");
    expect(promptNames).toContain("prepare_manufacturing");
    expect(promptNames).toContain("trace_circuit_path");
  });

  it("retrieves review_schematic prompt with custom arguments", async () => {
    const bridge = new EasyEdaBridge({
      port: 0,
      logger: { error: () => undefined, warn: () => undefined, info: () => undefined }
    });
    await bridge.start();
    bridges.push(bridge);

    const server = createMcpServer(bridge);
    const client = new Client({ name: "test-prompt-client", version: "1.0.0" });
    clients.push(client);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const promptResult = await client.getPrompt({
      name: "review_schematic",
      arguments: { scope: "power", strict: "true" }
    });

    expect(promptResult.messages).toHaveLength(1);
    const text = (promptResult.messages[0].content as { text: string }).text;
    expect(text).toContain("Review Scope: POWER");
    expect(text).toContain("Strict Mode: ENABLED");
    expect(text).toContain("easyeda://schematic/active");
    expect(text).toContain("decoupled_to_net");
  });

  it("retrieves audit_pcb_drc prompt with focus argument", async () => {
    const bridge = new EasyEdaBridge({
      port: 0,
      logger: { error: () => undefined, warn: () => undefined, info: () => undefined }
    });
    await bridge.start();
    bridges.push(bridge);

    const server = createMcpServer(bridge);
    const client = new Client({ name: "test-prompt-client", version: "1.0.0" });
    clients.push(client);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const promptResult = await client.getPrompt({
      name: "audit_pcb_drc",
      arguments: { focus: "clearance" }
    });

    expect(promptResult.messages).toHaveLength(1);
    const text = (promptResult.messages[0].content as { text: string }).text;
    expect(text).toContain("Audit Focus: CLEARANCE");
    expect(text).toContain("easyeda://pcb/drc-rules");
    expect(text).toContain("easyeda_run_drc");
  });

  it("retrieves prepare_manufacturing prompt for JLCPCB", async () => {
    const bridge = new EasyEdaBridge({
      port: 0,
      logger: { error: () => undefined, warn: () => undefined, info: () => undefined }
    });
    await bridge.start();
    bridges.push(bridge);

    const server = createMcpServer(bridge);
    const client = new Client({ name: "test-prompt-client", version: "1.0.0" });
    clients.push(client);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const promptResult = await client.getPrompt({
      name: "prepare_manufacturing",
      arguments: { manufacturer: "jlcpcb" }
    });

    expect(promptResult.messages).toHaveLength(1);
    const text = (promptResult.messages[0].content as { text: string }).text;
    expect(text).toContain("JLCPCB");
    expect(text).toContain("easyeda_export_bom");
    expect(text).toContain("easyeda_export_cpl");
    expect(text).toContain("easyeda_export_gerber");
  });

  it("retrieves trace_circuit_path prompt with startNet", async () => {
    const bridge = new EasyEdaBridge({
      port: 0,
      logger: { error: () => undefined, warn: () => undefined, info: () => undefined }
    });
    await bridge.start();
    bridges.push(bridge);

    const server = createMcpServer(bridge);
    const client = new Client({ name: "test-prompt-client", version: "1.0.0" });
    clients.push(client);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const promptResult = await client.getPrompt({
      name: "trace_circuit_path",
      arguments: { startNet: "VBUS", targetComponent: "U1" }
    });

    expect(promptResult.messages).toHaveLength(1);
    const text = (promptResult.messages[0].content as { text: string }).text;
    expect(text).toContain("VBUS");
    expect(text).toContain("U1");
    expect(text).toContain("easyeda_trace_net");
    expect(text).toContain("easyeda_trace_component");
  });
});
