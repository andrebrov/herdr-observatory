/** Only structural records decide state. Text, builds and lifecycle labels never grant acceptance. */
export type Row = Record<string, unknown>;
export const object = (v: unknown): Row =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
export const rows = (v: unknown): Row[] =>
  Array.isArray(v) ? v.map(object) : [];
export const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;
export const time = (v: unknown): number =>
  typeof v === "string" && /(Z|[+-]\d\d:\d\d)$/.test(v) ? Date.parse(v) : NaN;
export type Freshness = "fresh" | "stale" | "unknown";
export function freshness(
  at: unknown,
  now: number,
  threshold = 30_000,
): Freshness {
  const t = time(at);
  return !Number.isFinite(t) || t > now + 5_000
    ? "unknown"
    : now - t > threshold
      ? "stale"
      : "fresh";
}
export interface Source {
  name: string;
  path: string;
  status: "ok" | "missing" | "error";
  observedAt: string | null;
  modifiedAt: string | null;
  detail: string;
}
export interface Evidence {
  id: string;
  path: string;
  title: string;
  kind: string;
  sha256?: string;
  integrity: "matched" | "changed" | "unavailable" | "unbound";
}
export interface Agent {
  id: string;
  name: string;
  role: string;
  task: string;
  activity: string;
  pane: string;
  lastObserved: string | null;
  since: string | null;
  freshness: Freshness;
  source: string;
  focusable: boolean;
  nativeSession: string;
  assignmentCorrelated: boolean;
}
export type Stage =
  "queued" | "running" | "awaiting verification" | "blocked" | "accepted";
export interface Task {
  id: string;
  title: string;
  agent: string;
  role: string;
  stage: Stage;
  at: string;
  source: string;
  evidence: string[];
  assessment: string;
  head: string;
}
export interface TimelineEvent {
  id: string;
  at: string;
  kind: string;
  title: string;
  detail: string;
  source: string;
  seq: number;
  evidence: string[];
}
export interface Attention {
  id: string;
  task: string;
  title: string;
  context: string;
  kind: string;
  status: string;
  until: string;
  action: string;
  source: string;
}
export interface Dashboard {
  project: string;
  session: string;
  generatedAt: string;
  demo: boolean;
  agents: Agent[];
  tasks: Task[];
  events: TimelineEvent[];
  attention: Attention[];
  evidence: Evidence[];
  sources: Source[];
  diagnostics: string[];
  watcher: string;
  ledger: string;
  beans: { id: string; title: string; status: string }[];
}
export interface Inputs {
  project: string;
  session: string;
  now: number;
  demo: boolean;
  state?: Row;
  supervision?: Row;
  attention?: Row;
  live?: Row;
  liveAt?: string;
  sources: Source[];
  evidence: Evidence[];
  ledger?: string;
  beans?: Dashboard["beans"];
  diagnostics?: string[];
}

export function orderEvents(events: TimelineEvent[]): TimelineEvent[] {
  // Timestamp is cross-source chronology; sequence is the stable tie-break within a stream.
  return [...events].sort(
    (a, b) =>
      (Number.isFinite(time(b.at)) ? time(b.at) : -Infinity) -
        (Number.isFinite(time(a.at)) ? time(a.at) : -Infinity) ||
      b.seq - a.seq ||
      a.id.localeCompare(b.id),
  );
}

