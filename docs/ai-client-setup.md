# AI Client Setup

Use this page when you already built the project and want the exact setup for a specific AI tool.

If this is your first time, start with [Quick Start](./quick-start.md). If you want the full first-time flow, use [Getting Started](./getting-started.md).

## Build First

From the repository root:

```bash
npm install
npm run setup:local
```

The shared server entrypoint is:

```text
dist/index.js
```

Every client below points to:

```bash
node /absolute/path/to/easyeda_mcp/dist/index.js
```

## Choose Your Tool

- [Claude Desktop](#claude-desktop)
- [Codex CLI](#codex-cli)
- [Claude Code CLI](#claude-code-cli)
- [VS Code](#vs-code)
- [Other MCP Clients and CLIs](#other-mcp-clients-and-clis)

## Claude Desktop

Use this on Windows or macOS if you want a desktop chat app.

Windows config file:

```text
%APPDATA%\Claude\claude_desktop_config.json
```

macOS config file:

```text
~/Library/Application Support/Claude/claude_desktop_config.json
```

If the file does not exist, create it. Then add:

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

On Windows, use a Windows path:

```json
{
  "mcpServers": {
    "easyeda-pro": {
      "command": "node",
      "args": ["C:\\Users\\you\\Documents\\easyeda_mcp\\dist\\index.js"]
    }
  }
}
```

Then:

1. fully restart Claude Desktop
2. open EasyEDA Pro
3. open a schematic or PCB
4. use `MCP Bridge -> Reconnect` if needed
5. ask Claude to run `easyeda_doctor`

Note: Claude Desktop local MCP setup is separate from Claude.ai remote connectors.

## Codex CLI

Use this if you want a terminal workflow in Codex.

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
3. open the target schematic or PCB
4. reconnect the extension if needed
5. ask Codex to run `easyeda_doctor`

## Claude Code CLI

Use this if you want a terminal workflow in Claude Code.

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

Use this if you want MCP tools in Copilot Chat Agent mode.

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
5. ask for `easyeda_doctor`

Useful VS Code commands:

- `MCP: Open Workspace Folder Configuration`
- `MCP: List Servers`
- `MCP: Reset Trust`

## Other MCP Clients and CLIs

If your client supports a local `stdio` MCP server, use:

```bash
node /absolute/path/to/easyeda_mcp/dist/index.js
```

If the client needs a custom config format, see [MCP Client Setup](./mcp-client-setup.md).

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

- tools do not appear: rebuild and restart the MCP client
- tools appear but calls fail: run `easyeda_doctor`
- extension is disconnected: open EasyEDA Pro and use `MCP Bridge -> Reconnect`
- `dist/index.js` is missing: run `npm run setup:local`

## Official References

- Anthropic Claude Code MCP docs: <https://code.claude.com/docs/en/mcp>
- Anthropic Claude Desktop local MCP help: <https://support.anthropic.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop>
- OpenAI Docs MCP page with Codex MCP examples: <https://developers.openai.com/learn/docs-mcp>
- VS Code MCP setup docs: <https://code.visualstudio.com/docs/copilot/customization/mcp-servers>
- VS Code MCP configuration reference: <https://code.visualstudio.com/docs/copilot/reference/mcp-configuration>
