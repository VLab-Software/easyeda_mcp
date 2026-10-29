# Project roadmap

Updated 2026-10-29. This is the detailed roadmap for EasyEDA Pro MCP; the repository README contains its summary. Plans are ordered by dependencies, with no promised release dates.

## Current status

The public baseline provides local MCP/stdio, a WebSocket extension bridge, editor context, schematic analysis, navigation, exports and confirmed legacy actions.

Development for [issue #14](https://github.com/VLab-Software/easyeda_mcp/issues/14) adds **experimental PCB design rule editing**: native reads, immutable previews, exact confirmation, verification and result queries. The development identities are server `1.1.0-rc.1` and extension `0.2.0-rc.1`; these are not published releases. The development catalog contains 24 tools.

DRC rule editing has automated tests and a simulated MCP/stdio/WebSocket integration smoke. All five native rule-read scopes have returned successfully in a real PCB session with the matching extension. Writing rules in the real international editor is **not yet validated**. API availability is checked per method. Managing rule configuration is distinct from running a DRC check. See [DRC rule editing](./drc-rules.md) for the supported operations and limits.

Earlier experimental work on other branches is not counted as implemented here. A test that passed with mocks does not certify the editor, and local documentation builds do not prove Pages deployment or remote CI.

## 1. Data reliability

**Goal.** Every analysis must identify the project, document, page and capture that produced it, with explicit completeness and confidence.

**Available.** Live context, schematic snapshots and evidence-based heuristic analysis. The new DRC edit preview is bound to an exact PCB project/document/tab and captured native rule state.

**Planned work.** Page-specific collection, capture identities, consistent primitive getters, version-specific geometry adapters and reconciliation between editor data and inferred connections. Keep failed/partial sources visible rather than interpreting missing data as a clean circuit.

**Dependencies.** Existing bridge and supported public editor APIs.

**Completion criteria.** Fixture and editor tests demonstrate correct identity and source attribution on multiple pages, fractional/rotated geometry and incomplete responses; page/session changes cannot reuse a stale result as current.

## 2. Native electrical sources and rule management

**Goal.** Read and manage native design rules and expose native electrical findings with their source and scope.

**In development — #14.** Read current/saved configurations and net/net-by-net/region rules; create a new named profile without overwriting an existing one; replace the active PCB configuration or selected rule table through a reviewed, confirmed edit. Timeout, stale-state, duplicate execution and readback safeguards are implemented in this branch. Native editor validation remains pending.

**Next domain delivery.** Native DRC execution and native nets/netlist per schematic page, conditional on validation of the international editor APIs. Rule editing alone does not provide this. Named profile rename/delete, net classes and differential-pair management remain proposals for follow-up work.

**Dependencies.** Reliable identity from phase 1 and methods proven available in the supported international client. Keep the local extension/bridge as the default backend; an official MCP/CLI transport is a future alternative subject to separate validation.

**Completion criteria.** Supported rule changes are read back correctly in a disposable real PCB after a human-reviewed preview. Native DRC findings/counts match the editor for the same run; empty or conflicting native net data remains inconclusive. Netlist reads must have verified side effects before being treated as read-only.

## 3. Actionable review

**Goal.** Move from an explained finding to its component/page/region and compare revisions.

**Available.** Component/region navigation and targeted connection assertions.

**Planned work.** Finding-linked navigation with stale-target rejection, identified snapshot comparisons and explanations of electrical changes. Controlled schematic editing may be proposed separately; it is not part of this PCB rule-editing PR.

**Dependencies.** Stable capture IDs and evidence from phases 1–2.

**Completion criteria.** An editor finding resolves to the correct object/page; two captures produce expected changes without hiding uncertainty; deleted or stale IDs fail explicitly.

## 4. PCB analysis

**Goal.** Compare the physical board with the schematic using structured data.

**Planned work.** A structured PCB snapshot and schematic–PCB comparison of components, pins and native nets. Existing PCB search/export helpers are not a complete board-analysis implementation.

**Dependencies.** Stable identity, native net contracts and explicit component/pin correspondence.

**Completion criteria.** Known mismatches in test boards are reported with evidence; unsupported mappings remain unknown rather than passing. Editor and simulated tests are recorded separately.

## 5. Operation and distribution

**Goal.** Make setup, upgrades, diagnostics and the local bridge reproducible.

**In development.** Per-method DRC capabilities, immutable previews, confirmation at both boundaries, explicit uncertain outcomes, package/runtime version checks, extension type checks, CI smoke coverage and updated documentation.

**Planned work.** Compatibility matrices for international editor versions; session/result retention behavior; multiple-client ownership; stronger MCP contracts; bounded payloads; performance work driven by measured large projects; dependency maintenance; installation and upgrade validation.

**Dependencies.** Can advance alongside the domain phases without weakening confirmation or changing stdio output. Diagnostics must remain on stderr.

**Completion criteria.** Clean install, types, tests, builds, packaged installation and smoke pass; artifacts identify the same runtime versions; CI passes on the PR; merged documentation deploys from the actual default branch. Report unavailable editor methods and remaining development dependency advisories explicitly.

## Immediate acceptance work for #14

- Complete the pre-PR local checks and verify the generated `.eext`, npm tarball and documentation routes.
- Import the extension built from this branch into the international editor and verify the reported version and method capabilities.
- On a disposable PCB, read rules, prepare a small change, obtain approval for that preview, apply once and compare the native readback. No automatic PCB save.
- Test page/rule/session changes and an uncertain result without replaying a mutation. Document instance-local result retention.
- Open a PR against `master` with actual local results and the real-editor validation gap. Do not equate opening a PR with a release or Pages deployment.

Heuristic analysis is not ERC, native DRC or simulation. These distinctions remain part of every phase and acceptance record.