/** Replay attention's append-only lifecycle; presentation never resolves an obligation. */
export function replayAttention(document: Row, source: string): Attention[] {
  const entries = new Map<string, Attention & { revision: number }>();
  const ids = new Set<string>();
  let previous = -Infinity;
  for (const e of rows(document.events)) {
    const d = object(e.data),
      id = str(d.id),
      eventId = str(e.event_id),
      at = time(e.at);
    if (
      e.schema_version !== 1 ||
      !eventId ||
      ids.has(eventId) ||
      !Number.isFinite(at) ||
      at < previous
    )
      throw Error("Invalid attention event chronology/version");
    ids.add(eventId);
    previous = at;
    if (e.action === "record") {
      if (!id || entries.has(id) || !str(d.title) || !str(d.kind))
        throw Error("Invalid attention creation");
      entries.set(id, {
        id,
        task: str(d.task),
        title: str(d.title),
        context: str(d.context),
        kind: str(d.kind),
        status: "open",
        until: "",
        action: str(d.resolution_condition),
        source,
        revision: 1,
      });
    } else if (e.action === "update") {
      const entry = entries.get(id);
      if (!entry || d.expected_revision !== entry.revision)
        throw Error("Attention revision mismatch");
      switch (d.action) {
        case "present":
          break;
        case "resolve": {
          const evidence = object(d.evidence);
          const allowed: Record<string, string[]> = {
            question: ["user_answer"],
            decision: ["user_answer"],
            review: ["review_outcome"],
            blocker: ["user_answer", "acknowledgement", "verified_outcome"],
            failure: [
              "user_answer",
              "acknowledgement",
              "delivery",
              "verified_outcome",
            ],
            followup: ["delivery"],
            update: ["delivery"],
          };
          if (
            evidence.schema_version !== 1 ||
            !str(evidence.ref) ||
            !str(evidence.summary) ||
            !allowed[entry.kind]?.includes(str(evidence.kind))
          )
            throw Error("Invalid attention resolution evidence");
          entry.status = "resolved";
          break;
        }
        case "supersede":
          entry.status = "superseded";
          break;
        case "defer":
          if (!Number.isFinite(time(d.until)))
            throw Error("Invalid attention deferral");
          entry.status = "deferred";
          entry.until = str(d.until);
          break;
        case "reopen":
          entry.status = "open";
          entry.until = "";
          break;
        case "amend": {
          const c = object(d.changes);
          entry.title = str(c.title, entry.title);
          entry.context = str(c.context, entry.context);
          entry.action = str(c.resolution_condition, entry.action);
          break;
        }
        default:
          throw Error("Unknown attention update");
      }
      entry.revision++;
    } else if (e.action !== "progress") throw Error("Unknown attention action");
  }
  return [...entries.values()].filter(
    (e) => e.status !== "resolved" && e.status !== "superseded",
  );
}

