import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { handleCliArgs } from "./cli.js";
import {
  buildOneClickInstallLinks,
  buildServerLaunchSpec,
  BUNDLED_EXTENSION_FILENAME,
  PACKAGE_NAME,
  resolveClientTargets,
  runSetup,
  SUPPORTED_CLIENT_IDS,
  upsertCodexTomlServer,
  upsertJsonMcpServer
} from "./setup.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "easyeda-mcp-cli-test-"));
}

function makeFakePackageRoot(baseDir: string): string {
  const pkgRoot = path.join(baseDir, "pkg");
  fs.mkdirSync(path.join(pkgRoot, "build", "dist"), { recursive: true });
  fs.mkdirSync(path.join(pkgRoot, "dist"), { recursive: true });
  fs.writeFileSync(
    path.join(pkgRoot, "package.json"),
    JSON.stringify({ name: PACKAGE_NAME, version: "1.1.0" }, null, 2)
  );
  fs.writeFileSync(path.join(pkgRoot, "dist", "index.js"), "#!/usr/bin/env node\n");
  fs.writeFileSync(path.join(pkgRoot, "build", "dist", BUNDLED_EXTENSION_FILENAME), "FAKE_EEXT_BINARY");
  return pkgRoot;
}

describe("CLI setup & auto-installer", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("buildServerLaunchSpec", () => {
    it("uses npx directly on macOS and Linux", () => {
      expect(buildServerLaunchSpec({ mode: "npx", platform: "darwin" })).toEqual({
        command: "npx",
        args: ["-y", PACKAGE_NAME]
      });
      expect(buildServerLaunchSpec({ mode: "npx", platform: "linux" })).toEqual({
        command: "npx",
        args: ["-y", PACKAGE_NAME]
      });
    });

    it("wraps npx with cmd /c on Windows to avoid spawn ENOENT in GUI clients", () => {
      expect(buildServerLaunchSpec({ mode: "npx", platform: "win32" })).toEqual({
        command: "cmd",
        args: ["/c", "npx", "-y", PACKAGE_NAME]
      });
    });

    it("builds node command for local mode", () => {
      expect(
        buildServerLaunchSpec({
          mode: "local",
          platform: "darwin",
          localEntryPath: "/repo/easyeda_mcp/dist/index.js"
        })
      ).toEqual({
        command: "node",
        args: ["/repo/easyeda_mcp/dist/index.js"]
      });
    });
  });

  describe("resolveClientTargets", () => {
    it("resolves macOS paths accurately", () => {
      const targets = resolveClientTargets({
        platform: "darwin",
        homeDir: "/Users/alice",
        env: {}
      });
      const byId = Object.fromEntries(targets.map((t) => [t.id, t.configPath]));
      expect(byId["claude-desktop"]).toBe(
        "/Users/alice/Library/Application Support/Claude/claude_desktop_config.json"
      );
      expect(byId.vscode).toBe("/Users/alice/Library/Application Support/Code/User/mcp.json");
      expect(byId.cursor).toBe("/Users/alice/.cursor/mcp.json");
      expect(byId.antigravity).toBe("/Users/alice/.gemini/config/mcp_config.json");
      expect(byId.windsurf).toBe("/Users/alice/.codeium/windsurf/mcp_config.json");
      expect(byId["claude-code"]).toBe("/Users/alice/.claude.json");
      expect(byId.codex).toBe("/Users/alice/.codex/config.toml");
    });

    it("resolves Windows %APPDATA% paths accurately", () => {
      const targets = resolveClientTargets({
        platform: "win32",
        homeDir: "C:\\Users\\alice",
        env: { APPDATA: "C:\\Users\\alice\\AppData\\Roaming" }
      });
      const byId = Object.fromEntries(targets.map((t) => [t.id, t.configPath]));
      expect(byId["claude-desktop"]).toBe(
        "C:\\Users\\alice\\AppData\\Roaming\\Claude\\claude_desktop_config.json"
      );
      expect(byId.vscode).toBe("C:\\Users\\alice\\AppData\\Roaming\\Code\\User\\mcp.json");
      expect(byId.cursor).toBe("C:\\Users\\alice\\.cursor\\mcp.json");
    });

    it("resolves Linux XDG_CONFIG_HOME paths accurately", () => {
      const targets = resolveClientTargets({
        platform: "linux",
        homeDir: "/home/alice",
        env: { XDG_CONFIG_HOME: "/home/alice/.xdg" }
      });
      const byId = Object.fromEntries(targets.map((t) => [t.id, t.configPath]));
      expect(byId["claude-desktop"]).toBe("/home/alice/.xdg/Claude/claude_desktop_config.json");
      expect(byId.vscode).toBe("/home/alice/.xdg/Code/User/mcp.json");
    });
  });

  describe("upsertJsonMcpServer", () => {
    const spec = { command: "npx", args: ["-y", PACKAGE_NAME] };

    it("creates mcpServers JSON when file does not exist", () => {
      const res = upsertJsonMcpServer(null, {
        rootKey: "mcpServers",
        serverName: "easyeda-pro",
        spec
      });
      expect(res.status).toBe("created");
      expect(JSON.parse(res.content!)).toEqual({
        mcpServers: {
          "easyeda-pro": {
            command: "npx",
            args: ["-y", PACKAGE_NAME]
          }
        }
      });
    });

    it("uses 'servers' root key and type='stdio' for VS Code while preserving inputs", () => {
      const existing = JSON.stringify(
        {
          inputs: [{ id: "token", type: "promptString" }],
          servers: {
            github: { type: "http", url: "https://api.githubcopilot.com/mcp/" }
          }
        },
        null,
        2
      );

      const res = upsertJsonMcpServer(existing, {
        rootKey: "servers",
        serverName: "easyeda-pro",
        spec,
        includeStdioType: true
      });

      expect(res.status).toBe("updated");
      expect(JSON.parse(res.content!)).toEqual({
        inputs: [{ id: "token", type: "promptString" }],
        servers: {
          github: { type: "http", url: "https://api.githubcopilot.com/mcp/" },
          "easyeda-pro": {
            type: "stdio",
            command: "npx",
            args: ["-y", PACKAGE_NAME]
          }
        }
      });
    });

    it("returns unchanged when already configured identically", () => {
      const first = upsertJsonMcpServer(null, {
        rootKey: "mcpServers",
        serverName: "easyeda-pro",
        spec
      });
      const second = upsertJsonMcpServer(first.content!, {
        rootKey: "mcpServers",
        serverName: "easyeda-pro",
        spec
      });
      expect(second.status).toBe("unchanged");
    });

    it("never corrupts malformed JSON or JSONC files", () => {
      const jsonWithComments = '{\n  // user comment\n  "mcpServers": {}\n}\n';
      const res = upsertJsonMcpServer(jsonWithComments, {
        rootKey: "mcpServers",
        serverName: "easyeda-pro",
        spec
      });
      expect(res.status).toBe("error");
      expect(res.error).toContain("left untouched");
    });
  });

  describe("upsertCodexTomlServer", () => {
    const spec = { command: "npx", args: ["-y", PACKAGE_NAME] };

    it("creates a clean TOML config when missing", () => {
      const res = upsertCodexTomlServer(null, {
        serverName: "easyeda-pro",
        spec
      });
      expect(res.status).toBe("created");
      expect(res.content).toBe(
        ['[mcp_servers.easyeda-pro]', 'command = "npx"', `args = ["-y", "${PACKAGE_NAME}"]`, ""].join("\n")
      );
    });

    it("updates existing section in-place and preserves comments, other servers, and array-of-tables", () => {
      const existing = [
        'model = "gpt-5-codex"',
        "# Personal MCP tools",
        "",
        "[mcp_servers.easyeda-pro]",
        'command = "node"',
        'args = ["/old/path/dist/index.js"]',
        "",
        "[mcp_servers.easyeda-pro.env]",
        'EASYEDA_MCP_WS_PORT = "8765"',
        "",
        "[[notify.hooks]]",
        'command = "say done"',
        "",
        '[projects."/Users/alice/board"]',
        'trust_level = "trusted"',
        ""
      ].join("\n");

      const res = upsertCodexTomlServer(existing, {
        serverName: "easyeda-pro",
        spec
      });

      expect(res.status).toBe("updated");
      expect(res.content).toContain('model = "gpt-5-codex"');
      expect(res.content).toContain("# Personal MCP tools");
      expect(res.content).toContain(`args = ["-y", "${PACKAGE_NAME}"]`);
      expect(res.content).not.toContain("/old/path/dist/index.js");
      expect(res.content).not.toContain("[mcp_servers.easyeda-pro.env]");
      expect(res.content).toContain("[[notify.hooks]]");
      expect(res.content).toContain('[projects."/Users/alice/board"]');

      const again = upsertCodexTomlServer(res.content, {
        serverName: "easyeda-pro",
        spec
      });
      expect(again.status).toBe("unchanged");
    });

    it("preserves Windows CRLF line endings", () => {
      const existing = 'model = "o3"\r\n';
      const res = upsertCodexTomlServer(existing, {
        serverName: "easyeda-pro",
        spec: { command: "cmd", args: ["/c", "npx", "-y", PACKAGE_NAME] }
      });
      expect(res.status).toBe("updated");
      expect(res.content).toContain("\r\n");
      expect(res.content).toContain('command = "cmd"\r\n');
    });
  });

  describe("runSetup & handleCliArgs end-to-end", () => {
    it("auto-detects installed clients, writes configs, and exports .eext to Downloads", () => {
      const root = makeTempDir();
      tempDirs.push(root);

      const pkgRoot = makeFakePackageRoot(root);
      const homeDir = path.join(root, "home");
      fs.mkdirSync(path.join(homeDir, ".cursor"), { recursive: true });
      fs.mkdirSync(path.join(homeDir, ".codex"), { recursive: true });
      fs.mkdirSync(path.join(homeDir, "Downloads"), { recursive: true });

      const report = runSetup({
        platform: "darwin",
        homeDir,
        cwd: root,
        env: {},
        packageRoot: pkgRoot
      });

      const statuses = Object.fromEntries(report.clients.map((c) => [c.id, c.status]));
      expect(statuses.cursor).toBe("created");
      expect(statuses.codex).toBe("created");
      expect(statuses["claude-desktop"]).toBe("skipped");
      expect(statuses.vscode).toBe("skipped");

      const cursorJson = JSON.parse(fs.readFileSync(path.join(homeDir, ".cursor", "mcp.json"), "utf8"));
      expect(cursorJson.mcpServers["easyeda-pro"]).toEqual({
        command: "npx",
        args: ["-y", PACKAGE_NAME]
      });

      const codexToml = fs.readFileSync(path.join(homeDir, ".codex", "config.toml"), "utf8");
      expect(codexToml).toContain("[mcp_servers.easyeda-pro]");

      expect(report.extension.status).toBe("exported");
      expect(report.extension.outputPath).toBe(path.join(homeDir, "Downloads", BUNDLED_EXTENSION_FILENAME));
      expect(fs.readFileSync(report.extension.outputPath!, "utf8")).toBe("FAKE_EEXT_BINARY");
    });

    it("supports --dry-run without touching disk and --all via handleCliArgs", () => {
      const root = makeTempDir();
      tempDirs.push(root);

      const pkgRoot = makeFakePackageRoot(root);
      const homeDir = path.join(root, "home");
      fs.mkdirSync(homeDir, { recursive: true });

      const logs: string[] = [];
      const errors: string[] = [];
      const dryResult = handleCliArgs(
        ["setup", "--all", "--dry-run", "--json"],
        { stdout: (m) => logs.push(m), stderr: (m) => errors.push(m) },
        { platform: "linux", homeDir, cwd: root, env: {}, packageRoot: pkgRoot }
      );

      expect(dryResult).toEqual({ handled: true, exitCode: 0 });
      expect(errors).toEqual([]);
      const parsedReport = JSON.parse(logs.join("\n"));
      expect(parsedReport.clients).toHaveLength(SUPPORTED_CLIENT_IDS.length);
      expect(fs.existsSync(path.join(homeDir, ".cursor", "mcp.json"))).toBe(false);
      expect(fs.existsSync(path.join(root, BUNDLED_EXTENSION_FILENAME))).toBe(false);
    });

    it("does not intercept empty args or 'serve' and writes zero stdout bytes", () => {
      const logs: string[] = [];
      const errors: string[] = [];
      const io = { stdout: (m: string) => logs.push(m), stderr: (m: string) => errors.push(m) };

      expect(handleCliArgs([], io)).toEqual({ handled: false, exitCode: 0 });
      expect(handleCliArgs(["serve"], io)).toEqual({ handled: false, exitCode: 0 });
      expect(logs).toEqual([]);
      expect(errors).toEqual([]);
    });

    it("handles export-extension, --version, --help, and unknown arguments", () => {
      const root = makeTempDir();
      tempDirs.push(root);
      const pkgRoot = makeFakePackageRoot(root);
      const outDir = path.join(root, "exported");

      const logs: string[] = [];
      const errors: string[] = [];
      const io = { stdout: (m: string) => logs.push(m), stderr: (m: string) => errors.push(m) };

      expect(handleCliArgs(["--version"], io)).toEqual({ handled: true, exitCode: 0 });
      expect(logs.pop()).toMatch(/^easyeda-pro-mcp v\d+\.\d+\.\d+/);

      expect(handleCliArgs(["--help"], io)).toEqual({ handled: true, exitCode: 0 });
      expect(logs.pop()).toContain("Usage:");

      expect(
        handleCliArgs(["export-extension", outDir], io, { packageRoot: pkgRoot, cwd: root })
      ).toEqual({ handled: true, exitCode: 0 });
      expect(fs.existsSync(path.join(outDir, BUNDLED_EXTENSION_FILENAME))).toBe(true);

      expect(handleCliArgs(["unknown-cmd"], io)).toEqual({ handled: true, exitCode: 1 });
      expect(errors.pop()).toContain("Unknown command");
    });
  });

  describe("1-click install links in documentation", () => {
    it("matches the exact Cursor and VS Code 1-click links in README.md and docs/ai-client-setup.md", () => {
      const links = buildOneClickInstallLinks();

      const cursorUrl = new URL(links.cursorWebLink);
      const decodedCursor = JSON.parse(
        Buffer.from(cursorUrl.searchParams.get("config")!, "base64").toString("utf8")
      );
      expect(cursorUrl.searchParams.get("name")).toBe("easyeda-pro");
      expect(decodedCursor).toEqual({
        command: "npx",
        args: ["-y", PACKAGE_NAME]
      });

      const vscodeRedirect = new URL(links.vscodeWebLink);
      const innerProtocol = vscodeRedirect.searchParams.get("url")!;
      expect(innerProtocol.startsWith("vscode:mcp/install?")).toBe(true);
      const decodedVscode = JSON.parse(decodeURIComponent(innerProtocol.slice("vscode:mcp/install?".length)));
      expect(decodedVscode).toEqual({
        name: "easyeda-pro",
        command: "npx",
        args: ["-y", PACKAGE_NAME]
      });

      const repoRoot = path.resolve(import.meta.dirname, "..", "..");
      const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
      const clientSetupDoc = fs.readFileSync(path.join(repoRoot, "docs", "ai-client-setup.md"), "utf8");

      expect(readme).toContain(links.cursorWebLink);
      expect(readme).toContain(links.vscodeWebLink);
      expect(clientSetupDoc).toContain(links.cursorWebLink);
      expect(clientSetupDoc).toContain(links.vscodeWebLink);
    });
  });
});
