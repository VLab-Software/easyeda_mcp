import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PACKAGE_NAME = "@vlabsoft/easyeda-pro-mcp";
export const DEFAULT_SERVER_NAME = "easyeda-pro";
export const BUNDLED_EXTENSION_FILENAME = "easyeda_mcp_bridge.eext";

export const SUPPORTED_CLIENT_IDS = [
  "claude-desktop",
  "cursor",
  "vscode",
  "antigravity",
  "windsurf",
  "claude-code",
  "codex"
] as const;

export type ClientId = (typeof SUPPORTED_CLIENT_IDS)[number];

export type ServerLaunchSpec = {
  command: string;
  args: string[];
};

export type EnvContext = {
  platform?: NodeJS.Platform;
  homeDir?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
};

export type ClientTarget = {
  id: ClientId;
  displayName: string;
  configPath: string;
  detectPaths: string[];
  format: "json" | "toml";
  jsonRootKey?: "mcpServers" | "servers";
  includeStdioType?: boolean;
  reloadHint: string;
};

export type ClientSetupStatus = "created" | "updated" | "unchanged" | "skipped" | "error";

export type ClientSetupResult = {
  id: ClientId;
  displayName: string;
  configPath: string;
  detected: boolean;
  status: ClientSetupStatus;
  reloadHint: string;
  error?: string;
};

export type ExtensionExportResult = {
  status: "exported" | "skipped" | "not_found";
  sourcePath?: string;
  outputPath?: string;
  reason?: string;
};

export type SetupOptions = EnvContext & {
  clients?: ClientId[];
  all?: boolean;
  mode?: "npx" | "local";
  localEntryPath?: string;
  packageRoot?: string;
  packageName?: string;
  serverName?: string;
  extensionDir?: string;
  exportExtension?: boolean;
  dryRun?: boolean;
};

export type SetupReport = {
  serverName: string;
  mode: "npx" | "local";
  dryRun: boolean;
  launchSpec: ServerLaunchSpec;
  clients: ClientSetupResult[];
  extension: ExtensionExportResult;
};

export function isClientId(value: string): value is ClientId {
  return (SUPPORTED_CLIENT_IDS as readonly string[]).includes(value);
}

export function buildServerLaunchSpec(options: {
  mode?: "npx" | "local";
  platform?: NodeJS.Platform;
  localEntryPath?: string;
  packageName?: string;
} = {}): ServerLaunchSpec {
  const mode = options.mode ?? "npx";
  const platform = options.platform ?? process.platform;
  const packageName = options.packageName ?? PACKAGE_NAME;

  if (mode === "local") {
    if (!options.localEntryPath) {
      throw new Error("localEntryPath is required when mode is 'local'.");
    }
    return {
      command: "node",
      args: [options.localEntryPath]
    };
  }

  if (platform === "win32") {
    return {
      command: "cmd",
      args: ["/c", "npx", "-y", packageName]
    };
  }

  return {
    command: "npx",
    args: ["-y", packageName]
  };
}

export function buildOneClickInstallLinks(options: {
  serverName?: string;
  packageName?: string;
} = {}): {
  cursorDeeplink: string;
  cursorWebLink: string;
  vscodeProtocolLink: string;
  vscodeWebLink: string;
} {
  const serverName = options.serverName ?? DEFAULT_SERVER_NAME;
  const packageName = options.packageName ?? PACKAGE_NAME;

  const cursorPayload = JSON.stringify({
    command: "npx",
    args: ["-y", packageName]
  });
  const cursorBase64 = Buffer.from(cursorPayload, "utf8").toString("base64");
  const encodedCursorConfig = encodeURIComponent(cursorBase64);
  const encodedName = encodeURIComponent(serverName);

  const cursorDeeplink = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodedName}&config=${encodedCursorConfig}`;
  const cursorWebLink = `https://cursor.com/install-mcp?name=${encodedName}&config=${encodedCursorConfig}`;

  const vscodePayload = JSON.stringify({
    name: serverName,
    command: "npx",
    args: ["-y", packageName]
  });
  const vscodeProtocolLink = `vscode:mcp/install?${encodeURIComponent(vscodePayload)}`;
  const vscodeWebLink = `https://vscode.dev/redirect?url=${encodeURIComponent(vscodeProtocolLink)}`;

  return {
    cursorDeeplink,
    cursorWebLink,
    vscodeProtocolLink,
    vscodeWebLink
  };
}

