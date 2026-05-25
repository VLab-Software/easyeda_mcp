import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import ignore from "ignore";

const repoRoot = path.resolve(import.meta.dirname, "..");
const extensionRoot = path.join(repoRoot, "extension");
const distRoot = path.join(repoRoot, "build", "dist");
const manifestPath = path.join(extensionRoot, "extension.json");
const ignorePath = path.join(extensionRoot, ".edaignore");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (!/^[a-z0-9-]{5,30}$/.test(manifest.name)) {
  throw new Error("extension.json name must be 5-30 chars of lowercase letters, numbers, or hyphen.");
}
if (!/^[a-z0-9]{32}$/.test(manifest.uuid)) {
  throw new Error("extension.json uuid must be exactly 32 lowercase letters or numbers.");
}
if (!manifest.name || !manifest.version || !manifest.entry) {
  throw new Error('extension.json must include "name", "version", and "entry".');
}

const ignoreRules = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, "utf8").split(/\r?\n/) : [];
const matcher = ignore().add(ignoreRules);
const zip = new JSZip();

for (const file of walk(extensionRoot)) {
  const rel = path.relative(extensionRoot, file).replace(/\\/g, "/");
  if (matcher.ignores(rel)) {
    continue;
  }
  zip.file(rel, fs.readFileSync(file));
}

fs.mkdirSync(distRoot, { recursive: true });
const outFile = path.join(distRoot, `${manifest.name}_v${manifest.version}.eext`);
const compatFile = path.join(distRoot, "easyeda_mcp_bridge.eext");
const buffer = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 9 },
  streamFiles: true
});
fs.writeFileSync(outFile, buffer);
fs.writeFileSync(compatFile, buffer);
console.log(`Created ${outFile}`);
console.log(`Created ${compatFile}`);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}
