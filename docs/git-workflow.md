# Git Workflow

`easyeda_mcp` uses a lightweight **GitHub Flow** with tagged releases.

## Branches

- **`master`**: primary branch and public source of truth. Must always stay buildable and passing CI.
- **Short-lived working branches**: branch from `master` using:
  - `feature/<short-name>`
  - `fix/<short-name>`
  - `docs/<short-name>`
  - `chore/<short-name>`

## Day-to-Day Flow

1. Create a focused branch from `master`.
2. Implement changes, tests, and documentation updates.
3. Validate locally (`npm run setup:local`, `npm test`, `npm run typecheck`, `npm run typecheck:extension`, `npm run docs:build`).
4. Open a pull request against `master` following [Pull Request Guide](./pull-requests.md).
5. Merge once review and CI pass (`Deploy Docs` updates GitHub Pages automatically on pushes to `master`).

## Releases

Do not cut a release for every merged PR. When shipping a new user-facing capability, `.eext` extension update, or important fix:

1. Update versions in `src/version.ts`, `package.json`, `package-lock.json`, `server.json`, and `extension/extension.json` (verified by `src/version.test.ts`), plus `docs/changelog.md`.
2. Merge to `master`.
3. Tag and push (`git tag v1.x.y && git push origin v1.x.y`) — `.github/workflows/release.yml` automatically validates, packages `.eext` + `SHA256SUMS.txt`, and publishes the GitHub Release.
