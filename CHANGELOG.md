# Changelog

## Unreleased

- Add opt-in Star Trek LCARS appearance themes: an LCARS frame with eleven palettes (Movie Era, LCARS, TNG, Blue/Grey/Yellow/Red Alert, Star Trek Online, Klingon, Romulan, Gorn). Text on coloured bars picks black or white by contrast; fonts stay local.

## 0.2.0 — 2026-10-14

- Render evidence and ledger Markdown with tables, nested/task lists, emphasis, block quotes, code blocks, frontmatter metadata, safe indexed-evidence links, and a Rendered/Source toggle. Keep raw HTML and remote embeds inert (ADR 0004).

## 0.1.0 — 2026-10-14

- Add a compiled executable and GitHub source runner via npm exec, with local build/session connection instructions and self-contained AGENTS.md guidance (ADR 0003).

- Add a native Glimpse companion with project/session selectors, agent activity, assignment board, event timeline, attention, provenance, and a safe evidence viewer.
- Integrate teamlead state, supervision, attention, Herdr snapshots, Markdown ledger context, and Beans issues without mutating owner state.
- Require explicit structured assignment acceptance and matching current evidence receipts. Preserve free-text resolutions as unclassified outcomes.
- Preserve focus, scroll, expanded context, and retained handlers across live updates with local morphdom.
- Include portable synthetic fixtures, regression tests, browser checks, and native screenshots.
- Record standalone observation and incremental DOM decisions in ADRs 0001 and 0002.
