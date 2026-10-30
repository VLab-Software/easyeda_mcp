# Pull Request Guide

Keep pull requests focused, easy to review, and easy to validate.

## Title Format

Use a short prefix:

- `feature: <description>`
- `fix: <description>`
- `docs: <description>`
- `chore: <description>`
- `release: v<version>` *(for `develop` -> `master` release promotion PRs)*

## Target Branch

- **Day-to-day changes (`feature/*`, `fix/*`, `docs/*`, `chore/*`)**: open PRs against **`develop`**. Do not bump package versions on every feature PR.
- **Releases (`develop` -> `master`)**: once features are validated on `develop` and versions/changelog are updated, open a release PR against **`master`**.
- **Hotfixes**: urgent fixes to the live release or live docs may target `master` directly (and should then be merged back into `develop`).

## PR Description

Follow `.github/PULL_REQUEST_TEMPLATE.md`:

1. **Summary**: what changed, why, and the linked issue (`Closes #...`).
2. **Changes**: bullet points of the main updates.
3. **Validation**: local checks executed before opening the PR.

## Workflow

1. Create a short-lived branch from `develop` (`feature/...`, `fix/...`, `docs/...`, `chore/...`).
2. Implement the change, tests, and documentation updates.
3. Run local validation (`npm test`, `npm run typecheck`, `npm run typecheck:extension`, `npm run docs:build`).
4. Open a PR against `develop` and wait for CI to pass before merging.
5. When cutting a release, promote `develop` -> `master` via PR and tag `v*` on `master`.
