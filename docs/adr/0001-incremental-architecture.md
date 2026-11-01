# ADR 0001: Incremental architecture for the existing package

- Date: 2026-11-01
- Status: Accepted direction; implementation proceeds through phase 0 parts B-E
- Delivery: Phase 0A

## Context

The foundation commit `ff4219d` splits MCP registration into six domain modules and extracts extension helpers. The extension entry point still combines connection lifecycle, dispatch, API access, and handlers. Schematic normalization, connectivity, and checks remain in one analysis module. RPC types are duplicated across runtimes, and MCP modules depend on the concrete WebSocket bridge.

The server and extension already share browser-safe schematic analysis, DRC contracts, protocol metadata, and version constants. Those shared imports must not acquire Node or MCP runtime dependencies. The catalog has 32 tools; compatibility matters while we prepare the editing capabilities in the roadmap.

## Decision

Keep a single npm package, TypeScript/ESM, current source roots, CLI, stdio transport, and existing artifact formats. Refactor by responsibility with explicit imports and narrow interfaces. Do not introduce workspaces, a dependency injection container, or a speculative transport backend.

| Responsibility | Target dependency rule |
| --- | --- |
| MCP registration and response formatting | Depend on shared contracts and the minimal editor interface; keep SDK code here. |
| WebSocket bridge | Implement editor calls/status; own sockets, request correlation, timeouts, and connection state. |
| Shared contracts | Describe existing RPC envelopes/types without Node, MCP, editor globals, or transport implementation imports. |
| Extension composition | Wire connection, dispatcher, handlers, and an injected API provider; retain manifest exports. |
| Extension domain handlers | Translate typed operations to the available `eda.*` surfaces; preserve errors, aliases, and API guards. |
| Schematic domain | Pure normalization, connectivity, and checks; depend only on browser-safe domain types/helpers. |

Phase 0B introduces only the editor calls/status interface needed by current tools, not lifecycle methods or alternate implementations. Phase 0C moves editor access to an explicit boundary and separates pure helpers from runtime utilities. Phase 0D keeps the current analysis module as a compatibility facade while extracting cohesive internals. Phase 0E enforces cycles and runtime boundaries in CI.

During extraction, preserve tool names, schemas/defaults, annotations, RPC method aliases, result/error shapes, version identities, extension exports, and packaging behavior. SDK v2 migration follows the completed foundation as a separate part. Validation/security behavior changes discovered along the way require their own explicit scope and regression tests.

## Consequences

- Small PRs remain reviewable and can be integrated independently in dependency order.
- Existing imports can continue through compatibility facades; internal modules should expose only what callers need.
- Existing limitations remain visible: RPC parsing validates only limited envelope structure; handlers still use broad API types; legacy actions lack the DRC edit lifecycle; per-page identity and native electrical data need further work.
- No claim of transactional mutation, automatic rollback, native ERC, or live-editor certification follows from this refactor.
- Automated dependency enforcement and new lint/format tooling are planned for 0E, not present merely because this ADR exists.

## Acceptance and follow-up

For 0A, publish the roadmap, contribution rules, review findings, and links; preserve runtime files and dependencies. Verify the existing suite, both typechecks, and documentation build. Subsequent parts must additionally verify affected packages and simulated stdio/WebSocket workflows. See the [roadmap](../evolution-plan.md) for ordered delivery and acceptance criteria.
