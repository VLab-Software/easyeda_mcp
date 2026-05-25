# AI Client Setup

Use this page to connect EasyEDA Pro MCP Bridge to Codex, Claude, Claude Code, or VS Code.

If you are setting this up for the first time, start with [Quick Start](./quick-start.md). It gives a shorter Windows, macOS, and Linux path.

Before choosing a client, run:

```bash
npm install
npm run setup:local
```

The server entrypoint must exist at:

```text
dist/index.js
```

## The Command Every Client Needs

All examples point to the same local server:

```bash
node /absolute/path/to/easyeda_mcp/dist/index.js
```

Replace the path with your machine's absolute path.

## Codex

Add the server:

```bash
codex mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
```

Check it:

```bash
codex mcp list
```

Then:

1. open Codex in this repository
2. open EasyEDA Pro
3. open your schematic or PCB
4. reconnect the EasyEDA extension if needed
5. ask Codex to run `easyeda_doctor`

First prompt:

```text
Run easyeda_doctor and tell me if the EasyEDA Pro bridge is healthy.
```

## Claude Desktop

Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "node",
      "args": ["/absolute/path/to/easyeda_mcp/dist/index.js"]
    }
  }
}
```

Then:

1. restart Claude Desktop
2. open EasyEDA Pro
3. open your schematic or PCB
4. reconnect the extension if needed
5. ask Claude to run `easyeda_doctor`

Note: Claude Desktop local MCP setup is separate from Claude.ai remote connectors.

## Claude Code

Add the server:

```bash
claude mcp add easyeda-pro -- node /absolute/path/to/easyeda_mcp/dist/index.js
```

Check it:

```bash
claude mcp list
```

You can also use a project `.mcp.json`:

```json
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "node",
      "args": ["/absolute/path/to/easyeda_mcp/dist/index.js"]
    }
  }
}
```

If Claude Desktop is already configured, Claude Code can import from it:

```bash
claude mcp add-from-claude-desktop
```

## VS Code

Create `.vscode/mcp.json`:

```json
{
  "servers": {
    "easyeda-pro": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/dist/index.js"]
    }
  }
}
```

If the VS Code workspace is not the repository root, use an absolute path instead.

Then:

1. open VS Code in the repository
2. open Copilot Chat in Agent mode
3. trust the MCP server when prompted
4. confirm the server is enabled in the tools picker
5. ask for `easyeda_live_status` or `easyeda_doctor`

Useful VS Code commands:

- `MCP: Open Workspace Folder Configuration`
- `MCP: List Servers`
- `MCP: Reset Trust`

## First Useful Prompts

Check health:

```text
Run easyeda_doctor and summarize the bridge status.
```

Confirm the open document:

```text
Run easyeda_get_context and tell me which EasyEDA Pro document is open.
```

Inspect a schematic:

```text
Run easyeda_schematic_snapshot and summarize the visible components, nets, and warnings.
```

Trace a part:

```text
Run easyeda_trace_component for USB1 and summarize its connected nets.
```

## Common Problems

- Tools do not appear: rebuild and restart the MCP client.
- Tools appear but calls fail: run `easyeda_doctor`.
- Extension is disconnected: open EasyEDA Pro and use `MCP Bridge -> Reconnect`.
- `dist/index.js` is missing: run `npm run setup:local`.

## Official References

- Anthropic Claude Code MCP docs: <https://code.claude.com/docs/en/mcp>
- Anthropic Claude Desktop local MCP help: <https://support.anthropic.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop>
- OpenAI Docs MCP page with Codex MCP examples: <https://developers.openai.com/learn/docs-mcp>
- VS Code MCP setup docs: <https://code.visualstudio.com/docs/copilot/customization/mcp-servers>
- VS Code MCP configuration reference: <https://code.visualstudio.com/docs/copilot/reference/mcp-configuration>
