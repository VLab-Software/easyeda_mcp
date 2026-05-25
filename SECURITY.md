# Security Policy

EasyEDA Pro MCP runs locally and is designed to expose only the active EasyEDA Pro session to MCP clients you configure yourself.

## Supported Versions

Security updates are currently provided for the latest public beta release.

## Reporting a Vulnerability

Please do not open a public issue for a suspected vulnerability.

Report security concerns through GitHub private vulnerability reporting if it is enabled for the repository. If private reporting is unavailable, contact the maintainer through the repository owner profile.

Include:

- affected version or commit
- operating system
- MCP client used
- EasyEDA Pro extension version
- clear reproduction steps
- expected and actual behavior

## Local Runtime Boundaries

- The WebSocket bridge listens on `127.0.0.1` by default.
- MCP clients must be explicitly configured to run the local server.
- Most tools are read-only inspection, navigation, or export helpers.
- Project-changing actions go through `easyeda_confirmed_action` and require explicit confirmation text.

Do not expose the bridge host or port to untrusted networks.
