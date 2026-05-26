# Safety Model

The bridge is designed to be useful before it is powerful.

Default behavior is read-first. Anything that changes the EasyEDA Pro project must be explicit.

## Safe by Default

These workflows do not directly change project content:

- live status
- editor context
- component and net search
- schematic snapshots
- pin, net, and component tracing
- connection verification
- navigation
- exports

Use them freely during review and debugging.

## Actions That Can Change the Project

Project-changing actions go through:

```text
easyeda_confirmed_action
```

Supported actions:

- `save`
- `importChanges`
- `autoroute`
- `autolayout`

The tool blocks the request unless the confirmation text contains a clear confirmation phrase.

Accepted examples:

- `I confirm`
- `confirmed`
- `confirma salvar`
- `confirmo`

## Why Confirmation Exists

AI-assisted exploration often involves guesses, retries, and partial context.

The confirmation gate keeps those exploratory reads separate from actions that can affect the open project.

## Confidence Levels

Schematic analysis may return a confidence value:

- `high`: data is strong enough for normal review
- `partial`: useful, but some raw EasyEDA data was missing or inferred
- `low`: treat as a hint and verify manually

Always read `warnings` when they appear.

## Practical Rule

For important electrical decisions:

1. use the MCP tools to find and explain the issue
2. check warnings and confidence
3. verify the critical area in EasyEDA Pro
4. use confirmed actions only when the intent is clear

## Not Implemented

This project does not implement:

- commercial/order operations
- unrestricted editor automation
- offline `.epro` parsing
