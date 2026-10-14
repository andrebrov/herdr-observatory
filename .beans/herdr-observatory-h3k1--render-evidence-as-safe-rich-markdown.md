---
# herdr-observatory-h3k1
title: Render evidence as safe rich Markdown
status: completed
type: feature
priority: normal
created_at: 2026-10-14T06:27:22Z
updated_at: 2026-10-14T06:40:01Z
---

- [x] Choose parser and record safe rendering decision.
- [x] Render Markdown reports and ledger with rich local styles.
- [x] Add safety and formatting regressions.
- [x] Verify native UI, package, and documentation.



## Summary of Changes

Added markdown-it 15.0.2 and a restricted document-tree renderer for evidence and ledger context, with rich typography, tables, nested and read-only task lists, emphasis, quotes, labelled code blocks, literal frontmatter, indexed local-evidence links, and Rendered/Source toggling. Raw HTML, remote embeds, and unknown URLs stay inert. Added ADR 0004, updated documentation and synthetic showcase, and captured light/dark/native screenshots. Version 0.2.0 passes formatting, lint, strict diagnostics, 44 tests, browser safety/interaction checks, native WebKit DOM checks, clean install/build, and 19-file package smoke.
