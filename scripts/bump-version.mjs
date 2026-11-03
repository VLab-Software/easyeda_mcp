import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepoRoot = path.resolve(import.meta.dirname, "..");

export function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version.trim());
  if (!match) {
    throw new Error(`Invalid semantic version: "${version}". Expected X.Y.Z or X.Y.Z-prerelease.`);
  }
  const prerelease = match[4] || null;
  let prereleaseTag = null;
  let prereleaseNum = null;
  if (prerelease) {
    const preMatch = /^([a-zA-Z0-9-]+)(?:\.(\d+))?$/.exec(prerelease);
    if (preMatch) {
      prereleaseTag = preMatch[1];
      prereleaseNum = preMatch[2] !== undefined ? Number(preMatch[2]) : null;
    } else {
      prereleaseTag = prerelease;
      prereleaseNum = null;
    }
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
    prereleaseTag,
    prereleaseNum
  };
}

export function incSemver(version, level, options = {}) {
  const channel = options.channel || "stable";
  const prereleaseTag = options.prereleaseTag || (channel !== "stable" ? channel : "beta");
  const isPrerelease = channel !== "stable";
  const parsed = parseSemver(version);

  if (isPrerelease) {
    // If already a prerelease on the same base, bump prerelease counter unless major is explicitly requested
    if (parsed.prerelease && level !== "major") {
      const nextNum = (parsed.prereleaseNum ?? -1) + 1;
      return `${parsed.major}.${parsed.minor}.${parsed.patch}-${prereleaseTag}.${nextNum}`;
    }
    const base = incSemver(`${parsed.major}.${parsed.minor}.${parsed.patch}`, level, { channel: "stable" });
    return `${base}-${prereleaseTag}.0`;
  }

  // Graduating from a prerelease directly to stable base:
  if (parsed.prerelease && (level === "auto" || level === "graduate" || level === "patch" || level === "minor")) {
    return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  }

  if (level === "major") {
    return `${parsed.major + 1}.0.0`;
  }
  if (level === "minor") {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  }
  if (level === "patch") {
    return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }
  throw new Error(`Unsupported bump level: "${level}".`);
}

export function detectBumpLevel(commits, requestedBump = "auto") {
  if (requestedBump === "major" || requestedBump === "minor" || requestedBump === "patch") {
    return requestedBump;
  }

  let hasMinor = false;
  for (const commit of commits) {
    const subject = (commit.subject ?? "").trim();
    const body = (commit.body ?? "").trim();

    if (
      /BREAKING[ -]CHANGE:/i.test(body) ||
      /^[a-z]+(\([^)]+\))?!:/i.test(subject) ||
      /^\*\s+[a-z]+(\([^)]+\))?!:/im.test(body)
    ) {
      return "major";
    }
    if (/^(feat|feature)(\([^)]+\))?:/i.test(subject) || /^\*\s+(feat|feature)(\([^)]+\))?:/im.test(body)) {
      hasMinor = true;
    }
  }

  return hasMinor ? "minor" : "patch";
}

const CONVENTIONAL_PR_TITLE_RE = /^(feat|feature|fix|docs|chore|refactor|perf|test|ci)(\([^)]+\))?(!)?: (\S.*)$/i;
const MASTER_RELEASE_PR_TITLE_RE = /^(release|merge|develop)\b/i;

export function validatePrTitle(title, baseRef = "develop") {
  const trimmed = (title ?? "").trim();
  const match = CONVENTIONAL_PR_TITLE_RE.exec(trimmed);
  if (match) {
    const type = match[1].toLowerCase();
    const isBreaking = Boolean(match[3]);
    const bumpLevel = isBreaking ? "major" : type === "feat" || type === "feature" ? "minor" : "patch";
    return {
      valid: true,
      bumpLevel
    };
  }

  if (baseRef === "master" && MASTER_RELEASE_PR_TITLE_RE.test(trimmed)) {
    return {
      valid: true,
      bumpLevel: "auto-from-commits"
    };
  }

  return {
    valid: false,
    error: [
      `Invalid PR title: "${trimmed}"`,
      "",
      "Expected format: <prefix>: <description>",
      "  - feature: <description>   (bumps MINOR version: 1.2.0 -> 1.3.0)",
      "  - fix: <description>       (bumps PATCH version: 1.2.0 -> 1.2.1)",
      "  - docs: <description>      (bumps PATCH version: 1.2.0 -> 1.2.1)",
      "  - chore: <description>     (bumps PATCH version: 1.2.0 -> 1.2.1)",
      "  - refactor: <description>  (bumps PATCH version: 1.2.0 -> 1.2.1)",
      "  - feature!: <description>  (bumps MAJOR version: 1.2.0 -> 2.0.0)"
    ].join("\n")
  };
}

