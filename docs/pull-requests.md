# Pull Request Guide

Keep pull requests focused, easy to review, and easy to validate.

## Title Format

Use a short prefix:

- `feature: <description>`
- `fix: <description>`
- `docs: <description>`
- `chore: <description>`

## PR Description

Follow `.github/PULL_REQUEST_TEMPLATE.md`:

1. **Summary**: what changed, why, and the linked issue (`Closes #...`).
2. **Changes**: bullet points of the main updates.
3. **Validation**: local checks executed before opening the PR.

## Workflow

1. Create a short-lived branch from `master` (`feature/...`, `fix/...`, `docs/...`, `chore/...`).
2. Implement the change, tests, and documentation updates.
3. Run local validation (`npm test`, `npm run typecheck`, `npm run typecheck:extension`, `npm run docs:build`).
4. Open a PR against `master` and wait for CI to pass before merging.
5. Tag a release (`v*`) on `master` only when publishing a new version or `.eext` package.
