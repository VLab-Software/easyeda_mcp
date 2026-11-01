## Summary

<!-- Briefly describe what changed and why. -->

Closes #

## Changes

- 

## PR & SemVer Checklist

- [ ] **Target branch**: `develop` for day-to-day PRs (`codex/*`, `feature/*`, `fix/*`, `docs/*`, `chore/*`), or `master` when promoting a release (`develop -> master`)
- [ ] **PR title prefix** matches the SemVer bump when promoted to `master`:
  - `feature: <summary>` *(bumps **minor** / middle number: `1.2.0` -> `1.3.0`)*
  - `fix: <summary>` / `docs: <summary>` / `chore: <summary>` *(bumps **patch** / last number: `1.2.0` -> `1.2.1`)*
  - `feature!: <summary>` *(bumps **major** / first number: `1.2.0` -> `2.0.0` — breaking change)*

## Validation

- [ ] `npm test`
- [ ] `npm run typecheck && npm run typecheck:extension`
- [ ] `npm run setup:local` (if server or extension changed)
- [ ] `npm run docs:build` (if docs changed)

## Evolution delivery (when applicable)

- Roadmap part and specification/ADR:
- Compatibility and acceptance criteria:
- Known limitations and deferred behavior changes:
- [ ] This PR contains one part; the previous part is integrated into `develop` (0A preserves `ff4219d`).
- [ ] Validation distinguishes local simulation from real-editor execution.
- [ ] User review is complete before integration and the next part.
