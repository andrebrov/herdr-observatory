import { readFile, realpath, stat, readdir } from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import {
  resolve,
  dirname,
  relative,
  isAbsolute,
  extname,
  basename,
} from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import {
  normalize,
  object,
  rows,
  str,
  type Row,
  type Source,
  type Evidence,
  type Dashboard,
} from "./domain.js";
const exec = promisify(execFile);
const MAX_FILE = 16 * 1024 * 1024;
export interface Config {
  projects: string[];
  sessions: string[];
  state: string;
  ledger?: string;
  evidenceRoots: string[];
  demo: boolean;
  task?: string;
}
export async function canonical(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return resolve(path);
  }
}
export async function allowedFile(
  path: string,
  roots: string[],
): Promise<string> {
  const actual = await realpath(path);
  const allowed = await Promise.all(roots.map(canonical));
  if (
    !allowed.some((root) => {
      const r = relative(root, actual);
      return r === "" || (!r.startsWith("..") && !isAbsolute(r));
    })
  )
    throw Error(
      "Evidence is outside configured roots. Add --evidence-root explicitly.",
    );
  const info = await stat(actual);
  if (!info.isFile() || info.size > MAX_FILE)
    throw Error("Evidence must be a regular file under 16 MiB");
  return actual;
}
function versions(doc: Row, name: string, state: string) {
  const expected = name === "Teamlead" ? 6 : 1;
  if (doc.schema_version !== expected)
    throw Error(
      `Unsupported ${name} schema ${String(doc.schema_version)}; expected ${expected}. Source left unchanged.`,
    );
  if (name !== "Teamlead" && doc.state_path !== state)
    throw Error(`${name} belongs to a different state path`);
  const collections =
    name === "Teamlead"
      ? ["assignments", "snapshots"]
      : name === "Supervision"
        ? ["members", "events", "watchers", "acknowledgements", "holds"]
        : ["events"];
  for (const key of collections) {
    if (!Array.isArray(doc[key])) throw Error(`Invalid ${name}.${key}`);
    for (const row of rows(doc[key])) {
      const version = key === "snapshots" ? 3 : name === "Teamlead" ? 6 : 1;
      if (row.schema_version !== version)
        throw Error(`Unsupported ${name}.${key} record schema`);
    }
  }
  if (name === "Supervision")
    for (const m of rows(doc.members)) {
      if (
        !str(m.id) ||
        !str(object(m.assignment).agent) ||
        typeof m.active !== "boolean"
      )
        throw Error("Invalid supervision member");
      if (m.resolution != null && object(m.resolution).schema_version !== 1)
        throw Error("Unsupported resolution schema");
      for (const e of rows(object(m.resolution).evidence))
        if (
          e.schema_version !== 1 ||
          !str(e.path) ||
          !/^[a-f0-9]{64}$/.test(str(e.sha256)) ||
          typeof e.size !== "number"
        )
          throw Error("Invalid evidence receipt");
    }
  if (name === "Teamlead") {
    for (const a of rows(doc.assignments))
      if (!str(a.agent) || !str(a.at)) throw Error("Invalid assignment");
    if (doc.recovery && object(doc.recovery).schema_version !== 9)
      throw Error("Unsupported recovery schema");
  }
}
export class Adapter {
  readonly config: Config;
  private watchers: FSWatcher[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private debounce?: ReturnType<typeof setTimeout>;
  private busy = false;
  private stopped = false;
  constructor(config: Config) {
    this.config = config;
  }
  async snapshot(
    project: string,
    session: string,
    now = this.config.demo ? Date.parse("2026-10-14T05:30:00Z") : Date.now(),
  ): Promise<Dashboard> {
    const sources: Source[] = [],
      diagnostics: string[] = [],
      evidence: Evidence[] = [];
    const statePath = await canonical(this.config.state);
    const roots = [project, dirname(statePath), ...this.config.evidenceRoots];
    const load = async (
      name: string,
      path: string,
    ): Promise<Row | undefined> => {
      const source: Source = {
        name,
        path,
        status: "ok",
        observedAt: new Date(now).toISOString(),
        modifiedAt: null,
        detail: "",
      };
      sources.push(source);
      try {
        const info = await stat(path);
        source.modifiedAt = info.mtime.toISOString();
        if (!info.isFile() || info.size > MAX_FILE)
          throw Error("Not a regular JSON file under 16 MiB");
        const parsed: unknown = JSON.parse(
            await readFile(path, "utf8"),
            (_key, value: unknown) =>
              this.config.demo && typeof value === "string"
                ? value.replaceAll("$DEMO", dirname(statePath))
                : value,
          ),
          doc = object(parsed);
        versions(doc, name, statePath);
        return doc;
      } catch (e) {
        source.status = object(e).code === "ENOENT" ? "missing" : "error";
        source.detail = e instanceof Error ? e.message : String(e);
        diagnostics.push(`${name}: ${source.detail}`);
        return undefined;
      }
    };
    const [state, supervision, attention] = await Promise.all([
      load("Teamlead", statePath),
      load("Supervision", statePath + ".supervision.json"),
      load("Attention", statePath + ".attention.json"),
    ]);
    let live: Row | undefined, liveAt: string | undefined;
    const liveSource: Source = {
      name: "Herdr",
      path: `herdr --session ${session} api snapshot`,
      status: "ok",
      observedAt: null,
      modifiedAt: null,
      detail: "",
    };
    sources.push(liveSource);
    try {
      const output = this.config.demo
        ? await readFile(resolve(dirname(statePath), "live.json"), "utf8")
        : (
            await exec("herdr", ["--session", session, "api", "snapshot"], {
              timeout: 2500,
              maxBuffer: 4 * 1024 * 1024,
            })
          ).stdout;
      live = object(JSON.parse(output));
      const snap = object(object(live.result).snapshot);
      if (!Array.isArray(snap.agents))
        throw Error("Unsupported Herdr snapshot envelope");
      // Scope live panes to the explicitly selected project, never harvest unrelated terminal text.
      snap.agents = rows(snap.agents).filter(
        (a) =>
          str(a.cwd) === project ||
          str(a.cwd).startsWith(project + "/") ||
          this.config.demo,
      );
      liveAt = new Date(now).toISOString();
      liveSource.observedAt = liveAt;
    } catch (e) {
      liveSource.status = "error";
      liveSource.detail = e instanceof Error ? e.message : String(e);
      diagnostics.push(`Herdr unavailable: ${liveSource.detail}`);
    }
    const addEvidence = async (path: string, receipt?: Row) => {
      if (!path) return;
      if (evidence.length >= 300) {
        if (!diagnostics.includes("Evidence index limited to 300 artifacts"))
          diagnostics.push("Evidence index limited to 300 artifacts");
        return;
      }
      const existing = evidence.find(
        (e) => e.path === path && e.sha256 === receipt?.sha256,
      );
      if (existing) return;
      const unbound = receipt
        ? evidence.find((e) => e.path === path && e.sha256 === undefined)
        : undefined;
      const item: Evidence = unbound ?? {
        id: `evidence-${createHash("sha256")
          .update(path + "\0" + str(receipt?.sha256))
          .digest("hex")
          .slice(0, 24)}`,
        path,
        title: basename(path),
        kind: extname(path).slice(1) || "text",
        sha256:
          typeof receipt?.sha256 === "string" ? receipt.sha256 : undefined,
        integrity: receipt ? "unavailable" : "unbound",
      };
      if (!unbound) evidence.push(item);
      if (receipt) {
        item.sha256 = str(receipt.sha256);
        item.id = `evidence-${createHash("sha256")
          .update(path + "\0" + item.sha256)
          .digest("hex")
          .slice(0, 24)}`;
        item.integrity = "unavailable";
      }
      try {
        const safe = await allowedFile(path, roots);
        if (receipt) {
          const bytes = await readFile(safe);
          item.integrity =
            bytes.length === receipt.size &&
            createHash("sha256").update(bytes).digest("hex") === receipt.sha256
              ? "matched"
              : "changed";
        }
      } catch {
        item.integrity = "unavailable";
      }
    };
    let selectedState = state,
      selectedSup = supervision,
      selectedAttention = attention;
    if (this.config.task) {
      // Preserve assignment indices so dispatch identity remains exact.
      selectedState = state
        ? {
            ...state,
            assignments: rows(state.assignments).map((a) =>
              a.task === this.config.task ? a : { ...a, agent: "", task: null },
            ),
          }
        : undefined;
      selectedSup = supervision
        ? {
            ...supervision,
            members: rows(supervision.members).filter(
              (m) => object(m.assignment).task === this.config.task,
            ),
          }
        : undefined;
    }
    if (this.config.task) {
      const memberIds = new Set(rows(selectedSup?.members).map((m) => m.id));
      if (selectedSup)
        selectedSup = {
          ...selectedSup,
          events: rows(selectedSup.events).filter(
            (e) => e.member === null || memberIds.has(e.member),
          ),
        };
      if (selectedState)
        selectedState = {
          ...selectedState,
          recovery: {
            ...object(selectedState.recovery),
            events: rows(object(selectedState.recovery).events).filter(
              (e) => e.task === this.config.task,
            ),
          },
        };
      const obligationIds = new Set(
        rows(attention?.events)
          .filter(
            (e) =>
              e.action === "record" && object(e.data).task === this.config.task,
          )
          .map((e) => object(e.data).id),
      );
      if (attention)
        selectedAttention = {
          ...attention,
          events: rows(attention.events).filter(
            (e) =>
              object(e.data).task === this.config.task ||
              obligationIds.has(object(e.data).id),
          ),
        };
    }
    for (const member of rows(selectedSup?.members)) {
      await addEvidence(str(object(member.assignment).report));
      for (const receipt of rows(object(member.resolution).evidence))
        await addEvidence(str(receipt.path), receipt);
    }
    for (const d of rows(object(state?.recovery).dispatches).filter(
      (d) => !this.config.task || d.task === this.config.task,
    ))
      await addEvidence(str(object(d.report).report));
    let ledger = "";
    if (this.config.ledger) {
      const path = resolve(this.config.ledger),
        source: Source = {
          name: "Ledger (narrative)",
          path,
          status: "ok",
          observedAt: new Date(now).toISOString(),
          modifiedAt: null,
          detail: "Narrative only; never used for status",
        };
      sources.push(source);
      try {
        const safe = await allowedFile(path, roots);
        ledger = await readFile(safe, "utf8");
        source.modifiedAt = (await stat(safe)).mtime.toISOString();
        await addEvidence(path);
      } catch (e) {
        source.status = "error";
        source.detail = String(e);
        diagnostics.push(`Ledger: ${String(e)}`);
      }
    }
    const beans: Dashboard["beans"] = [];
    const beansDir = resolve(project, ".beans");
    try {
      const paths = (await readdir(beansDir))
        .filter((p) => p.endsWith(".md"))
        .slice(0, 200);
      for (const file of paths) {
        const safe = await allowedFile(resolve(beansDir, file), [project]);
        const text = await readFile(safe, "utf8");
        beans.push({
          id: basename(file, ".md"),
          title: /^title:\s*(.*)$/m.exec(text)?.[1] ?? file,
          status: /^status:\s*(.*)$/m.exec(text)?.[1] ?? "unknown",
        });
        await addEvidence(safe);
      }
      sources.push({
        name: "Beans (context)",
        path: beansDir,
        status: "ok",
        observedAt: new Date(now).toISOString(),
        modifiedAt: null,
        detail: "Issue workflow status is not assignment acceptance",
      });
    } catch (e) {
      sources.push({
        name: "Beans (context)",
        path: beansDir,
        status: object(e).code === "ENOENT" ? "missing" : "error",
        observedAt: null,
        modifiedAt: null,
        detail: String(e),
      });
    }
    const dashboard = normalize({
      project,
      session,
      now,
      demo: this.config.demo,
      state: selectedState,
      supervision: selectedSup,
      attention: selectedAttention,
      live,
      liveAt,
      sources,
      evidence,
      ledger,
      beans,
      diagnostics,
    });
    if (this.config.task) {
      dashboard.tasks = dashboard.tasks.filter(
        (t) => t.title === this.config.task,
      );
      dashboard.agents = dashboard.agents.filter((a) => a.name);
      dashboard.attention = dashboard.attention.filter(
        (a) => a.task === this.config.task,
      );
    }
    return dashboard;
  }
  start(refresh: () => Promise<void>) {
    const tick = async () => {
      if (this.busy || this.stopped) return;
      this.busy = true;
      try {
        await refresh();
      } catch (e) {
        console.error("Refresh failed:", e);
      } finally {
        this.busy = false;
      }
    };
    this.timer = setInterval(() => void tick(), 5000);
    const dirs = new Set([
      dirname(resolve(this.config.state)),
      ...this.config.projects.map((p) => resolve(p, ".beans")),
      ...(this.config.ledger ? [dirname(resolve(this.config.ledger))] : []),
    ]);
    for (const dir of dirs)
      try {
        const watcher = watch(dir, () => {
          clearTimeout(this.debounce);
          this.debounce = setTimeout(() => void tick(), 200);
        });
        watcher.on("error", () => {
          watcher.close();
        });
        this.watchers.push(watcher);
      } catch {
        /* Missing directories are retried by the bounded polling fallback. */
      }
    void tick();
  }
  stop() {
    this.stopped = true;
    clearInterval(this.timer);
    clearTimeout(this.debounce);
    for (const w of this.watchers) w.close();
  }
}
