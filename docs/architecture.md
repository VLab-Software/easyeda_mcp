# Architecture

EasyEDA Pro MCP bridges any `stdio` MCP client to the live `eda.*` runtime inside EasyEDA Pro over a localhost WebSocket link.

```mermaid
flowchart LR
    A["MCP Client (stdio)"] --> B["MCP Server (Node.js)"]
    B --> C["WebSocket Bridge (127.0.0.1:8765)"]
    C --> D["EasyEDA Pro Extension (.eext)"]
    D --> E["EasyEDA Pro eda.* APIs"]
```

## Design Principles

1. **Live editor source of truth**: queries run against the active schematic or PCB open in EasyEDA Pro rather than fragile offline file exports.
2. **Read-first catalog**: 31 of 32 tools advertise `readOnlyHint: true`; this metadata is not a guarantee of zero side effects. Navigation can change the viewport and exports can write files.
3. **Confirmed mutations**: DRC rule edits use immutable previews, exact confirmation, target/state checks, expiry, and native readback. Legacy save/import/route/layout actions use confirmation phrases but do not yet share the full DRC lifecycle.
4. **Structured diagnostics**: failures expose an `error` code and message; some include remediation steps. Diagnostic coverage and runtime contract validation remain incremental.
5. **Incremental specifications and modules**: MCP registration is organized by domain and a specification template exists. Individual specifications for historical tools, extension extraction, and automated dependency checks remain work in the [evolution plan](./evolution-plan.md).

## Architecture direction

[ADR 0001](./adr/0001-incremental-architecture.md) records the accepted dependency direction and compatibility constraints. It describes the target, not a completed migration: current registrars still depend on the concrete bridge, and the extension and schematic engine still concentrate multiple responsibilities. See the [roadmap](./evolution-plan.md) for the ordered parts and acceptance gates.

## Core Modules

| Module | Source Path | Responsibility |
| --- | --- | --- |
| **CLI Entrypoint** | `src/index.ts` | Starts the WebSocket server, attaches `StdioServerTransport`, and manages process shutdown. |
| **WebSocket Bridge** | `src/bridge/EasyEdaBridge.ts` | Listens on `ws://127.0.0.1:8765`, tracks extension handshake and version compatibility, and dispatches timed RPC requests. |
| **MCP Tool Orchestrator** | `src/mcp/registerTools.ts` | Lean entrypoint delegating tool registration to domain-specific modules under `src/mcp/tools/`. |
| **Domain MCP Tools** | `src/mcp/tools/` | Status (`statusTools.ts`), schematic (`schematicTools.ts`), PCB (`pcbTools.ts`), DRC (`drcTools.ts`), exports (`exportTools.ts`), and confirmed actions (`actionTools.ts`). |
| **Schematic Engine** | `src/schematic/analysis.ts` | Normalizes schematic primitives, traces nets and components, and evaluates graph-based circuit assertions. |
| **DRC Contracts** | `src/drc/contracts.ts` | Shared browser-safe Zod schemas and canonical JSON validation for PCB design rule operations. |
| **Extension Host** | `extension/src/index.ts` | Connects via `eda.sys_WebSocket`, reports active document metadata, and routes bridge RPC methods to `eda.*` APIs. |
| **Extension Helpers** | `extension/src/helpers.ts` | Defensive API guards (`ensureApi`), error normalization, geometry helpers, and data sanitization for browser sandbox. |
| **DRC Handler** | `extension/src/drcRules.ts` | Reads `eda.pcb_Drc` surfaces, stages immutable previews with 15-minute TTL, verifies PCB identity, and performs readback checks. |
| **Specs Governance** | `specs/SPEC_TEMPLATE.md` | Formal RFC contract templates defining Zod schemas, MCP annotations, and EasyEDA native API mappings. |
| **Release Identity** | `src/version.ts` | Single source of truth for server (`1.3.1`), extension (`0.4.0`), and bridge protocol (`0.1.0`) versions, verified in `src/version.test.ts`. |

## Request Lifecycle

1. **Tool invocation**: The AI client calls an MCP tool over `stdio` JSON-RPC.
2. **Schema & guard validation**: The MCP server validates parameters with Zod and rejects unconfirmed mutations before touching the WebSocket bridge.
3. **Bridge RPC dispatch**: The server sends `{ kind: "call", requestId, method, params }` over `ws://127.0.0.1:8765`.
4. **Native `eda.*` execution**: The extension executes the requested `eda.*` API calls on the open project and responds with `{ kind: "result", result }` or `{ kind: "error", error }`.
5. **Structured response**: The server returns both formatted text and `structuredContent` to the AI client.

::: warning Stdio Transport Integrity
The MCP server communicates over `stdout` using JSON-RPC. Any diagnostic or debug logging inside `src/` **must** write to `stderr` (`console.error`), never `console.log`.
:::
