# 0001 — Read-only Glimpse companion

Status: accepted

Date: 2026-10-14

## Context

The inspected Herdr 0.9.4 CLI offers protocol 22 snapshot reads and built-in integration installation for named agent products. No supported third-party dashboard plugin registration was found. Glimpse 0.8.1 provides `open(html, options)`, incoming `message` events and `win.send(js)` (JavaScript evaluation, not a JSON send API). Teamlead state schema 6, supervision schema 1, and attention schema 1 have separate owners. Owner CLI readers may migrate state and are unsuitable here.

## Decision

Build a standalone TypeScript CLI using direct read-only file adapters and bounded `herdr api snapshot` subprocesses. Use Glimpse's message bridge with a fixed command allowlist; safely serialize snapshots into a constant JavaScript receiver. Keep rendering and adapters separate. Never execute report HTML or interpret prose as status. Treat exact supervision resolution outcome `accepted` with matching evidence receipts as recorded assignment acceptance only; retain all other outcomes verbatim as unclassified resolutions. No task-wide acceptance is inferred. Markdown ledger and Beans completion remain context. Do not call owner state utilities, acknowledge events, create locks or write source files.

## Consequences

Works without active Herdr via fixtures. Native UI needs a supported Glimpse host. Schema changes fail closed per source; unreadable sources are visible diagnostics. Exact accepted outcomes may be rare in existing free-text history; conservative underclaiming is intentional. Explicit focus is the only Herdr control action and can mark the focused completion seen; passive reads never do. Future plugin support requires a new ADR.

## Inspection sources

- https://github.com/HazAT/glimpse (README and src/glimpse.mjs, 0.8.1)
- Installed `herdr --help`, `herdr integration install --help`, `herdr api schema`, `herdr api snapshot`, `herdr agent focus --help`.
- Installed teamlead `state-schema.md`, `teamlead/attention.py`, and actual read-only state/sidecar inspection.
