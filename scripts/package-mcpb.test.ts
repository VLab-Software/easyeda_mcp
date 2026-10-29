import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import { MCP_SERVER_VERSION } from "../src/version.js";
import { packageMcpb, validateMcpbManifest } from "./package-mcpb.mjs";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "easyeda-mcp-mcpb-test-"));
}

describe("package-mcpb script", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("packages a valid self-contained .mcpb bundle that boots over MCP stdio without node_modules", async () => {
    const tempRoot = makeTempDir();
    tempDirs.push(tempRoot);
    const distRoot = path.join(tempRoot, "dist");

    const result = await packageMcpb({ distRoot });
    expect(fs.existsSync(result.outFile)).toBe(true);
    expect(fs.existsSync(result.compatFile)).toBe(true);

    const archive = await JSZip.loadAsync(result.buffer);
    expect(Object.keys(archive.files)).toContain("manifest.json");
    expect(Object.keys(archive.files)).toContain("server/index.cjs");
    expect(Object.keys(archive.files)).toContain("README.md");
    expect(Object.keys(archive.files)).toContain("LICENSE");

    const manifest = JSON.parse(await archive.file("manifest.json")!.async("string"));
    expect(manifest.manifest_version).toBe("0.3");
    expect(manifest.version).toBe(MCP_SERVER_VERSION);
    expect(manifest.server).toEqual({
      type: "node",
      entry_point: "server/index.cjs",
      mcp_config: {
        command: "node",
        args: ["${__dirname}/server/index.cjs"]
      }
    });

    // Extract ONLY server/index.cjs into an isolated folder with no node_modules
    const runtimeDir = path.join(tempRoot, "isolated-runtime", "server");
    fs.mkdirSync(runtimeDir, { recursive: true });
    const extractedEntry = path.join(runtimeDir, "index.cjs");
    fs.writeFileSync(extractedEntry, await archive.file("server/index.cjs")!.async("nodebuffer"));

    // Verify CLI --version works on the standalone bundled server
    const versionOut = execFileSync(process.execPath, [extractedEntry, "--version"], {
      cwd: runtimeDir,
      encoding: "utf8"
    }).trim();
    expect(versionOut).toContain(`easyeda-pro-mcp v${MCP_SERVER_VERSION}`);

    // Verify MCP JSON-RPC stdio initialization, tool catalog, and easyeda_doctor
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [extractedEntry],
      cwd: runtimeDir,
      env: {
        EASYEDA_MCP_WS_HOST: "127.0.0.1",
        EASYEDA_MCP_WS_PORT: "0"
      },
      stderr: "pipe"
    });
    const client = new Client({ name: "mcpb-test-client", version: "1.0.0" });

    try {
      await client.connect(transport);
      expect(client.getServerVersion()?.version).toBe(MCP_SERVER_VERSION);

      const tools = await client.listTools();
      expect(tools.tools.length).toBeGreaterThanOrEqual(24);
      expect(tools.tools.map((t) => t.name)).toContain("easyeda_doctor");

      const doctor = (await client.callTool({ name: "easyeda_doctor", arguments: {} })) as any;
      expect(doctor.structuredContent.doctor.server.version).toBe(MCP_SERVER_VERSION);
      expect(doctor.structuredContent.doctor.bridge.endpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/);
    } finally {
      await client.close();
      await transport.close();
    }
  });

  it("rejects invalid MCPB manifest versions", () => {
    expect(() =>
      validateMcpbManifest({
        manifest_version: "0.1",
        name: "easyeda-pro-mcp",
        version: "1.1.0",
        description: "desc",
        author: { name: "VLab" },
        server: { type: "node", entry_point: "server/index.cjs", mcp_config: { command: "node", args: [] } }
      })
    ).toThrow('MCPB manifest_version must be "0.3"');
  });
});
