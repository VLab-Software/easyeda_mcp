# Evolution plan

Updated 2026-11-01. This is the canonical roadmap, ordered by dependencies rather than release dates. The 2026-10-31 technical report on recommended EasyEDA MCP tools supplies capability proposals, not evidence that those tools or native APIs work in this repository.

## Baseline and status vocabulary

Phase 0A preserves foundation commit `ff4219d`, based on `develop` at `f1168d1`: server 1.3.1, extension 0.4.0, bridge protocol 0.1.0, and 32 tools. MCP registration is split by domain; extension helpers and a tool-spec template already exist. There is no monorepo or SDK v2 migration in the foundation.

Use independent evidence labels for every capability:

| Label | Meaning |
| --- | --- |
| Proposed | Planned contract or capability; native API availability may still be unknown. |
| Implemented | Code exists in the identified commit; this alone is not validation. |
| Validated in simulation | Automated checks passed with recorded fixtures/mocks or simulated editor APIs; identify the tested scope. |
| Validated in the editor | The matching extension executed the specified operation in EasyEDA Pro; record identity, API capabilities, readback, and limitations. |

The inherited foundation has 120 passing tests in 17 files and successful server/extension typechecks from the planning baseline. Each delivery must rerun its checks. Existing DRC rule-read evidence from earlier versions is not validation of writes or new editing features. Geometric schematic analysis is not native ERC or simulation. Local builds do not prove remote CI or deployment.

## Delivery rules