export function normalize(input: Inputs): Dashboard {
  const { now, project, session } = input,
    evidence = input.evidence;
  const diagnostics = [...(input.diagnostics ?? [])];
  const sources = input.sources;
  const sourcePath = (name: string) =>
    sources.find((s) => s.name === name)?.path ?? name;
  const state = input.state ?? {},
    sup = input.supervision ?? {};
  const assignments = rows(state.assignments);
  const members = rows(sup.members);
  const live = rows(object(object(input.live?.result).snapshot).agents);
  const measured = rows(state.snapshots).at(-1) ?? {};
  const savedAgents = object(measured.agents);
  const agents: Agent[] = [];
  const tasks: Task[] = [];
  const events: TimelineEvent[] = [];
  const evIds = (paths: unknown[]) =>
    evidence.filter((e) => paths.includes(e.path)).map((e) => e.id);
  const lastAssignments = new Map<string, Row>();
  for (const a of assignments) {
    const name = str(a.agent),
      prior = lastAssignments.get(name);
    if (!prior || time(a.at) >= time(prior.at)) lastAssignments.set(name, a);
  }
  const names = new Set([
    ...live.map((a) => str(a.name, str(a.pane_id))),
    ...lastAssignments.keys(),
    ...Object.keys(savedAgents),
  ]);
  for (const name of names) {
    const a = lastAssignments.get(name) ?? {};
    const assignmentIndex = assignments.indexOf(a);
    const dispatch = rows(object(state.recovery).dispatches).find(
      (d) =>
        d.assignment_index === assignmentIndex ||
        object(d.result).assignment_index === assignmentIndex,
    );
    const member = members.find((m) => m.id === dispatch?.id);
    const expectedSession = object(
      rows(member?.refinements).at(-1)?.native_session ??
        object(member?.assignment).native_session ??
        a.context_session,
    );
    const pane = str(
      object(member?.assignment).pane_id,
      str(object(a.context_session).pane_id),
    );
    // Pane correlation is only allowed when the native session matches; names are unique live identities.
    const l =
      live.find(
        (l) =>
          l.name === name ||
          (l.pane_id === pane &&
            object(l.agent_session).value &&
            object(l.agent_session).value === expectedSession.value),
      ) ?? live.find((l) => !l.name && l.pane_id === name);
    const assignmentCorrelated =
      !!l &&
      !!expectedSession.value &&
      object(l.agent_session).value === expectedSession.value;
    const saved = object(savedAgents[name]);
    const observed = l
      ? (input.liveAt ?? null)
      : str(measured.measured_at) || null;
    const activity = l
      ? str(l.agent_status, "unknown")
      : str(saved.state, "unobserved");
    agents.push({
      id: l ? str(l.pane_id) : name,
      name,
      role:
        l && !assignmentCorrelated ? "Unassigned" : str(a.role, "Unassigned"),
      task:
        l && !assignmentCorrelated
          ? "No correlated assignment"
          : str(a.task, "No recorded assignment"),
      activity,
      pane: l ? str(l.pane_id) : pane,
      lastObserved: observed,
      since: str(a.at) || null,
      freshness: freshness(observed, now),
      source: sourcePath(l ? "Herdr" : "Teamlead"),
      focusable: !!l && !!str(object(l.agent_session).value) && !input.demo,
      nativeSession: str(object(l?.agent_session).value),
      assignmentCorrelated,
    });
  }
  for (const [i, a] of assignments.entries()) {
    const name = str(a.agent),
      task = str(a.task, "Unlabelled assignment");
    if (!name) continue;
    // Owner dispatch index, not a guessed agent/task pairing, binds historical enrollment.
    const dispatch = rows(object(state.recovery).dispatches).find(
      (d) =>
        object(d.result).assignment_index === i || d.assignment_index === i,
    );
    const member = members.find((m) => m.id === dispatch?.id);
    const assignment = object(member?.assignment),
      resolution = object(member?.resolution),
      observed = object(member?.observed);
    const report = object(observed.report),
      receipts = rows(resolution.evidence);
    const boundEvidence = evidence.filter((e) =>
      receipts.some((r) => r.path === e.path && r.sha256 === e.sha256),
    );
    const accepted =
      a.status === "applied" &&
      dispatch?.status === "applied" &&
      dispatch.agent === name &&
      dispatch.task === a.task &&
      dispatch.role === a.role &&
      assignment.agent === name &&
      assignment.task === a.task &&
      member?.active === false &&
      resolution.schema_version === 1 &&
      resolution.outcome === "accepted" &&
      receipts.length > 0 &&
      boundEvidence.length === receipts.length &&
      boundEvidence.every((e) => e.integrity === "matched");
    const agent = agents.find((g) => g.name === name);
    const isLatest = lastAssignments.get(name) === a;
    const blocked =
      isLatest &&
      agent?.assignmentCorrelated &&
      agent.freshness === "fresh" &&
      agent.activity === "blocked";
    let stage: Stage = accepted
      ? "accepted"
      : blocked
        ? "blocked"
        : a.status !== "applied"
          ? "queued"
          : isLatest &&
              agent?.assignmentCorrelated &&
              agent.activity === "working" &&
              agent.freshness === "fresh"
            ? "running"
            : "awaiting verification";
    if (resolution.outcome === "blocked") stage = "blocked";
    const paths = [
      assignment.report,
      report.path,
      ...receipts.map((r) => r.path),
    ];
    const id = str(dispatch?.id, `assignment-${i}`);
    const assessment = accepted
      ? "Explicit assignment acceptance; recorded evidence bytes match. Task-wide acceptance remains unknown."
      : str(resolution.outcome)
        ? `Recorded resolution: ${str(resolution.outcome)}${resolution.outcome === "accepted" ? " · evidence unavailable or changed; acceptance unverified" : " · acceptance unclassified"}`
        : "Acceptance unverified. Lifecycle and report presence do not establish acceptance.";
    tasks.push({
      id,
      title: task,
      agent: name,
      role: str(a.role, "Unknown"),
      stage,
      at: str(a.at),
      source: sourcePath("Teamlead"),
      evidence: evIds(paths),
      assessment,
      head: str(object(dispatch?.report).head_revision),
    });
    events.push({
      id: `dispatch-${i}`,
      at: str(a.at),
      kind: "dispatch",
      title: `${name} → ${str(a.role)}`,
      detail: `${task} · ${str(a.status)}`,
      source: sourcePath("Teamlead"),
      seq: i,
      evidence: evIds(paths),
    });
    if (resolution.at)
      events.push({
        id: `resolution-${id}`,
        at: str(resolution.at),
        kind: "decision",
        title: `Resolution · ${name}`,
        detail: str(resolution.outcome),
        source: sourcePath("Supervision"),
        seq: i,
        evidence: evIds(paths),
      });
  }
  for (const e of rows(sup.events))
    events.push({
      id: `supervision-${str(e.id)}`,
      at: str(e.at),
      kind: str(e.kind),
      title: str(e.kind).replaceAll("_", " "),
      detail: JSON.stringify(e.data ?? {}),
      source: sourcePath("Supervision"),
      seq: typeof e.seq === "number" ? e.seq : 0,
      evidence: [],
    });
  for (const e of rows(input.attention?.events))
    events.push({
      id: `attention-${str(e.event_id)}`,
      at: str(e.at),
      kind: e.action === "progress" ? "report" : "attention",
      title: str(
        object(e.data).title,
        str(
          object(e.data).summary,
          str(object(e.data).action, "Attention recorded"),
        ),
      ),
      detail: str(object(e.data).assessment, str(object(e.data).context)),
      source: sourcePath("Attention"),
      seq: 0,
      evidence: [],
    });
  for (const e of rows(object(state.recovery).events))
    events.push({
      id: `recovery-${str(e.id, String(events.length))}`,
      at: str(e.at),
      kind: str(e.kind, "correction"),
      title: str(e.kind, "Recovery decision").replaceAll("_", " "),
      detail: JSON.stringify(e),
      source: sourcePath("Teamlead"),
      seq: 0,
      evidence: [],
    });
  let attention: Attention[] = [];
  if (input.attention)
    try {
      attention = replayAttention(input.attention, sourcePath("Attention"));
    } catch (e) {
      diagnostics.push(String(e));
      const source = sources.find((s) => s.name === "Attention");
      if (source) {
        source.status = "error";
        source.detail = String(e);
      }
    }
  const watchers = rows(sup.watchers),
    watcher = [...watchers].sort((a, b) => time(b.at) - time(a.at))[0];
  const watcherStatus = !watcher
    ? "No watcher recorded"
    : watcher.status !== "running"
      ? "Watcher stopped"
      : freshness(watcher.heartbeat, now) !== "fresh" ||
          time(watcher.deadline) <= now
        ? "Watcher heartbeat stale or deadline expired"
        : "Fresh heartbeat · process identity not independently checked";
  const uniqueAgents = agents.filter(
    (a) =>
      !agents.some(
        (other) =>
          other !== a &&
          other.pane &&
          other.pane === a.pane &&
          other.assignmentCorrelated &&
          !a.assignmentCorrelated,
      ),
  );
  return {
    project,
    session,
    generatedAt: new Date(now).toISOString(),
    demo: input.demo,
    agents: uniqueAgents,
    tasks,
    events: orderEvents(events).slice(0, 500),
    attention,
    evidence,
    sources,
    diagnostics,
    watcher: watcherStatus,
    ledger: input.ledger ?? "",
    beans: input.beans ?? [],
  };
}
