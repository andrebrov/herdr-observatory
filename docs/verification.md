# Verification — 2026-10-14

## Passing checks

`npm run verify` passed formatting, ESLint, strict `tsc --noEmit`, and 34 tests across four files on macOS, Node 26.11.1. The runtime and development dependencies install with the committed npm lockfile.

`OBSERVATORY_CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run screenshots` passed against the exact local presentation document and morphdom asset. It checked light/dark appearances, safe report rendering, inert hostile agent titles, keyboard view switching, search, modal focus wrapping, Escape, no remote resource requests, retained focused DOM node identity, stable scroll, updated click handlers, expanded ledger preservation, and an unchanged open evidence viewer during background refresh.

The browser check produced:

- [Dark appearance](screenshots/overview-dark.png)
- [Light appearance](screenshots/overview-light.png)
- [Safe Markdown evidence viewer](screenshots/evidence-light.png)

These are browser renderings of the implemented UI, not native-window captures. Playwright's matching browser was not installed; the existing Chrome executable was used explicitly. No browser or system tool was installed globally.

A fresh local clone also passed `npm ci` and `npx tsx src/cli.ts --demo --snapshot`. The relocated fixtures produced all five stages, exactly one evidence-bound accepted assignment, and no diagnostics. The installed native Glimpse executable was present. The temporary clone was removed after validation.

## Native launch

`npm run demo` opened the Swift/WKWebView Glimpse window and printed:

```text
Native dashboard connected · read-only observation mode
```

The native screenshot was captured from that application's owned macOS window, after the local bridge and fixture snapshot loaded:

[Native Glimpse window](screenshots/native-overview.png)

For manual native validation, run `npm run demo`, confirm the five board states and two attention records, switch system/light/dark appearance, navigate controls with Tab and `1`–`5`, search with `/`, and open design-notes.md from Evidence. Confirm the deliberately hostile script is visible as text and the evidence drawer traps Tab until Escape. Leave a task control focused through at least one five-second refresh; focus should remain. Close the window and confirm the CLI exits.

The Glimpse host and platform file/pane launch wrappers are the platform-bound validation surface. Their deterministic input validation is covered in the unit/browser tests. Native screenshot capture requires the OS to permit screen capture; no OS permission settings are changed by this repository.

## Actual read-only integration

A direct adapter snapshot used the installed Herdr 0.9.4 and existing `~/.local/state/teamlead/state.json` plus its attention and supervision sidecars. All four structured sources loaded successfully. The selected project had one correlated live pane. The explicitly selected shared owner state contained 196 assignments; the timeline returned its newest 500 events and attention replay returned one pending item.

Zero assignments were classified accepted. Existing owner resolutions are free-text strings, not exact `accepted` classifications. The dashboard displayed those outcomes without extracting acceptance from their prose.

SHA-256 hashes of the existing state and both sidecars were identical before and after the read. The adapter performed no owner commands, acknowledgements, locks, dispatches, or supervision writes. Actual snapshot output was kept outside this repository; it is not committed or used in demo screenshots.

An expected red run temporarily removed the evidence-digest predicate. The changed-evidence regression failed, demonstrating that it detects unsafe acceptance. The predicate was restored before the full passing run.

## Recovery and boundaries

Tests demonstrated partial JSON and unsupported schemas produce source errors without overwriting bytes; missing sources do not invent records; changed report bytes withdraw acceptance; restoring original bytes restores the recorded assignment classification; unknown resolution schemas cannot grant acceptance; native-session mismatch cannot inherit old work; symlink escapes and executable evidence are refused; malformed image signatures cannot render; and polling is bounded, nonoverlapping, and stops cleanly.

The native `Focus pane` command and external macOS `open` action were not executed against the operator's existing sessions/files during validation. Their command guards and evidence viewer paths were exercised locally. Task-wide release acceptance, actual test-result reproduction, process-identity verification for watchers, and cross-platform native hosts remain outside the verified claim.
