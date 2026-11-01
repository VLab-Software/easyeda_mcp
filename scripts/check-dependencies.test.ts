import { describe, expect, it } from "vitest";
import { runCheck, validateDependencyArchitecture } from "./check-dependencies.mjs";

describe("Dependency and Architectural Boundary Validation", () => {
  it("passes for the current production codebase with zero violations", () => {
    const result = runCheck();
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.cycles).toEqual([]);
  });

  describe("Controlled Architectural Violations", () => {
    it("fails when browser extension module imports a Node builtin", () => {
      const mockFiles = {
        "extension/src/badModule.ts": `import fs from "node:fs";\nexport const x = 1;`
      };
      const result = validateDependencyArchitecture(mockFiles);
      expect(result.valid).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rule: "no-node-in-extension",
            file: "extension/src/badModule.ts"
          })
        ])
      );
    });

    it("fails when browser extension module imports MCP SDK", () => {
      const mockFiles = {
        "extension/src/badModule.ts": `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";`
      };
      const result = validateDependencyArchitecture(mockFiles);
      expect(result.valid).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rule: "no-mcp-in-extension",
            file: "extension/src/badModule.ts"
          })
        ])
      );
    });

    it("fails when browser extension module imports server backend modules", () => {
      const mockFiles = {
        "extension/src/badModule.ts": `import { registerTools } from "../../src/mcp/registerTools.js";`
      };
      const result = validateDependencyArchitecture(mockFiles);
      expect(result.valid).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rule: "no-backend-in-extension",
            file: "extension/src/badModule.ts"
          })
        ])
      );
    });

    it("fails when pure schematic module imports host/bridge or Node modules", () => {
      const mockFiles = {
        "src/schematic/badModule.ts": `import path from "path";\nimport { bridge } from "../bridge/EasyEdaBridge.js";`
      };
      const result = validateDependencyArchitecture(mockFiles);
      expect(result.valid).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ rule: "no-node-in-schematic" }),
          expect.objectContaining({ rule: "no-host-in-schematic" })
        ])
      );
    });

    it("fails when MCP tool directly imports EasyEdaBridge instead of EditorClient", () => {
      const mockFiles = {
        "src/mcp/tools/badTool.ts": `import { EasyEdaBridge } from "../../bridge/EasyEdaBridge.js";`
      };
      const result = validateDependencyArchitecture(mockFiles);
      expect(result.valid).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rule: "no-direct-bridge-in-tools",
            file: "src/mcp/tools/badTool.ts"
          })
        ])
      );
    });

    it("detects and fails on circular dependencies", () => {
      const mockFiles = {
        "src/a.ts": `import { b } from "./b.js"; export const a = 1;`,
        "src/b.ts": `import { a } from "./a.js"; export const b = 2;`
      };
      const result = validateDependencyArchitecture(mockFiles);
      expect(result.valid).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rule: "no-circular-dependencies"
          })
        ])
      );
    });
  });
});