export function resolveClientTargets(context: EnvContext = {}): ClientTarget[] {
  const platform = context.platform ?? process.platform;
  const homeDir = context.homeDir ?? os.homedir();
  const env = context.env ?? process.env;
  const pathMod = platform === "win32" ? path.win32 : path.posix;

  const appDataDir =
    platform === "win32"
      ? env.APPDATA || pathMod.join(homeDir, "AppData", "Roaming")
      : platform === "darwin"
        ? pathMod.join(homeDir, "Library", "Application Support")
        : env.XDG_CONFIG_HOME || pathMod.join(homeDir, ".config");

  const claudeDesktopDir = pathMod.join(appDataDir, "Claude");
  const claudeDesktopConfig = pathMod.join(claudeDesktopDir, "claude_desktop_config.json");

  const cursorDir = pathMod.join(homeDir, ".cursor");
  const cursorConfig = pathMod.join(cursorDir, "mcp.json");

  const vscodeDir = pathMod.join(appDataDir, "Code");
  const vscodeConfig = pathMod.join(vscodeDir, "User", "mcp.json");

  const geminiDir = pathMod.join(homeDir, ".gemini");
  const antigravityConfig = pathMod.join(geminiDir, "config", "mcp_config.json");

  const windsurfDir = pathMod.join(homeDir, ".codeium", "windsurf");
  const windsurfConfig = pathMod.join(windsurfDir, "mcp_config.json");

  const claudeCodeConfig = pathMod.join(homeDir, ".claude.json");
  const claudeCodeDir = pathMod.join(homeDir, ".claude");

  const codexDir = env.CODEX_HOME || pathMod.join(homeDir, ".codex");
  const codexConfig = pathMod.join(codexDir, "config.toml");

  return [
    {
      id: "claude-desktop",
      displayName: "Claude Desktop",
      configPath: claudeDesktopConfig,
      detectPaths: [claudeDesktopConfig, claudeDesktopDir],
      format: "json",
      jsonRootKey: "mcpServers",
      includeStdioType: false,
      reloadHint: "Fully quit and reopen Claude Desktop."
    },
    {
      id: "cursor",
      displayName: "Cursor",
      configPath: cursorConfig,
      detectPaths: [cursorConfig, cursorDir],
      format: "json",
      jsonRootKey: "mcpServers",
      includeStdioType: false,
      reloadHint: "Refresh MCP servers in Cursor Settings -> MCP."
    },
    {
      id: "vscode",
      displayName: "VS Code",
      configPath: vscodeConfig,
      detectPaths: [vscodeConfig, vscodeDir],
      format: "json",
      jsonRootKey: "servers",
      includeStdioType: true,
      reloadHint: "Open Copilot Chat (Agent mode) or run 'MCP: List Servers'."
    },
    {
      id: "antigravity",
      displayName: "Antigravity",
      configPath: antigravityConfig,
      detectPaths: [antigravityConfig, geminiDir],
      format: "json",
      jsonRootKey: "mcpServers",
      includeStdioType: false,
      reloadHint: "Click Refresh in Additional Options (...) -> MCP Servers."
    },
    {
      id: "windsurf",
      displayName: "Windsurf",
      configPath: windsurfConfig,
      detectPaths: [windsurfConfig, windsurfDir],
      format: "json",
      jsonRootKey: "mcpServers",
      includeStdioType: false,
      reloadHint: "Refresh MCP servers in Windsurf Cascade settings."
    },
    {
      id: "claude-code",
      displayName: "Claude Code",
      configPath: claudeCodeConfig,
      detectPaths: [claudeCodeConfig, claudeCodeDir],
      format: "json",
      jsonRootKey: "mcpServers",
      includeStdioType: true,
      reloadHint: "Run 'claude mcp list' or start a new Claude Code session."
    },
    {
      id: "codex",
      displayName: "Codex",
      configPath: codexConfig,
      detectPaths: [codexConfig, codexDir],
      format: "toml",
      reloadHint: "Run 'codex mcp list' or start a new Codex session."
    }
  ];
}

