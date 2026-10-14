# Herdr Observatory

A local, observational dashboard for Herdr coding sessions, running in a native Glimpse window. Track assignments, live activity, unanswered obligations, reports, and recorded acceptance without interrupting supervision.

![Native Glimpse dashboard](docs/screenshots/native-overview.png)

## Prerequisites

Use [Node.js 22+ with npm](https://nodejs.org/), macOS, and an existing [Xcode Command Line Tools](https://developer.apple.com/xcode/resources/) installation for Glimpse's Swift host. Git is needed for GitHub source installs. Development was verified on macOS with Node 26.11.1 and Herdr 0.9.4. No cloud account or credentials are needed for the demo. Live observation requires an installed [Herdr](https://herdr.dev/) CLI and an already-running local session.

## Run without a checkout

Run the demo from any directory:

```sh
npm exec --yes --package='github:gAmUssA/herdr-observatory#main' -- \
  herdr-observatory --demo
```

npm fetches the source into its execution cache, installs the build dependencies, runs the prepare/build lifecycle, and exposes the compiled executable. You do not need to clone the repository yourself or install a global command. First launch needs network access and can take longer while Glimpse prepares its native host. The repository remains marked private for npm publishing; this command uses GitHub directly and needs no npm registry release. Replace `main` with a known commit SHA or tag to pin the source revision.

The GitHub command requires the repository and selected ref to be accessible. To work on the source, use the local build instructions below. npm's [execution](https://docs.npmjs.com/cli/v11/commands/npm-exec/) and [lifecycle](https://docs.npmjs.com/cli/v11/using-npm/scripts/) documentation describes the cache and source preparation behavior.

Close the window or press Ctrl-C in the launching terminal to stop. Demo data is synthetic, uses a fixed observation clock, and never calls Herdr. Restarting restores the fixture view; the dashboard does not modify fixtures.

## Build and run locally

```sh
git clone https://github.com/gAmUssA/herdr-observatory.git
cd herdr-observatory
npm ci
npm run build
npm run start:built -- --demo
```

`npm ci` also builds through the prepare lifecycle. The explicit build command is useful after editing source. It compiles production TypeScript to gitignored `dist/`; the executable, UI, and fixtures resolve relative to the installation instead of your current directory. The built runner uses Node directly and does not need tsx at runtime.

For development, `npm run demo` runs TypeScript source through tsx, and `npm start -- ...` accepts the same live-data flags. If Glimpse's installer skipped native compilation, run `npm rebuild glimpseui` with the existing Swift toolchain. If your npm installation blocks dependency lifecycle scripts, review/allow the Glimpse build using that npm version's script policy, then rebuild; the dashboard does not change global npm policy or install machine-level tools.

## Connect to a running Herdr session

First inspect existing sessions and confirm the target is running:

```sh
herdr --version
herdr session list
herdr --session default api snapshot
```

Use the exact existing session name from the list. These commands inspect Herdr; the dashboard does not start, attach, or provision a session. In these instructions, Herdr is the CLI executable (`herdr`, not `herd`).

From any directory:

```sh
npm exec --yes --package='github:gAmUssA/herdr-observatory#main' -- \
  herdr-observatory \
  --project /absolute/path/to/your-project \
  --state "$HOME/.local/state/teamlead/state.json" \
  --session default
```

Or from a locally built checkout:

```sh
npm run start:built -- \
  --project /absolute/path/to/your-project \
  --state "$HOME/.local/state/teamlead/state.json" \
  --session default
```

Set `--project` to the code project whose panes you want to observe, not necessarily the Observatory checkout. Set `--state` to the same state file your teamlead uses. The default teamlead location is `$XDG_STATE_HOME/teamlead/state.json`, or `~/.local/state/teamlead/state.json` when XDG_STATE_HOME is unset. If the lead selected `--state FILE`, use that file instead. Observatory derives the attention and supervision sidecars from the selected state path. Do not initialize or migrate owner state to make the dashboard work; missing files are visible as unavailable sources, while live panes can still be observed.

Optional evidence and filtering flags:

| Flag                                        | Purpose                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `--task EXACT_TASK_ID`                      | Limit the selected shared state history to one task.                                 |
| `--ledger /absolute/path/to/TASK-LEDGER.md` | Show narrative context without treating it as status.                                |
| `--evidence-root /absolute/path/to/reports` | Permit reports outside the project and state directory. Repeat for additional roots. |
| `--project PATH`, `--session NAME`          | Repeat to populate the project/session selectors.                                    |
| `--snapshot`                                | Print normalized JSON and exit without opening a window.                             |

Project selection scopes live panes and Beans issues. The explicitly supplied state file defines the assignment and attention scope; shared history can span projects and sessions. Launch separate windows for different state files. The UI exposes source paths and does not guess project ownership from task names.

Observations refresh every five seconds. Open **Sources** to check failures, modification times, and provenance. If live status is unavailable, rerun the exact `herdr --session NAME api snapshot` command, verify the CLI is on PATH, and choose an existing running local session. If evidence is unavailable, check the file and explicitly add its containing report root. Unclassified resolutions mean the owner supplied free text; they are not automatically accepted.

A headless connection check from a built checkout:

```sh
node bin/herdr-observatory.mjs \
  --project /absolute/path/to/your-project \
  --state "$HOME/.local/state/teamlead/state.json" \
  --session default \
  --snapshot
```

This prints JSON-only stdout. `npm run start:built` adds npm's script banner. Passive observation does not acknowledge events or alter supervision. **Focus pane** is explicit and can mark a completion seen; no other agent control is exposed.

## What the dashboard shows

- **Agent activity:** recorded role and task, live lifecycle, elapsed time since dispatch, last observation, and freshness. A native session mismatch leaves the live agent unassigned instead of attaching historical work to a reused name.
- **Assignment board:** queued, running, awaiting verification, blocked, and accepted. Each card opens its assessment, provenance, evidence, and recorded commit reference. This board tracks assignments; it does not manufacture task-wide completion.
- **Activity:** dispatches, supervision observations, findings, corrections, attention events, and resolutions, sorted by event time with sequence tie-breaks.
- **Operator attention:** open and deferred obligations replayed from the owner's append-only history. Viewing never records presentation, acknowledgement, or resolution.
- **Evidence:** rich Markdown headings, nested lists, read-only task markers, tables, emphasis, block quotes, and labelled fenced code blocks; plain test/log output, image previews, recorded digests, and commit references. Toggle **Rendered / Source** to inspect original Markdown. YAML frontmatter appears as literal metadata. Raw HTML and report scripts remain inert text. Links to already-indexed local evidence open in the viewer; other URLs and embedded images remain text references and are never fetched.
- **Sources:** exact paths, read times, file modification times, errors, and saved watcher heartbeat status. A fresh heartbeat does not establish process identity or supervision health by itself.

Choose system, light, or dark appearance in the toolbar. Tab through controls; `/` focuses search, `1`–`5` changes views, and Escape closes the evidence drawer. Live DOM updates preserve retained controls, focus, scroll position, and expanded ledger context using [morphdom](https://github.com/patrick-steele-idem/morphdom).

**Open local file** revalidates a known evidence path before using macOS `open`. **Focus pane** rechecks the live pane occupant, project, and native session before issuing `herdr agent focus`. Explicit focus can mark a Herdr completion seen. Neither action runs automatically; demo focus is disabled. Dispatch, cancellation, approval, and state editing are absent.

## Acceptance is deliberately conservative

An assignment appears accepted only when:

1. An applied owner dispatch binds the exact assignment index, worker, role, and task.
2. Its matching supervision enrollment is explicitly resolved and inactive.
3. The resolution outcome is the exact value `accepted`.
4. Nonempty evidence receipts bind files whose current bytes, sizes, and SHA-256 digests match.

The owner permits free-text resolution outcomes. A sentence containing “accepted” is shown verbatim as an **unclassified resolution**, never parsed into status. Changed, missing, or inaccessible receipts withdraw verified acceptance. An idle/done agent, an existing report, a green build, a Beans completed issue, and the Markdown ledger never establish acceptance. Recorded assignment acceptance is historical evidence, not approval of the current repository head or an entire release.

## Verification

```sh
npm run verify
npm run package:check
```

The test suite covers normalization, chronological ordering, freshness, explicit acceptance, changed evidence, schema failures, attention replay, session mismatch, path and symlink boundaries, inert content, image signatures, bridge serialization, and bounded polling. Tests use temporary files and controlled clocks. Markdown regressions also cover hostile HTML/URLs, literal code, tables, task lists, safe evidence links, and bounded document complexity. The packaging smoke check packs the compiled CLI, runs it through npm exec from an empty directory, verifies all five demo states and UI asset resolution, rejects missing live paths, and checks that development artifacts are excluded.

The browser interaction check runs the exact HTML and installed local morphdom asset used by Glimpse:

```sh
# Use an already-installed compatible browser:
OBSERVATORY_CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run screenshots
# Or install Playwright's matching browser in your environment, then:
# npx playwright install chromium
# npm run screenshots
```

It checks both appearances, keyboard navigation, search, focus trapping, preserved node identity/focus/scroll across refresh, updated click handlers, expanded ledger, evidence drawer isolation, inert malicious fixture text, and zero remote requests. It regenerates the browser screenshots in `docs/screenshots/`. Native capture and the platform-bound launch procedure are documented in [verification notes](docs/verification.md).

## Scope and limitations

- macOS is the validated target. Glimpse supports other hosts, but local-file opening is currently macOS-only and other platforms have not been exercised.
- Supported owner formats: teamlead state 6, assignments 6, snapshots 3, recovery 9, supervision 1, attention 1. Unsupported versions fail closed per source and remain untouched. This reader never invokes migrating owner commands.
- Files refresh on watcher hints and every five seconds. Herdr subprocesses time out after 2.5 seconds, have bounded output, and never overlap dashboard refreshes. Missing directories fall back to polling. No state locks are created.
- Source files are read independently. Cross-file transactions are not atomic; transient inconsistencies cannot grant acceptance without matching identities and evidence. Failed reads show diagnostics and retry, without retaining an old accepted result.
- The evidence index is capped at 300 artifacts; Beans at 200 issues; timeline at 500 newest events. Evidence reads require regular files under configured canonical roots. Source/receipt file limit is 16 MiB; viewer limits are 2 MiB text and 8 MiB images. PNG, JPEG, and WebP are supported; HTML, SVG, PDF, executables, and arbitrary URLs are refused.
- Native pane focus and macOS external-file opening were not executed against existing user sessions during validation. Their guards are implemented; the passive integration and native window were exercised. No existing session or supervision state was modified.
- No remote event streaming, automatic project-to-task inference, persistence, task dispatch, approval, cancellation, or task-wide acceptance engine is included.

See [architecture](docs/architecture.md), [ADRs](docs/adr/0001-read-only-companion.md), [morphdom decision](docs/adr/0002-incremental-dom-updates.md), and [verification](docs/verification.md). Work is tracked in Beans; `beans list` shows the delivery task and follow-ups. Dependencies are pinned with a lockfile and weekly Dependabot checks.
