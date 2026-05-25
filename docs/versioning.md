# Versioning

This page explains how to think about versions in the EasyEDA Pro MCP Bridge project.

## Current Version

At the moment, the repository package version is:

- `0.1.0`

The EasyEDA Pro extension currently reports its own runtime version from the extension code.

## What Is Versioned

There are several moving parts in this project:

- the Node.js MCP server
- the EasyEDA Pro extension bundle
- the documentation site
- the bridge protocol assumptions between server and extension

Because these parts work together closely, version bumps should reflect compatibility expectations, not just code churn.

## Recommended Versioning Strategy

A practical strategy for this repository is semantic versioning:

- `MAJOR`: breaking changes to tool behavior, bridge protocol expectations, setup flow, or extension compatibility
- `MINOR`: new tools, new read capabilities, additive exports, additive docs sections, or backward-compatible features
- `PATCH`: bug fixes, documentation fixes, packaging fixes, and safe internal improvements

## Suggested Release Rules

Use a new:

- major version when users must change how they integrate or operate the bridge
- minor version when the project gains new capabilities without breaking existing usage
- patch version when fixing behavior without changing the integration contract

## Extension and Server Compatibility

Because the project depends on a live extension-server handshake, these should stay aligned:

- extension version
- bridge protocol version
- server tool contract

When adding or changing bridge methods, it is a good idea to:

1. update the relevant version markers
2. document the change in the changelog
3. note whether an MCP client restart is required
4. verify that the EasyEDA Pro extension still connects cleanly

## Documentation Versioning

For now, the docs track the default branch and describe the latest project state.

Later, if the project starts making regular releases, you can:

- keep a `latest` docs stream
- maintain release-tagged snapshots
- introduce a proper version switcher in the docs site

## Practical Rule of Thumb

If a change could surprise someone who already integrated the MCP bridge, it probably deserves an intentional version bump and a changelog entry.