export function filterChangelogSubjects(subjects) {
  const seen = new Set();
  const cleaned = [];
  for (const raw of subjects) {
    const line = raw.trim();
    if (!line) continue;
    if (/^Merge (pull request|branch|remote-tracking branch)\b/i.test(line)) continue;
    if (/^chore\(release\):/i.test(line)) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    cleaned.push(line);
  }
  return cleaned;
}

export function prependChangelogSection(existingChangelog, { serverVersion, extensionVersion, subjects }) {
  const headingPrefix = `## \`${serverVersion}\``;
  if (existingChangelog.includes(headingPrefix)) {
    return existingChangelog;
  }

  const bullets = filterChangelogSubjects(subjects);
  const bulletLines =
    bullets.length > 0 ? bullets.map((item) => `- ${item}`) : [`- Automated release \`v${serverVersion}\`.`];

  const section = [`## \`${serverVersion}\` (Extension \`${extensionVersion}\`)`, "", ...bulletLines, ""].join("\n");

  const firstReleaseIdx = existingChangelog.indexOf("\n## `");
  if (firstReleaseIdx === -1) {
    return `${existingChangelog.trimEnd()}\n\n${section}`;
  }

  return `${existingChangelog.slice(0, firstReleaseIdx + 1)}${section}\n${existingChangelog.slice(firstReleaseIdx + 1)}`;
}

