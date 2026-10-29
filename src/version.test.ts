import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { EXTENSION_VERSION, MCP_SERVER_VERSION } from "./version.js";

const read = (name: string): any => JSON.parse(fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8"));
describe("release identity", () => {
  it("aligns runtime, registry, package/lock and extension manifest versions", () => {
    expect(read("package.json").version).toBe(MCP_SERVER_VERSION);
    const lock = read("package-lock.json");
    expect(lock.version).toBe(MCP_SERVER_VERSION);
    expect(lock.packages[""].version).toBe(MCP_SERVER_VERSION);
    const registry = read("server.json");
    expect(registry.version).toBe(MCP_SERVER_VERSION);
    for (const pkg of registry.packages) expect(pkg.version).toBe(MCP_SERVER_VERSION);
    expect(read("extension/extension.json").version).toBe(EXTENSION_VERSION);
  });
});
