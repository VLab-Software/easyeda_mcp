# Git Workflow

`easyeda_mcp` uses an automated **`develop` -> `master` release pipeline**: day-to-day pull requests merge into `develop` (CI-only), and merging `develop` into `master` automatically bumps versions, creates the Git tag, publishes the GitHub Release, updates npm & the Official MCP Registry, and deploys the documentation site.

## Branches

| Branch | Role | Automated Workflows |
| --- | --- | --- |
| **`develop`** | Integration branch for day-to-day features, fixes, and docs. Never publishes a release. | `CI` (PR & push validation) |
| **`master`** | Production release branch. Every merge to `master` automatically cuts and publishes a new release. | `CI`, `Release` (auto-bump, tag, GitHub Release, npm, MCP Registry), `Deploy Docs` |
| **`feature/*`, `fix/*`, `docs/*`, `chore/*`** | Short-lived working branches created from `develop`. | `CI` (on Pull Request) |

## Day-to-Day Development Flow (`-> develop`)

1. Branch from `develop`:
   ```bash
   git checkout develop && git pull origin develop
   git checkout -b feature/<short-name>
   ```
2. Implement changes, tests, and documentation updates *(do not bump version numbers in feature PRs)*.
3. Use conventional prefixes in commit/PR titles so automated SemVer calculation picks the right bump level:
   - `feature: ...` / `feat: ...` -> **`minor`** bump (`1.2.0` -> `1.3.0`)
   - `fix: ...` / `docs: ...` / `chore: ...` -> **`patch`** bump (`1.2.0` -> `1.2.1`)
   - `feature!: ...` or `BREAKING CHANGE:` in commit body -> **`major`** bump (`1.2.0` -> `2.0.0`)
4. Validate locally (`npm run setup:local`, `npm test`, `npm run typecheck`, `npm run typecheck:extension`, `npm run docs:build`).
5. Open a pull request against **`develop`** and merge once `CI` is green.

## Automated Release Flow (`develop -> master`)

When `develop` is ready to ship:

1. Open a pull request from **`develop` -> `master`** on GitHub and merge it using **Create a merge commit** (not Squash) once `CI` passes so `develop` and `master` keep a shared commit history.
2. **Everything else runs automatically in GitHub Actions (`release.yml` + `deploy-docs.yml`)**:
   - Calculates the next SemVer version via `scripts/bump-version.mjs` (updating `src/version.ts`, `package.json`, `package-lock.json`, `server.json`, `docs/changelog.md`, and `extension/extension.json` if files under `extension/` changed — or uses an already-bumped untagged version directly).
   - Validates typechecks, unit tests, VitePress docs, `.eext`/`.mcpb` packaging, and the DRC stdio + WebSocket smoke test.
   - Commits `chore(release): vX.Y.Z`, creates and pushes tag `vX.Y.Z`, and merges `master` back into `develop` so `develop` stays synchronized.
   - Publishes the **GitHub Release** (`*.eext`, `*.mcpb`, `SHA256SUMS.txt`), **npm** (`@vlabsoft/easyeda-pro-mcp`), the **Official MCP Registry**, and **GitHub Pages** (`vlabsoft.org/easyeda_mcp/`).
