# Pull Request Guide

Keep pull requests focused, easy to review, and easy to validate.

## Title Format

Commit and PR titles drive automated SemVer bumping when promoted to `master` (and are validated automatically by `CI` on every pull request):

- `feature: <description>` *(triggers a `minor` bump on release: `1.2.0` -> `1.3.0`)*
- `fix: <description>` *(triggers a `patch` bump on release: `1.2.0` -> `1.2.1`)*
- `docs: <description>` *(triggers a `patch` bump on release: `1.2.0` -> `1.2.1`)*
- `chore: <description>` *(triggers a `patch` bump on release: `1.2.0` -> `1.2.1`)*
- `feature!: <description>` *(triggers a `major` bump on release: `1.2.0` -> `2.0.0`)*

## Target Branch

- **Day-to-day changes (`feature/*`, `fix/*`, `docs/*`, `chore/*`)**: open PRs against **`develop`**. `CI` validates every PR without cutting a release, and you do not need to bump versions manually.
- **Releases (`develop` -> `master`)**: open a PR from **`develop` -> `master`**. Merging into `master` automatically triggers `Release` (version bump, Git tag, GitHub Release assets, npm, Official MCP Registry, and `develop` sync) followed by `Deploy Docs`.

## PR Description

Follow `.github/PULL_REQUEST_TEMPLATE.md`:

1. **Summary**: what changed, why, and the linked issue (`Closes #...`).
2. **Changes**: bullet points of the main updates.
3. **Validation**: local checks executed before opening the PR.

## Workflow

1. Create a short-lived branch from `develop` (`feature/...`, `fix/...`, `docs/...`, `chore/...`).
2. Implement the change, tests, and documentation updates.
3. Run local validation (`npm test`, `npm run typecheck`, `npm run typecheck:extension`, `npm run docs:build`).
4. Open a PR against `develop` and wait for `CI` to pass before merging.
5. When ready to publish a release, open and merge a PR from `develop` -> `master`.
