# Pull Request Guide

This document defines how pull requests should be prepared, reviewed, and merged in `easyeda_mcp`.

The goal is to keep contributions easy to review, easy to test, and easy to ship without turning the workflow into bureaucracy.

## Principles

Good pull requests in this repository should be:

1. small
2. focused
3. easy to test
4. clear about user impact
5. easy to merge without release pressure

## Preferred PR Size

Prefer pull requests that can be reviewed in roughly 10 to 15 minutes.

That usually means:

- one feature
- one fix
- one docs improvement set
- one release-preparation change

If the work is large, break it into a sequence of PRs.

Example sequence:

1. base refactor
2. feature implementation
3. docs and examples
4. release notes or packaging updates

## PR Types

Use one of these title prefixes:

- `feature:`
- `fix:`
- `docs:`
- `chore:`

Examples:

- `feature: add board export helper`
- `fix: prevent bridge reconnect loop`
- `docs: improve quick start for new users`
- `chore: clean up extension packaging script`

## What A Good PR Should Contain

Every PR should explain:

1. what changed
2. why the change is needed
3. how to validate it
4. whether it affects releases, setup, or compatibility

When relevant, also include:

- related issue
- milestone
- screenshots or terminal output for docs or UX changes

## How To Break Work Into Multiple PRs

Split work when:

1. one part can land safely before another
2. the diff becomes difficult to review
3. docs and code are unrelated
4. release work should be separated from feature work

Do not wait for a large bundle if smaller safe increments can land first.

## Review Expectations

Reviewers should be able to answer these quickly:

1. What problem does this solve?
2. Is the scope correct?
3. Is the change safe?
4. How do I test it?
5. Should this affect the next release?

## Merge Expectations

By default, merge when:

1. the PR scope is clear
2. required review is complete
3. CI is green when CI applies
4. documentation is updated when needed
5. there are no unresolved release or compatibility concerns

## Releases And PRs

Do not create a formal release for every merged PR.

Most PRs should:

1. merge into `main`
2. accumulate toward a milestone
3. ship in a later tagged release

Create a release only when the project reaches a meaningful checkpoint such as:

- new user-facing MCP capabilities
- packaging updates for the extension artifact
- compatibility changes
- important upgrade-worthy fixes

## Milestones

Milestones are recommended for this repository.

Use milestones to group issues and PRs by:

1. version
2. release theme
3. short-term initiative

Good milestone examples:

- `v0.1.1`
- `v0.2.0`
- `Docs & Distribution`
- `Beta Stability`

Use milestones when:

- a PR clearly belongs to an upcoming release
- several related PRs are part of the same goal
- you want visibility into what is still missing before a release

## Projects

GitHub Projects are optional.

Use Issues, Labels, and Milestones first.

Adopt Projects only when:

1. several contributors are working in parallel
2. there are enough open PRs and issues that progress becomes hard to track
3. release planning needs board-style coordination

Until then, Projects are not required.

## Recommended Labels

Recommended starting labels:

- `feature`
- `bug`
- `docs`
- `marketing`
- `release`
- `good first issue`
- `help wanted`

## Default Flow

The normal pull request flow should be:

1. open or identify the issue or motivation
2. create a short-lived branch from `main`
3. implement one focused change
4. open a PR with a clear title and test steps
5. assign a milestone when relevant
6. review and merge
7. release later only if the work belongs to a meaningful milestone

## Summary

The recommended PR strategy for this repository is:

- small PRs
- focused scope
- clear test steps
- milestones for visibility
- projects only when scale demands them
- releases only at meaningful checkpoints
