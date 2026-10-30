import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyVersionFiles,
  detectBumpLevel,
  incSemver,
  prependChangelogSection,
  resolveAndPrepareRelease,
  validatePrTitle
} from "./bump-version.mjs";

function makeTempGitRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "easyeda-mcp-bump-test-"));
  execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Test Bot"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "bot@example.com"], { cwd: dir, stdio: "ignore" });

  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.mkdirSync(path.join(dir, "extension"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });

  fs.writeFileSync(
    path.join(dir, "src", "version.ts"),
    'export const MCP_SERVER_NAME = "easyeda-pro-mcp";\nexport const MCP_SERVER_VERSION = "1.2.0";\nexport const EXTENSION_VERSION = "0.2.0";\n'
  );
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "pkg", version: "1.2.0" }, null, 2));
  fs.writeFileSync(
    path.join(dir, "package-lock.json"),
    JSON.stringify({ name: "pkg", version: "1.2.0", packages: { "": { version: "1.2.0" } } }, null, 2)
  );
  fs.writeFileSync(
    path.join(dir, "server.json"),
    JSON.stringify({ version: "1.2.0", packages: [{ version: "1.2.0" }] }, null, 2)
  );
  fs.writeFileSync(path.join(dir, "extension", "extension.json"), JSON.stringify({ version: "0.2.0" }, null, 2));
  fs.writeFileSync(
    path.join(dir, "docs", "changelog.md"),
    "# Changelog\n\nIntro.\n\n## `1.2.0` (Extension `0.2.0`)\n\n- Initial 1.2.0\n"
  );

  execFileSync("git", ["add", "."], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "chore: initial 1.2.0"], { cwd: dir, stdio: "ignore" });
  return dir;
}

