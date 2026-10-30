import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import JSZip from "jszip";

const defaultRepoRoot = path.resolve(import.meta.dirname, "..");
const defaultDistRoot = path.join(defaultRepoRoot, "build", "dist");

export function buildMcpbManifest(pkg) {
  return {
    manifest_version: "0.3",
    name: "easyeda-pro-mcp",
    display_name: "EasyEDA Pro MCP",
    version: pkg.version,
    description:
      pkg.description ||
      "Connect Claude to your live EasyEDA Pro schematic and PCB session over a local WebSocket bridge.",
    author: {
      name: "VLab Software",
      url: "https://github.com/VLab-Software/easyeda_mcp"
    },
    repository: {
      type: "git",
      url: "https://github.com/VLab-Software/easyeda_mcp.git"
    },
    homepage: "https://vlabsoft.org/easyeda_mcp/",
    documentation: "https://vlabsoft.org/easyeda_mcp/quick-start",
    support: "https://github.com/VLab-Software/easyeda_mcp/issues",
    license: pkg.license || "MIT",
    keywords: Array.isArray(pkg.keywords) ? pkg.keywords : ["easyeda", "mcp", "pcb", "schematic"],
    server: {
      type: "node",
      entry_point: "server/index.cjs",
      mcp_config: {
        command: "node",
        args: ["${__dirname}/server/index.cjs"]
      }
    },
    compatibility: {
      platforms: ["darwin", "win32", "linux"],
      runtimes: {
        node: ">=20.0.0"
      }
    }
  };
}

export function validateMcpbManifest(manifest) {
  if (manifest.manifest_version !== "0.3") {
    throw new Error('MCPB manifest_version must be "0.3".');
  }
  if (!manifest.name || !/^[a-z0-9-]+$/.test(manifest.name)) {
    throw new Error("MCPB manifest name must contain only lowercase letters, digits, or hyphens.");
  }
  if (!manifest.version || !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    throw new Error("MCPB manifest version must be a valid semver string.");
  }
  if (!manifest.description) {
    throw new Error("MCPB manifest must include a description.");
  }
  if (!manifest.author?.name) {
    throw new Error("MCPB manifest must include author.name.");
  }
  if (manifest.server?.type !== "node" || !manifest.server?.entry_point) {
    throw new Error('MCPB manifest server must specify type "node" and an entry_point.');
  }
  if (!manifest.server?.mcp_config?.command || !Array.isArray(manifest.server?.mcp_config?.args)) {
    throw new Error("MCPB manifest server.mcp_config must specify command and args.");
  }
}

export async function packageMcpb(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const distRoot = options.distRoot ?? defaultDistRoot;
  const entryPoint = options.entryPoint ?? path.join(repoRoot, "src", "index.ts");
  const pkgPath = path.join(repoRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  const manifest = buildMcpbManifest(pkg);
  validateMcpbManifest(manifest);

  const bundleResult = await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: "server/index.cjs",
    write: false,
    external: ["bufferutil", "utf-8-validate"]
  });

  const bundledServer = bundleResult.outputFiles?.[0]?.contents;
  if (!bundledServer) {
    throw new Error("esbuild failed to produce bundled server output for MCPB.");
  }

  const zip = new JSZip();
  zip.file("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  zip.file("server/index.cjs", Buffer.from(bundledServer));

  for (const extraFile of ["README.md", "LICENSE"]) {
    const fullPath = path.join(repoRoot, extraFile);
    if (fs.existsSync(fullPath)) {
      zip.file(extraFile, fs.readFileSync(fullPath));
    }
  }

  fs.mkdirSync(distRoot, { recursive: true });
  const outFile = path.join(distRoot, `easyeda-pro-mcp_v${manifest.version}.mcpb`);
  const compatFile = path.join(distRoot, "easyeda-pro-mcp.mcpb");
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    streamFiles: true
  });

  fs.writeFileSync(outFile, buffer);
  fs.writeFileSync(compatFile, buffer);

  return {
    outFile,
    compatFile,
    manifest,
    buffer
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await packageMcpb();
  console.log(`Created ${result.outFile}`);
  console.log(`Created ${result.compatFile}`);
}
