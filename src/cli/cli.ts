import { EXTENSION_VERSION, MCP_SERVER_NAME, MCP_SERVER_VERSION } from "../version.js";
import {
  type ClientId,
  DEFAULT_SERVER_NAME,
  type EnvContext,
  exportBundledExtension,
  isClientId,
  PACKAGE_NAME,
  runSetup,
  type SetupReport,
  SUPPORTED_CLIENT_IDS
} from "./setup.js";

export type CliIo = {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
};

const defaultIo: CliIo = {
  stdout: (message: string) => console.log(message),
  stderr: (message: string) => console.error(message)
};

export type CliRunContext = EnvContext & {
  packageRoot?: string;
  localEntryPath?: string;
};

export function handleCliArgs(
  argv: string[],
  io: CliIo = defaultIo,
  context: CliRunContext = {}
): { handled: boolean; exitCode: number } {
  if (argv.length === 0) {
    return { handled: false, exitCode: 0 };
  }

  const command = argv[0];

  if (command === "serve" && argv.length === 1) {
    return { handled: false, exitCode: 0 };
  }

  if (command === "--version" || command === "-v" || command === "version") {
    io.stdout(`${MCP_SERVER_NAME} v${MCP_SERVER_VERSION} (extension v${EXTENSION_VERSION})`);
    return { handled: true, exitCode: 0 };
  }

  if (command === "--help" || command === "-h" || command === "help") {
    io.stdout(renderMainHelp());
    return { handled: true, exitCode: 0 };
  }

  if (command === "setup" || command === "install" || command === "init") {
    return runSetupCommand(argv.slice(1), io, context);
  }

  if (command === "export-extension") {
    return runExportExtensionCommand(argv.slice(1), io, context);
  }

  io.stderr(`Unknown command or option: "${command}". Run "${MCP_SERVER_NAME} --help" for usage.`);
  return { handled: true, exitCode: 1 };
}

function runSetupCommand(
  args: string[],
  io: CliIo,
  context: CliRunContext
): { handled: true; exitCode: number } {
  const clients: ClientId[] = [];
  let all = false;
  let mode: "npx" | "local" = "npx";
  let serverName = DEFAULT_SERVER_NAME;
  let extensionDir: string | undefined;
  let exportExtension = true;
  let dryRun = false;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      io.stdout(renderSetupHelp());
      return { handled: true, exitCode: 0 };
    }
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg === "--local") {
      mode = "local";
      continue;
    }
    if (arg === "--no-extension") {
      exportExtension = false;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--json") {
      jsonOutput = true;
      continue;
    }
    if (arg === "--client" || arg === "-c" || arg.startsWith("--client=")) {
      const rawValue = arg.startsWith("--client=") ? arg.slice("--client=".length) : args[++i];
      if (!rawValue) {
        io.stderr("Missing value for --client. Supported clients: " + SUPPORTED_CLIENT_IDS.join(", "));
        return { handled: true, exitCode: 1 };
      }
      for (const part of rawValue.split(",").map((item) => item.trim()).filter(Boolean)) {
        if (!isClientId(part)) {
          io.stderr(`Unsupported client "${part}". Supported clients: ${SUPPORTED_CLIENT_IDS.join(", ")}`);
          return { handled: true, exitCode: 1 };
        }
        if (!clients.includes(part)) {
          clients.push(part);
        }
      }
      continue;
    }
    if (arg === "--name" || arg.startsWith("--name=")) {
      const rawValue = arg.startsWith("--name=") ? arg.slice("--name=".length) : args[++i];
      if (!rawValue || !rawValue.trim()) {
        io.stderr("Missing value for --name.");
        return { handled: true, exitCode: 1 };
      }
      serverName = rawValue.trim();
      continue;
    }
    if (arg === "--extension-dir" || arg.startsWith("--extension-dir=")) {
      const rawValue = arg.startsWith("--extension-dir=") ? arg.slice("--extension-dir=".length) : args[++i];
      if (!rawValue || !rawValue.trim()) {
        io.stderr("Missing value for --extension-dir.");
        return { handled: true, exitCode: 1 };
      }
      extensionDir = rawValue.trim();
      continue;
    }

    io.stderr(`Unknown option for setup: "${arg}". Run "${MCP_SERVER_NAME} setup --help" for usage.`);
    return { handled: true, exitCode: 1 };
  }

  const report = runSetup({
    ...context,
    clients: clients.length > 0 ? clients : undefined,
    all,
    mode,
    serverName,
    extensionDir,
    exportExtension,
    dryRun
  });

  if (jsonOutput) {
    io.stdout(JSON.stringify(report, null, 2));
  } else {
    io.stdout(renderSetupReport(report));
  }

  const hasError = report.clients.some((client) => client.status === "error");
  return { handled: true, exitCode: hasError ? 1 : 0 };
}

