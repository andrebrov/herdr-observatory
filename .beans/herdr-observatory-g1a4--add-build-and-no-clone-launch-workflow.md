---
# herdr-observatory-g1a4
title: Add build and no-clone launch workflow
status: completed
type: feature
priority: normal
created_at: 2026-10-14T06:07:51Z
updated_at: 2026-10-14T06:13:56Z
---

- [x] Add compiled CLI entry point and packaging.
- [x] Document local build and existing Herdr session connection.
- [x] Add portable AGENTS.md guidance.
- [x] Test packed no-clone runner and run verification.



## Summary of Changes

Added a compiled Node executable, npm prepare build, production package allowlist, and package smoke test. Expanded README with local build, source-based npm exec, running session discovery, state/evidence flags, and troubleshooting. Added self-contained AGENTS.md and ADR 0003. Clean npm ci, package execution from an empty directory, native compiled launch, lint, strict diagnostics, and all 34 tests passed. GitHub commands are documented as requiring initial publication; no remote changes were made.

An isolated Git-source npm exec check also passed: npm prepared the committed unbuilt source, compiled the CLI, and ran all five demo states. Remote GitHub accessibility remains conditional on publication.
