# Git Workflow

This document defines the recommended Git workflow for `easyeda_mcp`.

The goal is to keep the repository easy to contribute to, stable for public discovery, and simple to distribute without creating a formal release for every small change.

## Recommended Model

This project should follow a lightweight workflow based on:

1. GitHub Flow
2. Common-Flow

In practice, that means:

- `main` is the primary branch
- work happens on short-lived branches
- all changes go through pull requests
- releases are created only when there is a meaningful product milestone
- release branches are optional, not mandatory

## Why This Model Fits This Project

`easyeda_mcp` is an open-source project with:

- code changes
- documentation changes
- onboarding improvements
- packaging and release artifacts
- a public GitHub presence used for discovery

A heavy Gitflow model with permanent `develop` and frequent `release/*` branching adds process overhead that is not necessary right now.

This workflow keeps the project simple while still supporting:

- external contributions
- safe reviews
- stable distribution
- occasional prereleases and formal releases

## Branch Roles

### `main`

`main` is the public source of truth.

Rules:

- must stay healthy and reviewable
- should always be safe to clone and evaluate
- should contain the latest approved work
- can include unreleased improvements in docs and setup guidance

`main` is not the same thing as a formal release.

## Working Branches

Create a short-lived branch from `main` for each task.

Suggested naming:

- `feature/<short-name>`
- `fix/<short-name>`
- `docs/<short-name>`
- `chore/<short-name>`

Examples:

- `feature/add-pcb-export-helper`
- `fix/bridge-timeout-handling`
- `docs/improve-quick-start`
- `chore/cleanup-build-script`

## Pull Requests

Every change should land through a pull request.

Pull request guidelines:

1. keep the scope focused
2. use a clear title
3. explain user-facing impact
4. mention setup, compatibility, or release implications when relevant
5. avoid mixing unrelated code and docs changes unless they belong to the same feature

Recommended PR title patterns:

- `feature: add schematic navigation helper`
- `fix: handle disconnected bridge state correctly`
- `docs: improve quick start for first-time users`
- `chore: simplify extension packaging script`

See [Pull Request Guide](./pull-requests.md) for the detailed PR strategy used by this repository.

## Milestones

Milestones are recommended.

Use them to group related issues and pull requests by:

1. version
2. release goal
3. short-term initiative

Suggested examples:

- `v0.1.1`
- `v0.2.0`
- `Docs & Distribution`
- `Beta Stability`

Milestones give visibility without forcing a formal release for every merged change.

## Projects

GitHub Projects are optional.

Prefer starting with:

1. labels
2. issues
3. milestones

Move to Projects only when contribution volume grows enough that board-style tracking becomes necessary.

## Release Strategy

Do not create a release for every merge to `main`.

Create a formal GitHub release only when there is a meaningful milestone, such as:

1. a new `.eext` package intended for users
2. a new MCP capability worth announcing
3. a compatibility change affecting setup or clients
4. a bug fix important enough for users to upgrade immediately
5. a checkpoint version you want directories and communities to reference

## Tags

Use version tags for formal releases.

Examples:

- `v0.1.0`
- `v0.1.1`
- `v0.2.0`

## Optional Release Branches

Release branches are optional.

Only create a release branch when:

1. the release needs final verification or polishing
2. documentation and packaging work must continue while new development also moves forward
3. you need a temporary freeze before publishing a version

Suggested naming:

- `release/0.2.0`

If a release branch is used:

1. branch from `main`
2. allow only release-focused fixes and docs adjustments
3. merge back to `main` when finalized
4. tag the release on `main`
5. delete the release branch after completion

## Hotfixes

Critical fixes should branch directly from `main`.

Suggested naming:

- `hotfix/<short-name>`

Examples:

- `hotfix/fix-extension-package`
- `hotfix/restore-bridge-compatibility`

After review and merge:

1. tag a patch release if needed
2. update docs or release notes if user behavior changed

## Practical Day-To-Day Flow

The default flow for most work should be:

1. branch from `main`
2. implement one focused change
3. open a pull request
4. review and merge into `main`
5. release later only if the change is part of a meaningful milestone

## What We Are Avoiding

This project intentionally avoids a heavy permanent Gitflow setup with:

- always-on `develop`
- mandatory `release/*` branches
- frequent merge choreography between long-lived branches

That model is useful for larger teams with strict staged release cycles, but it is unnecessary overhead for the current needs of this repository.

## Recommended Team Rules

1. Keep branches short-lived.
2. Keep PRs small and easy to review.
3. Keep `main` healthy and presentable.
4. Tag releases only for meaningful milestones.
5. Use release branches only when they clearly reduce risk.
6. Prefer clarity and consistency over ceremony.

## Summary

The recommended pattern for this repository is:

- GitHub Flow for daily work
- Common-Flow style tagged releases
- optional release branches when needed

This gives the project a stable public base, supports open-source collaboration, and avoids unnecessary release churn.