describe("bump-version automation script", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("computes semver increments and commit bump levels accurately", () => {
    expect(incSemver("1.2.0", "patch")).toBe("1.2.1");
    expect(incSemver("1.2.4", "minor")).toBe("1.3.0");
    expect(incSemver("1.2.4", "major")).toBe("2.0.0");

    expect(detectBumpLevel([{ subject: "fix: resolve timeout", body: "" }])).toBe("patch");
    expect(detectBumpLevel([{ subject: "docs: update guide", body: "" }])).toBe("patch");
    expect(detectBumpLevel([{ subject: "feature: add schematic diff", body: "" }])).toBe("minor");
    expect(detectBumpLevel([{ subject: "feat(cli): support zed", body: "" }])).toBe("minor");
    expect(detectBumpLevel([{ subject: "Develop (#20)", body: "* fix: typo\n* feature: add zed support" }])).toBe(
      "minor"
    );
    expect(detectBumpLevel([{ subject: "feature!: drop legacy rpc", body: "" }])).toBe("major");
    expect(detectBumpLevel([{ subject: "Develop (#20)", body: "* feature!: drop legacy rpc" }])).toBe("major");
    expect(detectBumpLevel([{ subject: "fix: protocol", body: "BREAKING CHANGE: new handshake" }])).toBe("major");
  });

  it("uses pre-bumped package.json version directly when tag does not exist yet", () => {
    const repo = makeTempGitRepo();
    tempDirs.push(repo);

    // No v1.2.0 tag created yet -> should tag v1.2.0 without bumping to 1.2.1
    const res = resolveAndPrepareRelease({ repoRoot: repo });
    expect(res).toEqual({
      skip: false,
      bumped: false,
      bumpLevel: "prebumped",
      serverVersion: "1.2.0",
      extensionVersion: "0.2.0",
      tag: "v1.2.0"
    });
  });

  it("auto-bumps minor server version on feature: commit and keeps extension version when extension/ is untouched", () => {
    const repo = makeTempGitRepo();
    tempDirs.push(repo);
    execFileSync("git", ["tag", "v1.2.0"], { cwd: repo, stdio: "ignore" });

    fs.writeFileSync(path.join(repo, "src", "feature.ts"), "export const x = 1;\n");
    execFileSync("git", ["add", "."], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "feature: add new schematic query"], { cwd: repo, stdio: "ignore" });

    const res = resolveAndPrepareRelease({ repoRoot: repo });
    expect(res).toEqual({
      skip: false,
      bumped: true,
      bumpLevel: "minor",
      serverVersion: "1.3.0",
      extensionVersion: "0.2.0",
      tag: "v1.3.0"
    });

    expect(JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8")).version).toBe("1.3.0");
    expect(JSON.parse(fs.readFileSync(path.join(repo, "package-lock.json"), "utf8")).packages[""].version).toBe("1.3.0");
    expect(JSON.parse(fs.readFileSync(path.join(repo, "server.json"), "utf8")).packages[0].version).toBe("1.3.0");
    expect(JSON.parse(fs.readFileSync(path.join(repo, "extension", "extension.json"), "utf8")).version).toBe("0.2.0");
    expect(fs.readFileSync(path.join(repo, "docs", "changelog.md"), "utf8")).toContain(
      "## `1.3.0` (Extension `0.2.0`)\n\n- feature: add new schematic query"
    );
  });

  it("also auto-bumps extension/extension.json when files under extension/ changed", () => {
    const repo = makeTempGitRepo();
    tempDirs.push(repo);
    execFileSync("git", ["tag", "v1.2.0"], { cwd: repo, stdio: "ignore" });

    fs.writeFileSync(path.join(repo, "extension", "bridge.ts"), "export const y = 2;\n");
    execFileSync("git", ["add", "."], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "fix: reconnect websocket after sleep"], { cwd: repo, stdio: "ignore" });

    const res = resolveAndPrepareRelease({ repoRoot: repo });
    expect(res).toEqual({
      skip: false,
      bumped: true,
      bumpLevel: "patch",
      serverVersion: "1.2.1",
      extensionVersion: "0.2.1",
      tag: "v1.2.1"
    });
    expect(JSON.parse(fs.readFileSync(path.join(repo, "extension", "extension.json"), "utf8")).version).toBe("0.2.1");
    expect(fs.readFileSync(path.join(repo, "src", "version.ts"), "utf8")).toContain('EXTENSION_VERSION = "0.2.1"');
  });

  it("skips when HEAD is already tagged and no new commits exist", () => {
    const repo = makeTempGitRepo();
    tempDirs.push(repo);
    execFileSync("git", ["tag", "v1.2.0"], { cwd: repo, stdio: "ignore" });

    const res = resolveAndPrepareRelease({ repoRoot: repo });
    expect(res.skip).toBe(true);
  });

  it("prepends changelog cleanly while filtering merge and release commits", () => {
    const updated = prependChangelogSection("# Changelog\n\n## `1.2.0` (Extension `0.2.0`)\n\n- Old\n", {
      serverVersion: "1.2.1",
      extensionVersion: "0.2.0",
      subjects: ["Merge pull request #18 from VLab-Software/develop", "chore(release): v1.2.0", "fix: handle empty port"]
    });
    expect(updated).toContain("## `1.2.1` (Extension `0.2.0`)\n\n- fix: handle empty port\n\n## `1.2.0`");
    expect(updated).not.toContain("Merge pull request");
  });

  it("validates PR titles against SemVer prefixes for develop and master", () => {
    expect(validatePrTitle("feature: add one-command client setup", "develop")).toEqual({
      valid: true,
      bumpLevel: "minor"
    });
    expect(validatePrTitle("fix: handle empty ws port", "develop")).toEqual({
      valid: true,
      bumpLevel: "patch"
    });
    expect(validatePrTitle("feature!: drop legacy bridge protocol", "develop")).toEqual({
      valid: true,
      bumpLevel: "major"
    });
    expect(validatePrTitle("Release from develop", "master")).toEqual({
      valid: true,
      bumpLevel: "auto-from-commits"
    });
    expect(validatePrTitle("add new tool without prefix", "develop").valid).toBe(false);
  });
});