export function applyVersionFiles(repoRoot, { serverVersion, extensionVersion, commitSubjects = [] }) {
  parseSemver(serverVersion);
  parseSemver(extensionVersion);

  // 1. src/version.ts
  const versionTsPath = path.join(repoRoot, "src", "version.ts");
  const versionTs = [
    `export const MCP_SERVER_NAME = "easyeda-pro-mcp";`,
    `export const MCP_SERVER_VERSION = "${serverVersion}";`,
    `export const EXTENSION_VERSION = "${extensionVersion}";`,
    ""
  ].join("\n");
  fs.writeFileSync(versionTsPath, versionTs, "utf8");

  // 2. package.json
  const pkgPath = path.join(repoRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.version = serverVersion;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

  // 3. package-lock.json
  const lockPath = path.join(repoRoot, "package-lock.json");
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    lock.version = serverVersion;
    if (lock.packages && lock.packages[""]) {
      lock.packages[""].version = serverVersion;
    }
    fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  }

  // 4. server.json
  const serverJsonPath = path.join(repoRoot, "server.json");
  if (fs.existsSync(serverJsonPath)) {
    const registry = JSON.parse(fs.readFileSync(serverJsonPath, "utf8"));
    registry.version = serverVersion;
    if (Array.isArray(registry.packages)) {
      for (const item of registry.packages) {
        item.version = serverVersion;
      }
    }
    fs.writeFileSync(serverJsonPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  }

  // 5. extension/extension.json
  const extManifestPath = path.join(repoRoot, "extension", "extension.json");
  if (fs.existsSync(extManifestPath)) {
    const extManifest = JSON.parse(fs.readFileSync(extManifestPath, "utf8"));
    extManifest.version = extensionVersion;
    fs.writeFileSync(extManifestPath, `${JSON.stringify(extManifest, null, 2)}\n`, "utf8");
  }

  // 6. docs/changelog.md
  const changelogPath = path.join(repoRoot, "docs", "changelog.md");
  if (fs.existsSync(changelogPath)) {
    const currentChangelog = fs.readFileSync(changelogPath, "utf8");
    const updatedChangelog = prependChangelogSection(currentChangelog, {
      serverVersion,
      extensionVersion,
      subjects: commitSubjects
    });
    fs.writeFileSync(changelogPath, updatedChangelog, "utf8");
  }
}

function runGit(repoRoot, args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function gitTagExists(repoRoot, tagName) {
  try {
    execFileSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tagName}`], {
      cwd: repoRoot,
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}

export function getLatestStableTag(repoRoot) {
  try {
    const rawTags = runGit(repoRoot, ["tag", "-l", "--sort=-v:refname", "v*"]);
    const tags = rawTags
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    for (const tag of tags) {
      const v = tag.startsWith("v") ? tag.slice(1) : tag;
      try {
        const parsed = parseSemver(v);
        if (!parsed.prerelease) {
          return tag;
        }
      } catch {
        // ignore non-semver tag
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function getNextPrereleaseVersion(repoRoot, baseVersion, prereleaseTag = "beta") {
  const prefix = `v${baseVersion}-${prereleaseTag}.`;
  let highestNum = -1;
  try {
    const rawTags = runGit(repoRoot, ["tag", "-l", `${prefix}*`]);
    const lines = rawTags
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (const tag of lines) {
      const numStr = tag.slice(prefix.length);
      const num = parseInt(numStr, 10);
      if (!Number.isNaN(num) && num > highestNum) {
        highestNum = num;
      }
    }
  } catch {
    // ignore git error
  }

  if (highestNum === -1) {
    if (gitTagExists(repoRoot, `v${baseVersion}-${prereleaseTag}`)) {
      highestNum = 0;
    }
  }

  const nextNum = highestNum + 1;
  return `${baseVersion}-${prereleaseTag}.${nextNum}`;
}

export function resolveAndPrepareRelease(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const requestedBump = options.requestedBump || "auto";
  const channel = options.channel || "stable";
  const prereleaseTag = options.prereleaseTag || (channel !== "stable" ? channel : "beta");
  const isPrerelease = channel !== "stable";

  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const extManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "extension", "extension.json"), "utf8"));

  const currentServerVersion = pkg.version;
  const currentExtensionVersion = extManifest.version;
  const currentTag = `v${currentServerVersion}`;
  const parsedServer = parseSemver(currentServerVersion);
  const parsedExt = parseSemver(currentExtensionVersion);

  // Case 0: Graduation from prerelease on stable channel
  // e.g. pkg.version is 1.5.0-beta.2, and we are releasing on master (channel === "stable")
  if (!isPrerelease && parsedServer.prerelease) {
    const graduatedServerVersion = `${parsedServer.major}.${parsedServer.minor}.${parsedServer.patch}`;
    const graduatedExtensionVersion = `${parsedExt.major}.${parsedExt.minor}.${parsedExt.patch}`;
    const targetTag = `v${graduatedServerVersion}`;

    if (!gitTagExists(repoRoot, targetTag)) {
      const lastStableTag = getLatestStableTag(repoRoot);
      const diffBase = lastStableTag && gitTagExists(repoRoot, lastStableTag) ? lastStableTag : currentTag;
      const rawLog = runGit(repoRoot, ["log", `${diffBase}..HEAD`, "--format=%s%x1f%b%x1e"]);
      const commits = rawLog
        .split("\x1e")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [subject = "", body = ""] = entry.split("\x1f");
          return { subject: subject.trim(), body: body.trim() };
        });

      applyVersionFiles(repoRoot, {
        serverVersion: graduatedServerVersion,
        extensionVersion: graduatedExtensionVersion,
        commitSubjects: commits.map((c) => c.subject)
      });

      return {
        skip: false,
        bumped: true,
        bumpLevel: "graduate",
        channel: "stable",
        isPrerelease: false,
        serverVersion: graduatedServerVersion,
        extensionVersion: graduatedExtensionVersion,
        tag: targetTag
      };
    }
  }

  // Case A: package.json already holds an untagged version (e.g. manually bumped on develop)
  if (!gitTagExists(repoRoot, currentTag)) {
    return {
      skip: false,
      bumped: false,
      bumpLevel: "prebumped",
      channel,
      isPrerelease,
      serverVersion: currentServerVersion,
      extensionVersion: currentExtensionVersion,
      tag: currentTag
    };
  }

  // Case B: currentTag already exists -> inspect commits since currentTag
  const rawLog = runGit(repoRoot, ["log", `${currentTag}..HEAD`, "--format=%s%x1f%b%x1e"]);
  const commits = rawLog
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [subject = "", body = ""] = entry.split("\x1f");
      return { subject: subject.trim(), body: body.trim() };
    });

  if (commits.length === 0 && requestedBump === "auto") {
    return {
      skip: true,
      bumped: false,
      bumpLevel: "none",
      channel,
      isPrerelease,
      serverVersion: currentServerVersion,
      extensionVersion: currentExtensionVersion,
      tag: currentTag,
      reason: `No new commits since ${currentTag}.`
    };
  }

  if (requestedBump === "none") {
    return {
      skip: true,
      bumped: false,
      bumpLevel: "none",
      channel,
      isPrerelease,
      serverVersion: currentServerVersion,
      extensionVersion: currentExtensionVersion,
      tag: currentTag,
      reason: "Bump skipped via requestedBump=none."
    };
  }

  const changedFilesRaw = runGit(repoRoot, ["diff", "--name-only", `${currentTag}..HEAD`]);
  const changedFiles = changedFilesRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (
    requestedBump === "auto" &&
    changedFiles.length > 0 &&
    changedFiles.every((filePath) => filePath.startsWith(".github/") || filePath.startsWith("scripts/bump-version"))
  ) {
    return {
      skip: true,
      bumped: false,
      bumpLevel: "none",
      channel,
      isPrerelease,
      serverVersion: currentServerVersion,
      extensionVersion: currentExtensionVersion,
      tag: currentTag,
      reason: `Only CI/release automation files changed since ${currentTag}.`
    };
  }

  const bumpLevel = detectBumpLevel(commits, requestedBump);

  let nextServerVersion;
  if (isPrerelease) {
    if (parsedServer.prerelease && bumpLevel !== "major") {
      const baseVersion = `${parsedServer.major}.${parsedServer.minor}.${parsedServer.patch}`;
      nextServerVersion = getNextPrereleaseVersion(repoRoot, baseVersion, prereleaseTag);
    } else {
      const currentBase = `${parsedServer.major}.${parsedServer.minor}.${parsedServer.patch}`;
      const nextBase = incSemver(currentBase, bumpLevel, { channel: "stable" });
      nextServerVersion = getNextPrereleaseVersion(repoRoot, nextBase, prereleaseTag);
    }
  } else {
    const currentBase = `${parsedServer.major}.${parsedServer.minor}.${parsedServer.patch}`;
    nextServerVersion = incSemver(currentBase, bumpLevel, { channel: "stable" });
  }

  // Bump extension version only if extension/ changed since currentTag and wasn't manually bumped yet
  let prevExtensionVersion = currentExtensionVersion;
  try {
    const prevExtRaw = runGit(repoRoot, ["show", `${currentTag}:extension/extension.json`]);
    prevExtensionVersion = JSON.parse(prevExtRaw).version;
  } catch {
    // Ignore if extension.json didn't exist at currentTag
  }

  const changedExtFiles = runGit(repoRoot, ["diff", "--name-only", `${currentTag}..HEAD`, "--", "extension/"]);
  const extensionChanged = changedExtFiles.length > 0;

  let nextExtensionVersion = currentExtensionVersion;
  if (extensionChanged && currentExtensionVersion === prevExtensionVersion) {
    const extBumpLevel = bumpLevel === "major" ? "minor" : bumpLevel;
    const currentExtBase = `${parsedExt.major}.${parsedExt.minor}.${parsedExt.patch}`;
    const nextExtBase = incSemver(currentExtBase, extBumpLevel, { channel: "stable" });
    if (isPrerelease) {
      nextExtensionVersion = getNextPrereleaseVersion(repoRoot, nextExtBase, prereleaseTag);
    } else {
      nextExtensionVersion = nextExtBase;
    }
  } else if (isPrerelease && extensionChanged && parsedExt.prerelease) {
    const currentExtBase = `${parsedExt.major}.${parsedExt.minor}.${parsedExt.patch}`;
    nextExtensionVersion = getNextPrereleaseVersion(repoRoot, currentExtBase, prereleaseTag);
  }

  applyVersionFiles(repoRoot, {
    serverVersion: nextServerVersion,
    extensionVersion: nextExtensionVersion,
    commitSubjects: commits.map((c) => c.subject)
  });

  return {
    skip: false,
    bumped: true,
    bumpLevel,
    channel,
    isPrerelease,
    serverVersion: nextServerVersion,
    extensionVersion: nextExtensionVersion,
    tag: `v${nextServerVersion}`
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let requestedBump = "auto";
  let channel = "stable";
  let githubOutputPath = process.env.GITHUB_OUTPUT;
  let checkPrTitle = null;
  let baseRef = "develop";

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--bump" && args[i + 1]) {
      requestedBump = args[++i];
    } else if (args[i] === "--channel" && args[i + 1]) {
      channel = args[++i];
    } else if (args[i] === "--github-output" && args[i + 1]) {
      githubOutputPath = args[++i];
    } else if (args[i] === "--check-pr-title" && args[i + 1] !== undefined) {
      checkPrTitle = args[++i];
    } else if (args[i] === "--base-ref" && args[i + 1]) {
      baseRef = args[++i];
    }
  }

  if (checkPrTitle !== null) {
    const check = validatePrTitle(checkPrTitle, baseRef);
    if (!check.valid) {
      console.error(check.error);
      process.exit(1);
    }
    console.log(`PR title valid ("${checkPrTitle.trim()}") -> SemVer impact: ${check.bumpLevel}`);
    process.exit(0);
  }

  const result = resolveAndPrepareRelease({ requestedBump, channel });
  console.log(JSON.stringify(result, null, 2));

  if (githubOutputPath) {
    const lines = [
      `skip=${result.skip}`,
      `bumped=${result.bumped}`,
      `bump_level=${result.bumpLevel}`,
      `channel=${result.channel || "stable"}`,
      `is_prerelease=${result.isPrerelease ? "true" : "false"}`,
      `server_version=${result.serverVersion}`,
      `extension_version=${result.extensionVersion}`,
      `tag=${result.tag}`
    ];
    fs.appendFileSync(githubOutputPath, `${lines.join("\n")}\n`, "utf8");
  }
}
