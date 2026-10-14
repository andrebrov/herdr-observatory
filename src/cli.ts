import { markdownDocument } from "./markdown.js";
import { parseArgs } from "node:util";
import { dashboardHTML } from "./presentation.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Adapter, canonical, type Config } from "./adapter.js";
import { object, str, type Dashboard } from "./domain.js";
import { handleAction } from "./actions.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function parseConfig(
  args: string[],
): Config & { snapshot: boolean; help: boolean } {
  const { values } = parseArgs({
    args,
    options: {
      demo: { type: "boolean" },
      project: { type: "string", multiple: true },
      session: { type: "string", multiple: true },
      state: { type: "string" },
      ledger: { type: "string" },
      "evidence-root": { type: "string", multiple: true },
      task: { type: "string" },
      snapshot: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });
  if (
    !values.demo &&
    !values.help &&
    (!values.project?.length || !values.state)
  )
    throw Error(
      "Live mode requires --project PATH and --state FILE. Use --demo without Herdr.",
    );
  return {
    projects: values.demo
      ? [resolve(root, "fixtures/demo")]
      : (values.project?.map((p) => resolve(p)) ?? []),
    sessions: values.session ?? ["default"],
    state: resolve(
      values.demo
        ? resolve(root, "fixtures/demo/state.json")
        : (values.state ?? "."),
    ),
    ledger: values.demo
      ? resolve(root, "fixtures/demo/TASK-LEDGER.md")
      : values.ledger
        ? resolve(values.ledger)
        : undefined,
    evidenceRoots: values["evidence-root"]?.map((p) => resolve(p)) ?? [],
    demo: !!values.demo,
    task: values.task,
    snapshot: !!values.snapshot,
    help: !!values.help,
  };
}
export const bridgeCall = (
  method: "configure" | "snapshot" | "evidence" | "notice",
  payload: unknown,
) =>
  `window.observatory.${method}(${JSON.stringify(payload).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029")});`;
export async function main() {
  const config = parseConfig(process.argv.slice(2));
  if (config.help) {
    console.log(
      `Herdr Observatory · observation only\n\nherdr-observatory --demo\nherdr-observatory --project PATH --state FILE [--session NAME] [--ledger FILE]\n\nRepeat --project / --session to populate selectors. --task ID limits shared state.\n--evidence-root PATH permits explicit external report roots.\n--snapshot prints normalized JSON without opening a window.\n--demo uses synthetic fixtures and never calls Herdr.\nClose the window or press Ctrl-C to stop. Explicit focus marks completions seen.`,
    );
    return;
  }
  config.state = await canonical(config.state);
  config.projects = await Promise.all(config.projects.map(canonical));
  const adapter = new Adapter(config);
  let project = config.projects[0],
    session = config.sessions[0],
    dashboard: Dashboard | undefined;
  if (config.snapshot) {
    console.log(
      JSON.stringify(await adapter.snapshot(project, session), null, 2),
    );
    return;
  }
  const { open } = await import("glimpseui");
  const html = await dashboardHTML();
  const win = open(html, {
    width: 1480,
    height: 1040,
    title: "Herdr Observatory",
  });
  let refreshing = false,
    pending = false,
    closed = false,
    started = false;
  const refresh = async () => {
    if (refreshing) {
      pending = true;
      return;
    }
    refreshing = true;
    try {
      const selectedProject = project,
        selectedSession = session;
      const result = await adapter.snapshot(selectedProject, selectedSession);
      if (
        !closed &&
        selectedProject === project &&
        selectedSession === session
      ) {
        dashboard = result;
        let ledgerMarkdown;
        try {
          ledgerMarkdown = markdownDocument(
            result.ledger,
            config.ledger,
            result.evidence,
          );
        } catch (error) {
          ledgerMarkdown = undefined;
          result.diagnostics.push(
            error instanceof Error
              ? error.message
              : "Ledger Markdown preview unavailable",
          );
        }
        win.send(bridgeCall("snapshot", { ...result, ledgerMarkdown }));
      }
    } finally {
      refreshing = false;
      if (pending && !closed) {
        pending = false;
        void refresh().catch((e) => console.error(e));
      }
    }
  };
  const stop = () => {
    closed = true;
    adapter.stop();
  };
  win.on("error", (e: Error) => {
    console.error("Glimpse:", e.message);
    stop();
    process.exitCode = 1;
  });
  win.on("closed", stop);
  win.on("message", (message: unknown) => {
    void (async () => {
      const m = object(message);
      if (m.action === "ready") {
        if (started) return;
        started = true;
        console.log("Native dashboard connected · read-only observation mode");
        win.send(
          bridgeCall("configure", {
            projects: config.projects,
            sessions: config.sessions,
          }),
        );
        adapter.start(refresh);
        return;
      }
      if (m.action === "select") {
        if (
          !config.projects.includes(str(m.project)) ||
          !config.sessions.includes(str(m.session))
        )
          throw Error("Project/session is not configured");
        project = str(m.project);
        session = str(m.session);
        await refresh();
        return;
      }
      if (m.action === "refresh") {
        await refresh();
        return;
      }
      if (!dashboard) throw Error("Wait for first observations");
      try {
        const result = await handleAction(message, dashboard, config);
        win.send(bridgeCall(result.kind, result.payload));
      } catch (e) {
        if (m.action === "readEvidence")
          win.send(
            bridgeCall("evidence", {
              id: m.id,
              error: e instanceof Error ? e.message : String(e),
            }),
          );
        else throw e;
      }
    })().catch((e) =>
      win.send(
        bridgeCall("notice", e instanceof Error ? e.message : String(e)),
      ),
    );
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      stop();
      win.close();
    });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  });
