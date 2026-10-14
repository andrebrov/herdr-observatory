# 0004 — Render Markdown through a restricted document tree

Status: accepted

Date: 2026-10-14

## Context

The line-based evidence preview handles only headings and fences. Coding reports also use nested lists, tables, emphasis, block quotes, task lists, and links. Report content remains untrusted; inserting a parser's HTML would expand the document trust boundary.

## Decision

Use markdown-it 15.0.2 with raw HTML, automatic links, and typography transformations disabled. Convert parser tokens on the Node side into a small allowlisted document tree. The UI creates only known elements and text nodes, with explicit metadata for list start, table alignment, code language, and noninteractive task markers. Never insert generated HTML. Images remain text references. Links become inert references unless their exact local path is already indexed evidence; those use the existing readEvidence action and its root/type checks. Apply the same renderer to evidence and ledger context, without changing acceptance or introducing network actions. Bound input size, nesting, and token count.

## Consequences

Reports gain CommonMark structure and built-in table/strikethrough support without a new browser asset or frontend build. The production package gains one parser dependency and its transitive dependencies. Parser and browser regressions must cover formatting, hostile HTML/URLs, code literal content, links, zero network requests, and live drawer isolation. Syntax highlighting, remote embeds, executable diagrams, and general URL opening remain outside this decision.

Source: https://github.com/markdown-it/markdown-it
