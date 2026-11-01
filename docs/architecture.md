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
2. **Read-first by default**: 31 of 32 tools are strictly non-destructive (`readOnlyHint: true`) and never alter editor or project state.
3. **Two-phase confirmed mutations**: high-impact edits (such as PCB DRC rules and upcoming layout/schematic mutations) require an immutable preview, human approval of an exact confirmation token, target-identity checks, and native readback verification.
4. **Actionable diagnostics**: every error returns a deterministic `errorCode` (`wrong_document`, `stale_edit`, `api_unavailable`, etc.) and remediation steps.
5. **Spec-Driven & Domain-Modular**: all tools are governed by formal specs (`specs/*.md`) and organized into domain modules to preserve clean separation of concerns.

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
