# Working on Herdr Observatory

Herdr Observatory is a standalone, local, observational dashboard. Its native shell is Glimpse; TypeScript owns the adapters and command boundary, and a DOM renderer with morphdom owns the UI. Read README.md, docs/architecture.md, and the ADRs before changing those boundaries. These instructions are self-contained; do not depend on the maintainer's home-directory rules or skills.

## Set up and run

- Use Node.js 22+ and npm. macOS is the validated host; Glimpse needs an existing Swift/Xcode Command Line Tools installation.
- Run `npm ci`. The prepare lifecycle builds the production CLI into gitignored `dist/`.
- `npm run demo` runs the source entry point with synthetic data; `npm run start:built -- --demo` exercises the compiled executable.
- For real data, pass explicit `--project`, `--state`, and an existing `--session`. Use `--snapshot` for a headless read. See README.md for report roots and task filtering.
- Never install machine-level tools or change global configuration as part of setup. Do not change CueGlass or another project's files, agents, or supervision state.

## Respect the observation boundary

- Read Herdr through bounded `herdr --session NAME api snapshot` calls. Never launch/attach sessions for discovery, read terminal transcripts, send agent input, or dispatch work.
- Read teamlead JSON directly. Owner utilities can migrate state; do not invoke them from the dashboard. Never migrate, acknowledge, resolve, present, lock, or rewrite owner files.
- Markdown ledger and Beans status are context, never acceptance authority. Idle/done agents, report presence, and passing builds cannot grant acceptance.
- Preserve exact dispatch indices and identities. Acceptance requires the explicit structured resolution and matching current evidence receipts. Keep free-text outcomes unclassified. Native session identity must match before attaching historical assignments to live agents.
- Fail closed per source on unsupported schemas or corrupt data. Keep missing/stale/unavailable states visible. Inject clocks into normalization; do not use a file read time as an agent observation time.
- Only explicit user clicks may open validated local evidence or focus a revalidated pane. Focus can mark a Herdr completion seen; passive reads must not.

## Keep content and actions safe

- Render foreign strings with textContent. Do not inject report HTML, event text, or paths into innerHTML or executable JavaScript. morphdom is a patcher, not a sanitizer.
- Keep the fixed Glimpse bridge receiver and JSON serialization boundary. Validate all incoming actions against configured projects, sessions, known evidence, and live identities; never expose arbitrary shell execution.
- Canonicalize evidence roots and reject symlink escapes, unsupported types, oversized files, and invalid image signatures. Revalidate evidence and pane identities when actions run.
- Keep assets local. Do not add CDNs, remote report embeds, telemetry, or a network server without an explicit architectural decision.
- Retain stable DOM keys, current click handlers, focus, scroll, expanded narrative context, and drawer isolation across polling updates.

## Change and verify

- Track work in Beans: create or find a bean before implementation, keep its checklist current, and complete it with a summary after validation. Commit its file with the change. If Beans is unavailable, report that setup issue instead of editing unrelated state.
- Keep adapters (`src/adapter.ts`), pure domain logic (`src/domain.ts`), action validation (`src/actions.ts`), and presentation (`src/presentation.ts`, `ui/index.html`) separate.
- Add an ADR in docs/adr/ for architectural, schema, dependency, packaging, or trust-boundary choices. Do not rewrite accepted decisions into different decisions.
- Use the existing formatter/linter and strict TypeScript checks. Run `npm run verify` before handing off. Tests live beside modules as `*.test.ts` and must cover outcomes, rejected input, acceptance semantics, and source non-mutation where applicable.
- For UI changes, run `npm run screenshots` with an available Playwright browser or explicit `OBSERVATORY_CHROMIUM`. Review the images. For packaging/build changes, run `npm run package:check` from a clean dependency installation.
- Keep dist/ and node_modules/ uncommitted. Package only the runtime, trusted UI, and synthetic fixtures. Do not package local reports, owner state, secrets, tests, screenshots, or agent metadata. `scripts/demo-fixtures.ts` intentionally regenerates synthetic receipts; never point it at real state.
- Do not publish, push, or create GitHub resources unless the user requests it. Report the actual commands and results, plus any untested platform behavior. Local preparation is not a published release.
