## Security Review

Base branch: `master` (local)
Review branch: `codex/security-review-master`
Base commit: `128d791`

### Summary

The flagged package `fs-extra` is not used by the MCP server runtime in this branch. It appears only in development and packaging paths.

The more important security concern is the trust boundary created by the local WebSocket bridge between the MCP server and the EasyEDA Pro extension. Once connected, the MCP server can inspect project data, export project artifacts, navigate the editor, and trigger a limited set of confirmed write actions.

### Findings

1. `fs-extra` risk is overstated for runtime use in this branch.
   - `package.json` lists `fs-extra` only under `devDependencies`.
   - The server runtime entrypoint is `src/index.ts` and does not import `fs-extra`.
   - Packaging logic in `scripts/package-extension.mjs` uses `fs`, not `fs-extra`.

2. The bridge accepts a local WebSocket connection without an authentication handshake.
   - `src/bridge/EasyEdaBridge.ts` starts a WebSocket server on `127.0.0.1:8765`.
   - Any local process that can connect and speak the expected protocol may act as the extension client.
   - There is no shared secret, origin validation, or session pinning in the bridge protocol.

3. Read access is broad and includes sensitive project data.
   - Tools such as `easyeda_get_context`, `easyeda_schematic_snapshot`, component/net tracing, and related helpers can expose active project structure and metadata.
   - This is consistent with the product goal, but it means the MCP effectively handles sensitive engineering data.

4. Export operations are treated as read-only, but they still write sensitive artifacts to disk.
   - `easyeda_export_bom`, `easyeda_export_netlist`, `easyeda_export_gerber`, and `easyeda_export_pdf` are registered as read tools.
   - The extension writes files through `eda.sys_FileSystem.saveFile`, which can materialize sensitive outputs locally.

5. Mutating actions have an intent gate, but not a strong authorization boundary.
   - `easyeda_confirmed_action` requires confirmation text matching a regex.
   - This helps prevent accidental tool use, but a malicious or compromised MCP client can still send the required phrase and trigger allowed actions.

### Risk Assessment

- `fs-extra`: Low risk in the current shipped runtime path on this branch.
- Sensitive project exposure through inspection/export: Medium.
- Unauthorized local client impersonation over WebSocket: Medium to High, depending on the host threat model.
- Confirmed write actions: Medium.

### Recommended Hardening

1. Add an authenticated handshake between MCP server and extension.
   - Example: generate a random session token at server startup and require it in the first `hello` message.

2. Treat export tools as sensitive in documentation and tool descriptions.
   - They may be logically read-only for the design state, but they create durable files.

3. Add an allowlist or capability gate for mutating actions.
   - Consider disabling `easyeda_confirmed_action` by default unless an env var explicitly enables it.

4. Make the bridge endpoint less predictable.
   - Prefer an ephemeral port or require an explicit configured port plus token.

5. Document the local trust model clearly.
   - State that any local process able to reach the bridge may attempt to impersonate the extension unless authentication is added.