export function upsertJsonMcpServer(
  existingContent: string | null,
  options: {
    rootKey: "mcpServers" | "servers";
    serverName: string;
    spec: ServerLaunchSpec;
    includeStdioType?: boolean;
  }
): { status: "created" | "updated" | "unchanged" | "error"; content?: string; error?: string } {
  const { rootKey, serverName, spec, includeStdioType = false } = options;
  const trimmed = existingContent?.trim() ?? "";

  let parsed: Record<string, unknown> = {};
  const isNewFile = existingContent === null || trimmed.length === 0;

  if (!isNewFile) {
    try {
      const value = JSON.parse(existingContent!);
      if (!isPlainObject(value)) {
        return {
          status: "error",
          error: "Existing configuration root is not a JSON object; file left untouched."
        };
      }
      parsed = { ...value };
    } catch (error) {
      return {
        status: "error",
        error: `Existing file is not strict JSON (${error instanceof Error ? error.message : String(error)}); file left untouched.`
      };
    }
  }

  const existingSection = parsed[rootKey];
  if (existingSection !== undefined && !isPlainObject(existingSection)) {
    return {
      status: "error",
      error: `Existing "${rootKey}" property is not a JSON object; file left untouched.`
    };
  }

  const desiredEntry: Record<string, unknown> = includeStdioType
    ? { type: "stdio", command: spec.command, args: [...spec.args] }
    : { command: spec.command, args: [...spec.args] };

  const currentSection = isPlainObject(existingSection) ? { ...existingSection } : {};
  const currentEntry = currentSection[serverName];

  if (!isNewFile && isPlainObject(currentEntry) && deepEqualJson(currentEntry, desiredEntry)) {
    return {
      status: "unchanged",
      content: existingContent!
    };
  }

  currentSection[serverName] = desiredEntry;
  parsed[rootKey] = currentSection;

  const serialized = `${JSON.stringify(parsed, null, 2)}\n`;
  return {
    status: isNewFile ? "created" : "updated",
    content: serialized
  };
}

export function upsertCodexTomlServer(
  existingContent: string | null,
  options: {
    serverName: string;
    spec: ServerLaunchSpec;
  }
): { status: "created" | "updated" | "unchanged"; content: string } {
  const { serverName, spec } = options;
  const isNewFile = existingContent === null || existingContent.trim().length === 0;
  const eol = existingContent?.includes("\r\n") ? "\r\n" : "\n";

  const formattedKey = formatTomlKey(serverName);
  const blockLines = [
    `[mcp_servers.${formattedKey}]`,
    `command = ${JSON.stringify(spec.command)}`,
    `args = [${spec.args.map((arg) => JSON.stringify(arg)).join(", ")}]`
  ];

  if (isNewFile) {
    return {
      status: "created",
      content: `${blockLines.join(eol)}${eol}`
    };
  }

  const rawLines = existingContent!.split(/\r?\n/);
  const keptLines: string[] = [];
  let skippingTargetSection = false;
  let insertedAtExistingLocation = false;

  for (const line of rawLines) {
    const header = parseTomlTableHeader(line);
    if (header !== null) {
      if (isMatchingCodexMcpHeader(header, serverName)) {
        if (!insertedAtExistingLocation) {
          keptLines.push(...blockLines);
          insertedAtExistingLocation = true;
        }
        skippingTargetSection = true;
        continue;
      }
      if (skippingTargetSection) {
        // Ensure a blank separator line before the next unrelated table if needed
        if (keptLines.length > 0 && keptLines[keptLines.length - 1].trim() !== "") {
          keptLines.push("");
        }
        skippingTargetSection = false;
      }
    }

    if (!skippingTargetSection) {
      keptLines.push(line);
    }
  }

  if (!insertedAtExistingLocation) {
    while (keptLines.length > 0 && keptLines[keptLines.length - 1].trim() === "") {
      keptLines.pop();
    }
    if (keptLines.length > 0) {
      keptLines.push("");
    }
    keptLines.push(...blockLines);
  }

  while (keptLines.length > 0 && keptLines[keptLines.length - 1].trim() === "") {
    keptLines.pop();
  }

  const updatedContent = `${keptLines.join(eol)}${eol}`;
  if (updatedContent === existingContent) {
    return {
      status: "unchanged",
      content: existingContent!
    };
  }

  return {
    status: "updated",
    content: updatedContent
  };
}

