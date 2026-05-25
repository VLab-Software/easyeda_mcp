# Safety Model

This document explains the operational boundaries of the EasyEDA Pro MCP Bridge.

## Default Safety Posture

The project is designed to be read-first and conservative by default.

Most exposed capabilities are:

- inspection
- context retrieval
- schematic analysis
- navigation
- export

These operations are intended to be safe for day-to-day engineering assistance because they do not directly change project content.

## Read-Only by Default

The following categories are read-only in practice:

- live status
- editor context
- component search
- net search
- schematic snapshot and tracing
- connectivity verification
- navigation helpers
- export helpers

## Mutating Actions Are Gated

Project-changing actions are intentionally limited to:

- `easyeda_confirmed_action`

This tool requires explicit human confirmation in the input. A request is blocked unless the confirmation text contains a clearly affirmative phrase.

Examples of accepted confirmation language include:

- `I confirm`
- `confirmed`
- `confirma salvar`
- `confirmo`

## Why the Confirmation Gate Exists

EasyEDA Pro can affect the current project state, so mutation should not happen implicitly during exploratory assistance.

The confirmation gate helps ensure:

- the user is making an intentional decision
- read-only workflows stay separate from write workflows
- automated reasoning does not silently alter project data

## Current Non-Goals

The project does not currently implement commercial or ordering operations.

It also does not attempt to act as an unrestricted editor automation layer.

## Confidence and Inference

Some schematic reasoning is based on normalized and partially inferred connectivity, especially when raw EasyEDA data is incomplete.

For that reason, analysis results may include:

- `high`
- `partial`
- `low`

confidence levels, as well as warnings that describe what data was missing or inferred.

## Recommended Operator Practice

For high-confidence engineering review:

1. inspect the tool output
2. pay attention to warnings and confidence values
3. cross-check critical findings in the EasyEDA Pro UI
4. use confirmed actions only when the intent is explicit
