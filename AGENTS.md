# Working on EasyEDA Pro MCP

## Delivery workflow

- Read the existing source, tests, and [Git workflow](docs/git-workflow.md) before changing the project. Keep delivery planning in the chat/PR; do not add evolution roadmaps, phase announcements, or planning documents to the published docs.
- Work on one agreed task at a time. Create `feature/<short-name>` before editing; use the project branch prefixes (`feature/`, `fix/`, `docs/`, `chore/`), never the agent name; open a PR against `develop`, then wait for user review and integration before starting the next part. Never merge to `master` as routine integration: it triggers publication.
- Start subsequent tasks from updated `develop` after the previous PR is integrated. Preserve the foundation commit `ff4219d` in this delivery.
- Preserve existing work and branches. If parallel work is explicitly requested, give each worker its own worktree and absolute working directory; never switch branches in a shared checkout.
- Keep refactors, new features, and SDK/dependency migrations in separate PRs. Do not bump release versions in ordinary PRs.

## Architecture and compatibility

- Keep npm, TypeScript/ESM, the existing package, CLI, stdio transport, and `.eext`/`.mcpb` distribution. Do not introduce workspace migrations or hypothetical backend abstractions during behavior-preserving refactors.
- Preserve existing tool names, input defaults, annotations, RPC methods and aliases, response envelopes, errors, and extension manifest exports during refactoring. Record behavior fixes separately with regression tests.
- Target dependency direction: MCP tools -> shared contracts/editor interface; WebSocket bridge implements that interface; extension handlers -> injected EasyEDA API adapter + browser-safe contracts/domain; pure domain -> no editor, MCP, WebSocket, or Node runtime imports.
- This dependency direction is a target, not a claim that all extractions and automated dependency checks are already implemented.
- Keep entry points small and implementation details private. Prefer explicit dependencies and small interfaces; avoid blanket re-exports, dependency injection containers, and one-line wrappers without a useful responsibility.
- Treat untrusted API data as `unknown` until narrowed. Keep compatibility handling at the editor boundary; do not spread new `any` or unsafe casts into domain code.
- Diagnostic logging in the server must go to stderr. Never write logs to MCP stdout.

## Specifications and editor operations

- Use `specs/SPEC_TEMPLATE.md` for new tools or changed public behavior. Refactors may use a compatibility/acceptance checklist in the PR instead of one spec per unchanged tool.
- Before implementing a capability, document native methods and verified availability, input/output contracts, side effects, failure modes, and acceptance criteria. Proposed tool names are not proof of editor API support.
- For new mutation flows: prepare a bounded preview, bind it to exact document/page identity and state, obtain approval for the exact operation, apply once, read back, and save separately. Do not promise automatic rollback or automatically replay an uncertain mutation.
- Preserve existing DRC confirmation, stale-state, connection-generation, expiry, and readback guards. Legacy confirmed actions do not yet provide equivalent guarantees; do not describe them as if they do.
- Preserve `confidence`, `warnings`, provenance, and `unknown` results. Geometric connectivity checks are not native ERC, DRC, or simulation. Missing/partial data is not a passing circuit.
- Use disposable documents for write validation. Verify the connected extension identity/capabilities before a real editor test; rebuilding a bundle does not reload the installed extension.
- Keep private circuit identifiers, screenshots, secrets, and local evidence out of public docs; store private validation artifacts under ignored `build/` paths.

## Validation and completion

- Run `npm test`, `npm run typecheck`, and `npm run typecheck:extension` for every part. Run `npm run docs:build` for documentation changes.
- For runtime/build/package changes also run `npm run package:all` and `npm run test:smoke:drc`. Use isolated test ports; do not terminate an existing user bridge to run tests.
- Add meaningful regression tests for changed behavior and tests at extracted module interfaces when needed; avoid tests that merely mirror implementation.
- Report separately: proposed, implemented, validated in simulation, and validated in the editor. Include the tested commit/version, scope, results, and remaining gaps. Local checks are not remote CI, deployment, or a release.
- Use the available `mcp-builder` skill for MCP design and `find-skills` for focused skill discovery when helpful. Do not automatically install new skills or migrate the SDK as part of a refactor.