export function resolvePackageRoot(candidates: string[] = []): string {
  const searchStarts = [...candidates];
  if (process.argv[1]) {
    try {
      searchStarts.push(fs.realpathSync(process.argv[1]));
    } catch {
      searchStarts.push(path.resolve(process.argv[1]));
    }
  }
  searchStarts.push(process.cwd());

  for (const start of searchStarts) {
    let current = fs.existsSync(start) && fs.statSync(start).isDirectory() ? start : path.dirname(start);
    for (let depth = 0; depth < 5; depth += 1) {
      const pkgJsonPath = path.join(current, "package.json");
      if (fs.existsSync(pkgJsonPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8")) as { name?: string };
          if (pkg.name === PACKAGE_NAME) {
            return current;
          }
        } catch {
          // Ignore unreadable package.json while walking upwards.
        }
      }
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }

  return process.cwd();
}

export function resolveDefaultEntryPath(packageRoot?: string): string {
  const root = packageRoot ?? resolvePackageRoot();
  const distIndex = path.join(root, "dist", "index.js");
  if (fs.existsSync(distIndex)) {
    return distIndex;
  }
  if (process.argv[1]) {
    try {
      return fs.realpathSync(process.argv[1]);
    } catch {
      return path.resolve(process.argv[1]);
    }
  }
  return distIndex;
}

export function findBundledExtension(packageRoot?: string): string | null {
  const root = packageRoot ?? resolvePackageRoot();
  const candidates = [
    path.join(root, "build", "dist", BUNDLED_EXTENSION_FILENAME),
    path.join(root, BUNDLED_EXTENSION_FILENAME)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

export function exportBundledExtension(options: {
  packageRoot?: string;
  destination?: string;
  homeDir?: string;
  cwd?: string;
  dryRun?: boolean;
} = {}): ExtensionExportResult {
  const sourcePath = findBundledExtension(options.packageRoot);
  if (!sourcePath) {
    return {
      status: "not_found",
      reason: `Bundled ${BUNDLED_EXTENSION_FILENAME} was not found. Download it from https://github.com/VLab-Software/easyeda_mcp/releases/latest`
    };
  }

  const homeDir = options.homeDir ?? os.homedir();
  const cwd = options.cwd ?? process.cwd();

  let outputPath: string;
  if (options.destination) {
    const resolvedDest = path.resolve(cwd, options.destination);
    if (resolvedDest.toLowerCase().endsWith(".eext")) {
      outputPath = resolvedDest;
    } else {
      outputPath = path.join(resolvedDest, BUNDLED_EXTENSION_FILENAME);
    }
  } else {
    const downloadsDir = path.join(homeDir, "Downloads");
    const targetDir = fs.existsSync(downloadsDir) && fs.statSync(downloadsDir).isDirectory() ? downloadsDir : cwd;
    outputPath = path.join(targetDir, BUNDLED_EXTENSION_FILENAME);
  }

  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    if (path.resolve(sourcePath) !== path.resolve(outputPath)) {
      fs.copyFileSync(sourcePath, outputPath);
    }
  }

  return {
    status: "exported",
    sourcePath,
    outputPath
  };
}

export function runSetup(options: SetupOptions = {}): SetupReport {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const mode = options.mode ?? "npx";
  const dryRun = options.dryRun ?? false;
  const serverName = options.serverName ?? DEFAULT_SERVER_NAME;
  const packageRoot = options.packageRoot ?? resolvePackageRoot();
  const localEntryPath =
    mode === "local" ? options.localEntryPath ?? resolveDefaultEntryPath(packageRoot) : undefined;

  const launchSpec = buildServerLaunchSpec({
    mode,
    platform,
    localEntryPath,
    packageName: options.packageName ?? PACKAGE_NAME
  });

  const allTargets = resolveClientTargets({ platform, homeDir, cwd, env });
  const requestedSet = options.clients && options.clients.length > 0 ? new Set(options.clients) : null;

  const clientResults: ClientSetupResult[] = [];

  for (const target of allTargets) {
    const detected = target.detectPaths.some((candidate) => fs.existsSync(candidate));
    const shouldConfigure = requestedSet ? requestedSet.has(target.id) : options.all ? true : detected;

    if (!shouldConfigure) {
      if (!requestedSet) {
        clientResults.push({
          id: target.id,
          displayName: target.displayName,
          configPath: target.configPath,
          detected,
          status: "skipped",
          reloadHint: target.reloadHint
        });
      }
      continue;
    }

    const existingContent = fs.existsSync(target.configPath) ? fs.readFileSync(target.configPath, "utf8") : null;

    if (target.format === "json") {
      const outcome = upsertJsonMcpServer(existingContent, {
        rootKey: target.jsonRootKey ?? "mcpServers",
        serverName,
        spec: launchSpec,
        includeStdioType: target.includeStdioType
      });

      if (outcome.status === "error") {
        clientResults.push({
          id: target.id,
          displayName: target.displayName,
          configPath: target.configPath,
          detected,
          status: "error",
          reloadHint: target.reloadHint,
          error: outcome.error
        });
        continue;
      }

      if (!dryRun && (outcome.status === "created" || outcome.status === "updated") && outcome.content !== undefined) {
        writeFileAtomically(target.configPath, outcome.content);
      }

      clientResults.push({
        id: target.id,
        displayName: target.displayName,
        configPath: target.configPath,
        detected,
        status: outcome.status,
        reloadHint: target.reloadHint
      });
    } else {
      const outcome = upsertCodexTomlServer(existingContent, {
        serverName,
        spec: launchSpec
      });

      if (!dryRun && (outcome.status === "created" || outcome.status === "updated")) {
        writeFileAtomically(target.configPath, outcome.content);
      }

      clientResults.push({
        id: target.id,
        displayName: target.displayName,
        configPath: target.configPath,
        detected,
        status: outcome.status,
        reloadHint: target.reloadHint
      });
    }
  }

  let extension: ExtensionExportResult;
  if (options.exportExtension === false) {
    extension = {
      status: "skipped",
      reason: "Skipped via --no-extension."
    };
  } else {
    extension = exportBundledExtension({
      packageRoot,
      destination: options.extensionDir,
      homeDir,
      cwd,
      dryRun
    });
  }

  return {
    serverName,
    mode,
    dryRun,
    launchSpec,
    clients: clientResults,
    extension
  };
}

function writeFileAtomically(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tempPath, content, "utf8");
  fs.renameSync(tempPath, filePath);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepEqualJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatTomlKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function parseTomlTableHeader(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("[")) {
    return null;
  }
  const arrayMatch = /^\[\[([^\[\]]+)\]\]\s*(?:#.*)?$/.exec(trimmed);
  if (arrayMatch) {
    return arrayMatch[1].trim();
  }
  const tableMatch = /^\[([^\[\]]+)\]\s*(?:#.*)?$/.exec(trimmed);
  return tableMatch ? tableMatch[1].trim() : null;
}

function isMatchingCodexMcpHeader(headerPath: string, serverName: string): boolean {
  const segments = splitTomlKeyPath(headerPath);
  return segments.length >= 2 && segments[0] === "mcp_servers" && segments[1] === serverName;
}

function splitTomlKeyPath(headerPath: string): string[] {
  const segments: string[] = [];
  let i = 0;
  const n = headerPath.length;

  while (i < n) {
    while (i < n && /\s/.test(headerPath[i])) {
      i += 1;
    }
    if (i >= n) {
      break;
    }
    if (headerPath[i] === '"' || headerPath[i] === "'") {
      const quote = headerPath[i];
      i += 1;
      let buf = "";
      while (i < n && headerPath[i] !== quote) {
        if (quote === '"' && headerPath[i] === "\\" && i + 1 < n) {
          i += 1;
        }
        buf += headerPath[i];
        i += 1;
      }
      i += 1; // skip closing quote
      segments.push(buf);
    } else {
      let buf = "";
      while (i < n && headerPath[i] !== ".") {
        buf += headerPath[i];
        i += 1;
      }
      segments.push(buf.trim());
    }
    while (i < n && /\s/.test(headerPath[i])) {
      i += 1;
    }
    if (i < n && headerPath[i] === ".") {
      i += 1;
    }
  }

  return segments;
}
