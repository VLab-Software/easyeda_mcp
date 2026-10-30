import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepoRoot = path.resolve(import.meta.dirname, "..");

export function extractChangelogSection(changelogContent, version) {
  if (!changelogContent || !version) {
    return "";
  }

  const cleanVersion = version.replace(/^v/, "").trim();
  // Match heading like ## `1.3.0` or ## 1.3.0 or ## `v1.3.0`
  const headingRegex = new RegExp(`^##\\s+[\`"]?v?${cleanVersion.replace(/\./g, "\\.")}[\`"]?.*$`, "m");
  const match = headingRegex.exec(changelogContent);
  if (!match) {
    return "";
  }

  const startIndex = match.index + match[0].length;
  const afterHeader = changelogContent.slice(startIndex);

  // Find next section header (## ) or end of file
  const nextHeaderMatch = /\n##\s+/.exec(afterHeader);
  const rawSection = nextHeaderMatch ? afterHeader.slice(0, nextHeaderMatch.index) : afterHeader;

  return rawSection.trim();
}

export function filterReleaseCommits(commits) {
  const seen = new Set();
  const cleaned = [];

  for (const commit of commits) {
    const subject = (commit.subject ?? "").trim();
    if (!subject) continue;
    if (/^Merge (pull request|branch|remote-tracking branch)\b/i.test(subject)) continue;
    if (/^chore\(release\):/i.test(subject) || /^chore: release/i.test(subject)) continue;
    if (seen.has(subject)) continue;
    seen.add(subject);
    cleaned.push(commit);
  }

  return cleaned;
}

export function categorizeCommits(commits) {
  const categories = {
    features: [],
    fixes: [],
    docs: [],
    maintenance: []
  };

  const filtered = filterReleaseCommits(commits);

  for (const commit of filtered) {
    const subject = commit.subject.trim();
    if (/^(feat|feature)(\([^)]+\))?:/i.test(subject)) {
      categories.features.push(subject);
    } else if (/^fix(\([^)]+\))?:/i.test(subject)) {
      categories.fixes.push(subject);
    } else if (/^docs(\([^)]+\))?:/i.test(subject)) {
      categories.docs.push(subject);
    } else {
      categories.maintenance.push(subject);
    }
  }

  return categories;
}

export function formatCategorizedCommits(categories) {
  const sections = [];

  if (categories.features.length > 0) {
    sections.push("#### 🚀 Features & Improvements", "");
    for (const item of categories.features) {
      sections.push(`- ${item}`);
    }
    sections.push("");
  }

  if (categories.fixes.length > 0) {
    sections.push("#### 🐛 Bug Fixes", "");
    for (const item of categories.fixes) {
      sections.push(`- ${item}`);
    }
    sections.push("");
  }

  if (categories.docs.length > 0) {
    sections.push("#### 📚 Documentation", "");
    for (const item of categories.docs) {
      sections.push(`- ${item}`);
    }
    sections.push("");
  }

  if (categories.maintenance.length > 0) {
    sections.push("#### 🔧 Maintenance & Chores", "");
    for (const item of categories.maintenance) {
      sections.push(`- ${item}`);
    }
    sections.push("");
  }

  return sections.join("\n").trim();
}

export function getCommitsSinceTag(repoRoot, targetTag) {
  try {
    // Find previous tag before targetTag if targetTag exists, or latest tag overall
    let range = "HEAD";
    const tagsOutput = execFileSync("git", ["tag", "--sort=-v:refname"], {
      cwd: repoRoot,
      encoding: "utf8"
    }).trim();

    const tags = tagsOutput.split("\n").map((t) => t.trim()).filter(Boolean);
    const targetIdx = tags.indexOf(targetTag);

    let prevTag = null;
    if (targetIdx !== -1 && targetIdx < tags.length - 1) {
      prevTag = tags[targetIdx + 1];
    } else if (tags.length > 0 && tags[0] !== targetTag) {
      prevTag = tags[0];
    } else if (tags.length > 1) {
      prevTag = tags[1];
    }

    if (prevTag) {
      range = `${prevTag}..HEAD`;
    }

    const rawLog = execFileSync("git", ["log", range, "--format=%s%x1f%b%x1e"], {
      cwd: repoRoot,
      encoding: "utf8"
    }).trim();

    if (!rawLog) return [];

    return rawLog
      .split("\x1e")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [subject = "", body = ""] = entry.split("\x1f");
        return { subject: subject.trim(), body: body.trim() };
      });
  } catch {
    return [];
  }
}

export function generateReleaseNotes(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const pkgPath = path.join(repoRoot, "package.json");
  const extManifestPath = path.join(repoRoot, "extension", "extension.json");
  const changelogPath = options.changelogPath ?? path.join(repoRoot, "docs", "changelog.md");

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const manifest = fs.existsSync(extManifestPath)
    ? JSON.parse(fs.readFileSync(extManifestPath, "utf8"))
    : { name: "easyeda-mcp-bridge", version: "0.1.0" };

  const tag = options.tag ?? (options.serverVersion ? `v${options.serverVersion}` : `v${pkg.version}`);
  const serverVersion = options.serverVersion ?? tag.replace(/^v/, "");
  const extensionVersion = options.extensionVersion ?? manifest.version;
  const packageName = pkg.name || "@vlabsoftware/easyeda-pro-mcp";

  let changelogNotes = "";
  if (fs.existsSync(changelogPath)) {
    const fullChangelog = fs.readFileSync(changelogPath, "utf8");
    changelogNotes = extractChangelogSection(fullChangelog, serverVersion);
  }

  if (!changelogNotes) {
    const commits = getCommitsSinceTag(repoRoot, tag);
    const categorized = categorizeCommits(commits);
    changelogNotes = formatCategorizedCommits(categorized);
  }

  if (!changelogNotes) {
    changelogNotes = `- Automated release \`${tag}\`.`;
  }

  const notesLines = [
    `## EasyEDA Pro MCP v${serverVersion} (Extension v${extensionVersion})`,
    "",
    "### 📋 What's Changed",
    "",
    changelogNotes,
    "",
    "### ⚡ Quick Install (All AI Clients)",
    "",
    "```bash",
    `npx -y ${packageName} setup`,
    "```",
    "",
    "### 📦 Release Assets",
    "",
    `- \`${manifest.name}_v${extensionVersion}.eext\`: versioned EasyEDA Pro extension package`,
    "- `easyeda_mcp_bridge.eext`: stable filename for the EasyEDA Pro extension package",
    `- \`easyeda-pro-mcp_v${serverVersion}.mcpb\`: versioned 1-click MCPB bundle`,
    "- `easyeda-pro-mcp.mcpb`: stable filename for the 1-click MCPB bundle",
    "- `SHA256SUMS.txt`: SHA-256 checksums for all release assets",
    "",
    "See the [Quick Start](https://vlabsoft.org/easyeda_mcp/quick-start) and [AI Client Setup](https://vlabsoft.org/easyeda_mcp/ai-client-setup) guides for full instructions.",
    ""
  ];

  return notesLines.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let tag = null;
  let outputPath = null;
  let changelogPath = null;

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--tag" && args[i + 1]) {
      tag = args[++i];
    } else if (args[i] === "--output" && args[i + 1]) {
      outputPath = args[++i];
    } else if (args[i] === "--changelog" && args[i + 1]) {
      changelogPath = args[++i];
    }
  }

  const notes = generateReleaseNotes({ tag, changelogPath });

  if (outputPath) {
    fs.writeFileSync(outputPath, notes, "utf8");
    console.log(`Generated release notes at ${outputPath}`);
  } else {
    process.stdout.write(notes);
  }
}