1. Create a branch before editing. Work on one part, open one PR against `develop`, obtain user review, and integrate it before the next part begins.
2. Use `feature/phase-<number>-<capability>`; phase 0 uses the names below. Preserve the pre-existing `feature/phase-0-sdd-foundation` branch and commit `ff4219d`. Phase 0A starts from that commit; later branches start from updated `develop` after the preceding PR is integrated.
3. Every PR contains a purpose, proportional specification, compatibility/acceptance criteria, validation evidence, documentation, and known gaps. Do not combine refactoring, new features, and SDK migrations.
4. Promote `develop` to `master` separately: that merge triggers automated publication. No manual version bump in ordinary parts. See [Git workflow](./git-workflow.md).
5. Use the existing [tool specification template](https://github.com/VLab-Software/easyeda_mcp/blob/develop/specs/SPEC_TEMPLATE.md) for new or changed public interfaces. An ADR plus acceptance checklist is sufficient for behavior-preserving refactors.

## Phase 0: Foundation

Architecture direction and tradeoffs: [ADR 0001](./adr/0001-incremental-architecture.md). Keep one npm package and current distribution. Preserve all 32 tools and public behavior; defer deliberate behavior changes to separate parts.

| Part / branch | Work | Acceptance |
| --- | --- | --- |
| 0A / `feature/phase-0a-governance` | Review the existing modularization, add repository instructions, this roadmap, and the architecture decision. | Baseline preserved; implementation gaps distinguished from target architecture; documentation linked and built; suite and both typechecks pass. |
| 0B / `feature/phase-0b-contracts` | Share RPC types instead of duplicating them; expose the minimal calls/status editor interface and implement it in the bridge. | Tools no longer depend on the concrete bridge; RPC methods, aliases, payloads, and errors remain compatible; shared code stays browser-safe. |
| 0C / `feature/phase-0c-extension` | Extract connection lifecycle, dispatch, API access, and domain handlers. Inject API access through factories; separate pure and editor-dependent helpers. | Manifest exports, reconnect behavior, timeouts, handlers, aliases, and DRC guards preserved; browser bundle and packages pass. |
| 0D / `feature/phase-0d-schematic` | Extract types, normalization, connectivity, and checks behind the existing analysis facade. | Existing callers and fixture results remain compatible, including warnings, provenance, confidence, and inconclusive results. |
| 0E / `feature/phase-0e-quality` | Add ESLint, format checking, cycle checks, and browser runtime dependency rules; wire checks into CI and reconcile remaining documentation claims. | Clean tree passes; controlled forbidden imports/cycles fail the checks; formatting is checked without CI rewriting files. |

### Review findings from the current foundation

- MCP registration is modular, but registrars still import the concrete bridge and a registration helper uses an unsafe SDK cast. Keep SDK adaptation contained; address typing during contracts work without silently changing schemas.
- `extension/src/index.ts` still owns connection state and most handlers. Helpers mix pure transformations with global `eda` access. API and RPC types remain broad or duplicated.
- `src/schematic/analysis.ts` combines normalization, geometric inference, and graph checks. Preserve its uncertainty semantics when splitting it.
- The exports registrar also holds navigation and library tools. Reassign registration ownership to appropriate domains during 0C without renaming public tools.
- DRC editing has immutable previews, exact confirmation, target/state checks, expiry, generation invalidation, readback, and result queries. Legacy save/import/route/layout actions do not share those guarantees.
- `readOnlyHint` metadata does not mean no side effects: navigation changes the viewport and exports can write files. Keep existing metadata during refactors; audit semantics in a separately specified behavior change.
- Structured failures currently use the `error` field, not a universal `errorCode`, and remediation is not uniform. Only a spec template exists; historical tools do not each have formal specs.

## Phases 1-5: Capability backlog

Finish phase 0 before beginning phase 1. Finish each part's specification and acceptance before coding it. Each semicolon-separated group in the following table is a separate branch/PR, in listed order. Use a concise capability suffix, such as `feature/phase-1-sdk-v2` or `feature/phase-2-schematic-components`.

| Phase | Ordered parts | Acceptance gate |
| --- | --- | --- |
| 1: Compatibility and verifiable operations | SDK MCP v2 migration; project/document/page identity; identified snapshots and per-method capabilities; common prepared mutation lifecycle | Migrate SDK in its own PR after 0E. Verify CLI/stdio and packaged client compatibility; reject stale targets; handle uncertain outcomes without automatic replay. |
| 2: P0 documents and schematic | List/open/render documents; component CRUD; wires and labels; native nets and detailed ERC where available | Resolve exact target IDs, verify supported APIs, and show requested changes in readback. Saving stays separate. Unknown native data cannot pass a circuit. |
| 3: P0 essential PCB | Pads and components; move/rotate/flip/delete components; read/edit outline; native autolayout and autoroute; detailed DRC findings | Validate geometry and layers, explicit destructive scope, readback and native findings in a disposable PCB. Distinguish native layout/routing from external file imports. |
| 4: P1 routing and finishing | Tracks/vias; copper and keepouts; airwires and placement/net reports; net classes/differential pairs/length groups; external imports and 3D inspection | Verify net/layer correspondence, rebuild effects, and rule availability. Report partial support and uncertain changes explicitly. |
| 5: P2 complete workflows | Advanced libraries; ports and buses; schematic-PCB comparison/synchronization; additional exports; SPICE feasibility study | Verify part/pin correspondence and export formats. Simulation is initially research, with no promise of supported execution. |

Reconcile proposed names with the current catalog before adding tools; avoid duplicating `easyeda_run_drc`, DRC rule tools, existing exports, and confirmed actions merely to match report names. Unavailable native methods remain explicitly unsupported. Do not expose arbitrary JavaScript execution.

The earlier recovered roadmap was compared before consolidation. Its priorities for reliable page identity, native electrical sources, findings, schematic-PCB comparison, and distribution are retained above. Its release-candidate versions, 24-tool baseline, issue-14-only scope, and PR-to-master instructions are obsolete for this delivery and are not carried forward.

## Phase 0A local validation record

Recorded 2026-11-01 on `feature/phase-0a-governance`, preserving `ff4219d`. The 0A additions change governance/documentation only; its PR also includes that inherited foundation commit because it is not yet in `develop`.

- Implemented: repository instructions, ADR, consolidated roadmap, PR checklist, and documentation navigation; review/integration pending.
- Validated in simulation: 120 tests in 17 files; both TypeScript checks; server/browser builds; `.eext` and `.mcpb` packaging; DRC smoke over stdio + WebSocket with 32 tools, exact confirmation, uncertain timeout, result queries, duplicate-dispatch protection, and stderr diagnostics.
- Documentation: VitePress build and local relative-link checks passed.
- Validated in the editor: no editor test performed for 0A. No native write, installation, release, or deployment is certified by these checks.
- Next part: 0B only after user review and integration of this PR into `develop`.

## Specifications, validation, and completion

- Before a capability: document input/output contracts, native API references and version/capability evidence, scope and side effects, errors, partial failure, timeouts, and observable acceptance criteria. Do not infer support from documentation alone.
- For new writes: bounded immutable preview; exact approval tied to target and state; one application; readback; explicit before/after evidence; separate save. An uncertain result is not retryable automatically, and rollback is not promised. Preserve the stronger existing DRC guards while generalizing in phase 1.
- Every PR: existing suite, server and extension typechecks, plus relevant regression tests. Build documentation when changed; run full packaging and simulated DRC stdio/WebSocket smoke for runtime/build changes. Exercise extracted interfaces rather than mirroring internals.
- For 0E: demonstrate that dependency checks fail on a cycle and a forbidden Node/MCP import, then restore a passing tree. Do not commit intentional violations.
- For editor validation: confirm matching extension version and capabilities; read before writing; use disposable targets and reviewed previews. Record simulated and real evidence separately, including tested commit/version and outstanding gaps. Do not publish private board data.
- Use `mcp-builder` for MCP contracts and focused `find-skills` searches when useful. No new skill installation is required; the discovered `setup-ts-deep-modules` skill is in progress and is not a foundation dependency.
- Part completion means its acceptance criteria and review are satisfied. Phase completion requires all its parts; release completion additionally requires the independent promotion/publication workflow.
