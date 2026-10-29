# Pre-PR validation — issue #14

Checked 2026-10-29 on `feature/issue-14-drc-rules`, based on public `main` (`dcf6704`). This record describes this branch, not earlier experimental branches.

## Decision and scope

**Local pre-PR checks passed.** The change can be reviewed as experimental. Native rule writes in the international EasyEDA editor remain unverified, so this is not a production-release or editor-compatibility certification. A draft/experimental PR should retain that gap explicitly.

Development identities: MCP server **1.1.0-rc.1**, extension **0.2.0-rc.1**, bridge protocol **0.1.0**, **24 MCP tools**. No release, GitHub PR, remote CI run or Pages deployment was performed by these local checks.

## Executed checks

| Check | Actual result |
| --- | --- |
| Clean dependency install | `npm ci` passed on Node 22.23.3 |
| Server and extension types | Passed on Node 22.23.3 and Node 20.20.2 |
| Automated tests | **78 tests / 11 files passed** on both Node versions |
| Server build / browser bundle / `.eext` | Passed; archive inspected |
| MCP integration smoke | Passed on Node 20 and 22 with real stdio/WebSocket and simulated editor APIs |
| Installed npm tarball | Temporary production-only install passed the same smoke; temporary files removed |
| Installed command | `easyeda-pro-mcp` executable after npm installation; handshake and 24-tool catalog passed |
| Version consistency | Package, lockfile, registry metadata, server handshake/doctor and extension manifest/bundle agree |
| Package contents | All 14 npm files equal current files; `.eext` has only README, manifest and browser bundle; alias bytes match |
| Documentation | VitePress build passed; local HTTP smoke returned 200 and expected rendered content for home, roadmap, DRC guide, extension setup and tools |
| Workflow files | YAML parsed; Pages push trigger targets `main`; generated release notes use the actual manifest filename |
| Git whitespace | `git diff --check` passed |

The DRC smoke checks native JSON reads, preparation without writes, exact confirmation, timeout reported as uncertain, result queries while running/after completion, duplicate rejection and diagnostics on stderr. Unit tests additionally cover stale rules/identity/session, method availability, supported document types, opaque JSON validation, oversized/deep data, whole-table replacements and readback failure. These are simulated/editor-independent proofs.

## Security review

The inherited lockfile initially reported 9 production and 20 total advisories. Compatible dependency refreshes and a deliberate update to Zod 4 (the code already imported `zod/v4`) were validated with the full suite. Current direct runtime dependencies are MCP SDK 1.32.2, WebSocket 8.22.0 and Zod 4.6.7.

- `npm audit --omit=dev`: **0 advisories**.
- Full audit: **6 development advisories** — 3 moderate, 1 high, 2 critical — associated with Vitest/mocker/tinypool and Vite/VitePress/esbuild.
- No forced major development-tool migration was applied. Those advisories remain maintenance work, not a claim of a clean full audit. The production-only installed tarball was tested separately.

## Documentation and distribution corrections

The README now summarizes the [single detailed roadmap](./evolution-plan.md), distinguishing available, in-development and proposed work. Pages navigation links the roadmap and [DRC guide](./drc-rules.md). The landing page no longer promises that all MCP/AI processing stays on the machine or that every beta method works on every editor version.

The default branch is `main`; Pages now builds on pushes to that branch after merge. CI checks extension types and the simulated smoke. Release notes derive the `.eext` filename from its manifest instead of hard-coding 0.1.0. Syntax/local builds do not establish remote GitHub configuration or prove a deployment succeeded.

## Final artifacts

- `build/dist/easyeda-mcp-bridge_v0.2.0-rc.1.eext` — SHA-256 `3368d1202d18b6ee317605ad230563ff065641582403273970e3cb4d78b2e87c`.
- `build/dist/vlabsoft-easyeda-pro-mcp-1.1.0-rc.1.tgz` — SHA-256 `a8bd251c5ce0bd5cdc7028592f6540810c91a744c8403fef11073c80070e0a43`.

These are local development candidates, not published assets. Their checksums change if they are rebuilt.

## Real-editor read validation — 2026-10-29

The installed extension and direct RPC both reported **0.2.0-rc.1**, paired with server **1.1.0-rc.1**. With a real PCB active (document type 3), all five `easyeda_get_drc_rules` scopes returned successfully with the same project/document/tab identity:

| Scope | Observed native response |
| --- | --- |
| `current` | `{name, config}` object; configuration JSON returned |
| `configurations` | 6 named configuration records |
| `netRules` | 32 rule entries |
| `netByNetRules` | Object with `Creepage Distance` and `Safe Spacing` categories, both empty |
| `regionRules` | Empty array |

A second current-configuration read matched the first exactly. These are real read responses, with completeness still `api_returned`; empty tables do not establish that a board is electrically correct or that every source is complete. No rule write, native DRC execution or PCB save was requested in this validation. Application version was not independently captured by these tools, so this does not establish a version-compatibility matrix.

The full response data and identities remain only in the ignored local file `build/validation/issue-14/native-reads-2026-10-29-1856.json`; this public record omits the PCB's project name, IDs and rule values. The earlier failed dedicated-bridge attempt is historical; the connected MCP tools now provided the read validation above.

## Remaining acceptance work

- Matching extension import and direct RPC version checks passed in the read session above. Future rebuilds still require manual extension/client updates.
- Target identity, reported bridge versions and all required method capabilities were checked in that session; record the application version for compatibility claims.
- On a disposable PCB, review a concrete preview and obtain human approval before any rule write. Check native readback and session behavior once, without replaying uncertain writes.
- Keep named-profile persistence distinct from PCB saving. No PCB save or real-editor rule edit was performed here.
- Record real-editor compatibility separately; API documentation, available methods, mocks and actual editor behavior are different evidence levels.
- Run remote CI on the PR and verify Pages after merge. Neither was run locally on GitHub.

A live-validation attempt could not obtain a dedicated bridge on port 8765 because another configured MCP server was already listening. That process was preserved. This attempt is not a passed editor test.

Local logs and JSON reports are under `build/validation/issue-14/` (ignored by Git); they are not included in the npm or extension artifacts.
