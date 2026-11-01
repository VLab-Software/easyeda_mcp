import fs from "node:fs";
import path from "node:path";

const NODE_BUILTINS = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "fs/promises",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "path/posix",
  "path/win32",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "stream/promises",
  "stream/web",
  "string_decoder",
  "timers",
  "timers/promises",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib"
]);

export function extractImports(source) {
  const imports = [];
  const staticRegex = /(?:import|export)\s+(?:(?:(?:\w+|\{[^}]*\}|\*\s+as\s+\w+)\s+from\s+)|)['"]([^'"]+)['"]/g;
  const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  let match;
  while ((match = staticRegex.exec(source)) !== null) {
    imports.push(match[1]);
  }
  while ((match = dynamicRegex.exec(source)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

export function findSourceFiles(dir, filter = () => true) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSourceFiles(fullPath, filter));
    } else if (entry.isFile() && filter(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

export function isNodeBuiltin(specifier) {
  if (specifier.startsWith("node:")) return true;
  return NODE_BUILTINS.has(specifier);
}

export function findCycles(graph) {
  const visited = new Set();
  const stack = new Set();
  const cycles = [];

  function dfs(node, pathStack) {
    visited.add(node);
    stack.add(node);
    pathStack.push(node);

    for (const neighbor of graph[node] ?? []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, pathStack);
      } else if (stack.has(neighbor)) {
        const cycleStartIndex = pathStack.indexOf(neighbor);
        cycles.push([...pathStack.slice(cycleStartIndex), neighbor]);
      }
    }

    pathStack.pop();
    stack.delete(node);
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

export function validateDependencyArchitecture(fileMap, rootDir = process.cwd()) {
  const violations = [];
  const dependencyGraph = {};

  for (const [filePath, content] of Object.entries(fileMap)) {
    const relPath = path.isAbsolute(filePath) ? path.relative(rootDir, filePath).replace(/\\/g, "/") : filePath;
    const isTest = relPath.endsWith(".test.ts") || relPath.endsWith(".spec.ts");
    const specifiers = extractImports(content);

    dependencyGraph[relPath] = [];

    for (const specifier of specifiers) {
      if (specifier.startsWith(".")) {
        const targetDir = path.dirname(relPath);
        const resolved = path.normalize(path.join(targetDir, specifier)).replace(/\\/g, "/").replace(/\.js$/, ".ts");
        dependencyGraph[relPath].push(resolved);
      }

      // Rule 1: Browser / Extension purity
      if (relPath.startsWith("extension/src/") && !isTest) {
        if (isNodeBuiltin(specifier)) {
          violations.push({
            rule: "no-node-in-extension",
            file: relPath,
            specifier,
            message: `Browser extension module must not import Node builtin "${specifier}"`
          });
        }
        if (specifier === "@modelcontextprotocol/sdk" || specifier.startsWith("@modelcontextprotocol/sdk/")) {
          violations.push({
            rule: "no-mcp-in-extension",
            file: relPath,
            specifier,
            message: `Browser extension module must not import MCP SDK`
          });
        }
        if (specifier.includes("/mcp/") || specifier.includes("/bridge/")) {
          violations.push({
            rule: "no-backend-in-extension",
            file: relPath,
            specifier,
            message: `Browser extension module must not import server mcp or bridge modules: "${specifier}"`
          });
        }
      }

      // Rule 2: Pure schematic analysis
      if (relPath.startsWith("src/schematic/") && !isTest) {
        if (isNodeBuiltin(specifier)) {
          violations.push({
            rule: "no-node-in-schematic",
            file: relPath,
            specifier,
            message: `Schematic pure analysis module must not import Node builtin "${specifier}"`
          });
        }
        if (specifier === "@modelcontextprotocol/sdk" || specifier.startsWith("@modelcontextprotocol/sdk/")) {
          violations.push({
            rule: "no-mcp-in-schematic",
            file: relPath,
            specifier,
            message: `Schematic pure analysis module must not import MCP SDK`
          });
        }
        if (specifier.includes("/mcp/") || specifier.includes("/bridge/") || specifier.includes("extension/")) {
          violations.push({
            rule: "no-host-in-schematic",
            file: relPath,
            specifier,
            message: `Schematic pure analysis module must not import host or bridge modules: "${specifier}"`
          });
        }
      }

      // Rule 3: MCP Tools decoupling
      if (relPath.startsWith("src/mcp/tools/") && !isTest) {
        if (specifier.includes("EasyEdaBridge")) {
          violations.push({
            rule: "no-direct-bridge-in-tools",
            file: relPath,
            specifier,
            message: `MCP tools must depend on EditorClient contract interface, not directly on EasyEdaBridge`
          });
        }
      }
    }
  }

  // Rule 4: Cycle detection
  const cycles = findCycles(dependencyGraph);
  for (const cycle of cycles) {
    violations.push({
      rule: "no-circular-dependencies",
      file: cycle[0],
      cycle,
      message: `Circular dependency detected: ${cycle.join(" -> ")}`
    });
  }

  return {
    valid: violations.length === 0,
    violations,
    cycles
  };
}

export function runCheck(rootDir = process.cwd()) {
  const files = findSourceFiles(rootDir, (file) => {
    const rel = path.relative(rootDir, file).replace(/\\/g, "/");
    if (rel.startsWith("dist/") || rel.startsWith("build/") || rel.startsWith("node_modules/")) return false;
    return (rel.startsWith("src/") || rel.startsWith("extension/src/")) && rel.endsWith(".ts");
  });

  const fileMap = {};
  for (const file of files) {
    const rel = path.relative(rootDir, file).replace(/\\/g, "/");
    fileMap[rel] = fs.readFileSync(file, "utf8");
  }

  return validateDependencyArchitecture(fileMap, rootDir);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const result = runCheck();
  if (!result.valid) {
    console.error("❌ Dependency Architecture Violations found:");
    for (const v of result.violations) {
      console.error(`  - [${v.rule}] in ${v.file}: ${v.message}`);
    }
    process.exit(1);
  }
  console.log("✅ Dependency architecture and boundary checks passed with 0 violations.");
}
