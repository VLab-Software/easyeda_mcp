import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  categorizeCommits,
  extractChangelogSection,
  filterReleaseCommits,
  formatCategorizedCommits,
  generateReleaseNotes
} from "./generate-release-notes.mjs";

describe("generate-release-notes", () => {
  it("extracts the exact changelog section for a given version", () => {
    const changelog = [
      "# Changelog",
      "",
      "## `1.2.0` (Extension `0.2.0`)",
      "",
      "**One-Command Setup**",
      "",
      "- Feature A",
      "- Feature B",
      "",
      "## `1.1.0` (Extension `0.2.0`)",
      "",
      "- Feature C"
    ].join("\n");

    const section = extractChangelogSection(changelog, "1.2.0");
    expect(section).toContain("**One-Command Setup**");
    expect(section).toContain("- Feature A");
    expect(section).toContain("- Feature B");
    expect(section).not.toContain("- Feature C");
  });

  it("extracts changelog with or without backticks or v prefix", () => {
    const changelog = [
      "# Changelog",
      "",
      "## v2.0.0",
      "",
      "- Major overhaul",
      "",
      "## 1.0.0",
      "",
      "- Initial"
    ].join("\n");

    expect(extractChangelogSection(changelog, "v2.0.0")).toBe("- Major overhaul");
    expect(extractChangelogSection(changelog, "2.0.0")).toBe("- Major overhaul");
    expect(extractChangelogSection(changelog, "1.0.0")).toBe("- Initial");
  });

  it("filters merge commits and release commits", () => {
    const commits = [
      { subject: "Merge pull request #15 from develop", body: "" },
      { subject: "Merge remote-tracking branch 'origin/master'", body: "" },
      { subject: "chore(release): v1.2.0", body: "" },
      { subject: "chore: release v1.2.0", body: "" },
      { subject: "feat: add super awesome feature", body: "" },
      { subject: "fix: solve critical bug", body: "" }
    ];

    const filtered = filterReleaseCommits(commits);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((c) => c.subject)).toEqual([
      "feat: add super awesome feature",
      "fix: solve critical bug"
    ]);
  });

  it("categorizes conventional commits into groups", () => {
    const commits = [
      { subject: "feature: add active DRC execution", body: "" },
      { subject: "feat(pcb): support routing inspection", body: "" },
      { subject: "fix: handle empty netlist response", body: "" },
      { subject: "docs: update quick start guide", body: "" },
      { subject: "chore: bump dev dependencies", body: "" },
      { subject: "refactor: simplify bridge connection logic", body: "" }
    ];

    const categories = categorizeCommits(commits);
    expect(categories.features).toEqual([
      "feature: add active DRC execution",
      "feat(pcb): support routing inspection"
    ]);
    expect(categories.fixes).toEqual(["fix: handle empty netlist response"]);
    expect(categories.docs).toEqual(["docs: update quick start guide"]);
    expect(categories.maintenance).toEqual([
      "chore: bump dev dependencies",
      "refactor: simplify bridge connection logic"
    ]);

    const formatted = formatCategorizedCommits(categories);
    expect(formatted).toContain("#### 🚀 Features & Improvements");
    expect(formatted).toContain("#### 🐛 Bug Fixes");
    expect(formatted).toContain("#### 📚 Documentation");
    expect(formatted).toContain("#### 🔧 Maintenance & Chores");
  });

  it("generates full release notes using repo root and fallback commits", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "release-notes-test-"));
    try {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ name: "@vlabsoftware/test-mcp", version: "9.9.9" }),
        "utf8"
      );
      fs.mkdirSync(path.join(tmpDir, "extension"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, "extension", "extension.json"),
        JSON.stringify({ name: "test-bridge", version: "1.0.0" }),
        "utf8"
      );

      const notes = generateReleaseNotes({
        repoRoot: tmpDir,
        serverVersion: "9.9.9",
        extensionVersion: "1.0.0"
      });

      expect(notes).toContain("## EasyEDA Pro MCP v9.9.9 (Extension v1.0.0)");
      expect(notes).toContain("### ⚡ Quick Install (All AI Clients)");
      expect(notes).toContain("npx -y @vlabsoftware/test-mcp setup");
      expect(notes).toContain("test-bridge_v1.0.0.eext");
      expect(notes).toContain("easyeda-pro-mcp_v9.9.9.mcpb");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
