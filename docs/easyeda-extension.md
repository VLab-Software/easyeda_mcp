# EasyEDA Pro Extension Setup

This guide covers how to build, install, and connect the EasyEDA Pro extension used by the MCP bridge.

## What the Extension Does

The extension is the live integration layer inside EasyEDA Pro. It receives bridge requests and translates them into EasyEDA Pro API calls.

Without the extension, the MCP server cannot inspect or control the live editor session.

## Build the Extension

From the repository root:

```bash
npm run build:extension
```

This produces the compiled bundle at:

```text
extension/dist/index.js
```

The extension manifest is:

```text
extension/extension.json
```

## Package the Extension

EasyEDA Pro expects a packaged `.eext` artifact for normal import workflows.

Build and package it with:

```bash
npm run build:extension
npm run package:extension
```

## Packaging Requirements

The current packaging assumptions are important:

- `extension.json` must be at the package root
- the extension `name` must use lowercase-hyphen style
- the `uuid` must be exactly 32 lowercase alphanumeric characters
- the bundle format must match the EasyEDA SDK expectations

The bundle is currently built with:

- `esbuild`
- `format=iife`
- `globalName=edaEsbuildExportName`

## Install in EasyEDA Pro

Typical setup flow:

1. Start the MCP server
2. Build or package the extension
3. Import/load the extension in EasyEDA Pro
4. Enable external interaction permission for the extension
5. Open an EasyEDA Pro project
6. Use `MCP Bridge -> Connect to MCP` if automatic connection does not happen

## Why External Interaction Permission Matters

The extension uses `SYS_WebSocket` and related runtime capabilities. EasyEDA Pro may disable those permissions by default for local extensions.

If the permission is not enabled, the bridge cannot connect to the MCP server.

## Connection Confirmation

After installation:

1. trigger the connection
2. call `easyeda_live_status` from the MCP client
3. confirm that `connected` is `true`

## Extension Responsibilities

The extension currently handles:

- status reporting
- editor context retrieval
- component and net lookup
- schematic snapshot collection
- normalized schematic analysis helpers
- navigation requests
- export requests
- explicitly confirmed mutating actions

## Related Files

- `extension/src/index.ts`
- `extension/extension.json`
- `extension/README.md`