function runExportExtensionCommand(
  args: string[],
  io: CliIo,
  context: CliRunContext
): { handled: true; exitCode: number } {
  let destination: string | undefined;
  let dryRun = false;
  let jsonOutput = false;

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      io.stdout(renderExportExtensionHelp());
      return { handled: true, exitCode: 0 };
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--json") {
      jsonOutput = true;
      continue;
    }
    if (arg.startsWith("-")) {
      io.stderr(`Unknown option for export-extension: "${arg}".`);
      return { handled: true, exitCode: 1 };
    }
    if (destination !== undefined) {
      io.stderr("Too many positional arguments for export-extension.");
      return { handled: true, exitCode: 1 };
    }
    destination = arg;
  }

  const result = exportBundledExtension({
    packageRoot: context.packageRoot,
    destination: destination ?? ".",
    homeDir: context.homeDir,
    cwd: context.cwd,
    dryRun
  });

  if (jsonOutput) {
    io.stdout(JSON.stringify(result, null, 2));
  } else if (result.status === "exported") {
    const prefix = dryRun ? "[dry-run] Would export" : "Exported";
    io.stdout(`${prefix} EasyEDA Pro extension to: ${result.outputPath}`);
  } else {
    io.stderr(result.reason ?? "Failed to export EasyEDA Pro extension.");
  }

  return { handled: true, exitCode: result.status === "exported" ? 0 : 1 };
}

function renderSetupReport(report: SetupReport): string {
  const lines: string[] = [];
  const dryRunPrefix = report.dryRun ? "[DRY RUN] " : "";
  lines.push(`${dryRunPrefix}EasyEDA Pro MCP v${MCP_SERVER_VERSION} — Client Setup`);
  lines.push(`Server entry ("${report.serverName}"): ${report.launchSpec.command} ${report.launchSpec.args.join(" ")}`);
  lines.push("");
  lines.push("MCP Clients:");

  const activeClients = report.clients.filter(
    (c) => c.status === "created" || c.status === "updated" || c.status === "unchanged"
  );

  for (const client of report.clients) {
    const badge =
      client.status === "created"
        ? "[created]  "
        : client.status === "updated"
          ? "[updated]  "
          : client.status === "unchanged"
            ? "[ok]       "
            : client.status === "error"
              ? "[error]    "
              : "[skipped]  ";

    if (client.status === "skipped") {
      lines.push(`  ${badge} ${client.displayName} (not detected on this machine)`);
    } else if (client.status === "error") {
      lines.push(`  ${badge} ${client.displayName} -> ${client.configPath}`);
      lines.push(`              ${client.error}`);
    } else {
      lines.push(`  ${badge} ${client.displayName} -> ${client.configPath}`);
    }
  }

  if (activeClients.length === 0) {
    lines.push("");
    lines.push(
      `Tip: No installed client directories were auto-detected. Run "npx -y ${PACKAGE_NAME} setup --client cursor" (or --all) to create config files explicitly.`
    );
  }

  lines.push("");
  if (report.extension.status === "exported") {
    lines.push(`EasyEDA Pro Extension (.eext): ${report.extension.outputPath}`);
  } else if (report.extension.status === "not_found") {
    lines.push(`EasyEDA Pro Extension (.eext): ${report.extension.reason}`);
  } else {
    lines.push(`EasyEDA Pro Extension (.eext): skipped`);
  }

  lines.push("");
  lines.push("Next steps:");
  lines.push("  1. In EasyEDA Pro (>= 2.3.0), open Extensions Manager and import easyeda_mcp_bridge.eext.");
  lines.push("  2. Enable 'Allow interactive with external' for the extension and open a schematic or PCB.");
  if (activeClients.length > 0) {
    lines.push("  3. Reload your AI client and run: 'Run easyeda_doctor'.");
    for (const client of activeClients) {
      if (client.status === "created" || client.status === "updated") {
        lines.push(`     - ${client.displayName}: ${client.reloadHint}`);
      }
    }
  } else {
    lines.push("  3. Ask your AI client: 'Run easyeda_doctor'.");
  }

  return lines.join("\n");
}

