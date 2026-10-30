# Git Workflow

`easyeda_mcp` uses a lightweight **`develop` -> `master` release workflow** so ongoing work never leaks unreleased documentation or requires a version bump on every pull request.

## Branches

| Branch | Role | Automated Workflows |
| --- | --- | --- |
| **`master`** | Production branch & public source of truth. Always matches the latest published release. | `CI`, `Deploy Docs` (GitHub Pages) |
| **`develop`** | Integration branch for upcoming features, fixes, and refactors before cutting a release. | `CI` |
| **`feature/*`, `fix/*`, `docs/*`, `chore/*`** | Short-lived working branches created from `develop` (or from `master` for urgent production hotfixes). | `CI` (on Pull Request) |

## Day-to-Day Development Flow

1. Create a focused branch from `develop`:
   ```bash
   git checkout develop && git pull origin develop
   git checkout -b feature/<short-name>
   ```
2. Implement changes, tests, and documentation updates *(no version bump needed for individual feature PRs)*.
3. Validate locally (`npm run setup:local`, `npm test`, `npm run typecheck`, `npm run typecheck:extension`, `npm run docs:build`).
4. Open a pull request against **`develop`** following [Pull Request Guide](./pull-requests.md) and merge once `CI` passes.

## Cutting a Release (`develop` -> `master`)

When `develop` is ready to ship a new version to users:

1. **Bump versions & changelog**: update `src/version.ts`, `package.json`, `package-lock.json`, `server.json`, and `extension/extension.json` (when the `.eext` extension changed — verified by `src/version.test.ts`), plus `docs/changelog.md` and `docs/upgrading.md`.
2. **Promote to `master`**: open a release pull request from **`develop` -> `master`** and merge once `CI` passes (`Deploy Docs` updates `vlabsoft.org/easyeda_mcp/` automatically).
3. **Tag & publish**:
   ```bash
   git checkout master && git pull origin master
   git tag v1.x.y
   git push origin v1.x.y
   ```
   Pushing `v*` triggers `.github/workflows/release.yml`, which automatically validates, packages `.eext` + `.mcpb` + `SHA256SUMS.txt`, creates the GitHub Release, and publishes to **npm** and the **Official MCP Registry**.