function renderMainHelp(): string {
  return [
    `EasyEDA Pro MCP v${MCP_SERVER_VERSION} (extension v${EXTENSION_VERSION})`,
    "",
    "Usage:",
    `  npx -y ${PACKAGE_NAME}                   Start the MCP server over stdio (default for AI clients)`,
    `  npx -y ${PACKAGE_NAME} setup [options]   Auto-configure AI clients and export easyeda_mcp_bridge.eext`,
    `  npx -y ${PACKAGE_NAME} export-extension  Copy easyeda_mcp_bridge.eext to a folder (default: current dir)`,
    `  npx -y ${PACKAGE_NAME} --version         Print server and bundled extension versions`,
    `  npx -y ${PACKAGE_NAME} --help            Show this help message`,
    "",
    "Setup Options:",
    `  --client, -c <ids>      Comma-separated clients (${SUPPORTED_CLIENT_IDS.join(", ")})`,
    "  --all                   Configure all supported clients even if not detected yet",
    "  --local                 Configure clients to run this local checkout via 'node .../dist/index.js'",
    `  --name <server-name>    MCP server key name (default: ${DEFAULT_SERVER_NAME})`,
    "  --extension-dir <dir>   Output directory for easyeda_mcp_bridge.eext (default: ~/Downloads or cwd)",
    "  --no-extension          Skip exporting easyeda_mcp_bridge.eext",
    "  --dry-run               Preview changes without writing any files",
    "  --json                  Output machine-readable JSON report"
  ].join("\n");
}

function renderSetupHelp(): string {
  return [
    `Usage: npx -y ${PACKAGE_NAME} setup [options]`,
    "",
    "Automatically configures detected MCP clients on your machine and exports easyeda_mcp_bridge.eext.",
    "",
    `Supported clients: ${SUPPORTED_CLIENT_IDS.join(", ")}`,
    "",
    "Options:",
    "  --client, -c <ids>      Configure specific client(s), comma-separated (e.g. --client cursor,vscode)",
    "  --all                   Configure all supported clients regardless of detection",
    "  --local                 Point clients to local 'node <path>/dist/index.js' instead of 'npx'",
    `  --name <server-name>    Server entry name (default: ${DEFAULT_SERVER_NAME})`,
    "  --extension-dir <dir>   Target folder for easyeda_mcp_bridge.eext",
    "  --no-extension          Do not copy easyeda_mcp_bridge.eext",
    "  --dry-run               Preview changes without modifying disk",
    "  --json                  Print JSON report"
  ].join("\n");
}

function renderExportExtensionHelp(): string {
  return [
    `Usage: npx -y ${PACKAGE_NAME} export-extension [destination] [options]`,
    "",
    "Copies the bundled easyeda_mcp_bridge.eext file so you can import it in EasyEDA Pro Extensions Manager.",
    "",
    "Arguments:",
    "  destination   Target directory or .eext file path (default: ./easyeda_mcp_bridge.eext)",
    "",
    "Options:",
    "  --dry-run     Preview target path without copying",
    "  --json        Print JSON result"
  ].join("\n");
}
