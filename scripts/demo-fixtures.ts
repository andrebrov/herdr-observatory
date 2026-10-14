import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
export async function main() {
  const dir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../fixtures/demo",
  );
  const at = "2026-10-14T05:30:00Z";
  /** Generated paths are portable placeholders, expanded read-only by the demo adapter. */
  const assignments = [
    {
      agent: "atlas",
      role: "architect",
      task: "Read-only data adapter",
      at: "2026-10-14T05:02:00Z",
    },
    {
      agent: "nova",
      role: "designer",
      task: "Native dashboard surfaces",
      at: "2026-10-14T05:12:00Z",
    },
    {
      agent: "sage",
      role: "tester",
      task: "Acceptance & freshness tests",
      at: "2026-10-14T05:18:00Z",
    },
    {
      agent: "ember",
      role: "developer",
      task: "Session history policy",
      at: "2026-10-14T05:21:00Z",
    },
    {
      agent: "quill",
      role: "documentation",
      task: "Launch guide & architecture",
      at: "2026-10-14T05:25:00Z",
    },
  ].map((a) => ({
    schema_version: 6,
    ...a,
    status: a.agent === "quill" ? "sent_but_not_started" : "applied",
    context_session: null,
  }));
  const receipt = async (file: string) => {
    const b = await readFile(resolve(dir, file));
    return {
      schema_version: 1,
      path: "$DEMO/" + file,
      sha256: createHash("sha256").update(b).digest("hex"),
      size: b.length,
    };
  };
  const members = await Promise.all(
    assignments.map(async (a, i) => ({
      schema_version: 1,
      id: "demo-" + i,
      at: a.at,
      assignment: {
        id: "demo-" + i,
        agent: a.agent,
        task: a.task,
        report:
          "$DEMO/reports/" +
          (i === 0
            ? "adapter-review.md"
            : i === 1
              ? "design-notes.md"
              : "test-results.txt"),
        pane_id: "w1:p" + (i + 1),
        native_session: { kind: "id", value: "demo-session-" + i },
      },
      active: i !== 0,
      observed: {
        report: { present: i < 2 },
        lifecycle: {
          status: i === 2 ? "working" : i === 3 ? "blocked" : "idle",
        },
      },
      resolution:
        i === 0
          ? {
              schema_version: 1,
              at: "2026-10-14T05:26:00Z",
              outcome: "accepted",
              evidence: [
                await receipt("reports/adapter-review.md"),
                await receipt("reports/test-results.txt"),
              ],
            }
          : null,
      refinements: [],
    })),
  );
  const events = [
    {
      kind: "dispatch_observed",
      member: "demo-2",
      at: "2026-10-14T05:18:00Z",
      data: { agent: "sage", role: "tester" },
    },
    {
      kind: "report_observed",
      member: "demo-1",
      at: "2026-10-14T05:24:00Z",
      data: { report: "design-notes.md", acceptance: "unverified" },
    },
    {
      kind: "finding_observed",
      member: "demo-2",
      at: "2026-10-14T05:27:00Z",
      data: { finding: "Idle must never imply accepted" },
    },
    {
      kind: "correction_observed",
      member: "demo-2",
      at: "2026-10-14T05:28:00Z",
      data: { correction: "Separate elapsed time from observed freshness" },
    },
    {
      kind: "blocker_observed",
      member: "demo-3",
      at: "2026-10-14T05:29:00Z",
      data: { blocker: "Retention policy needs an operator decision" },
    },
  ].map((e, i) => ({
    schema_version: 1,
    id: "event-" + (i + 1),
    seq: i + 1,
    ...e,
  }));
  const state = {
    schema_version: 6,
    assignments,
    snapshots: [],
    specialist_assessments: [],
    recovery: {
      schema_version: 9,
      dispatches: assignments.map((a, i) => ({
        schema_version: 1,
        id: "demo-" + i,
        agent: a.agent,
        role: a.role,
        task: a.task,
        status: a.status,
        assignment_index: i,
        result: { assignment_index: i },
        report:
          i === 0
            ? { head_revision: "7c91c06e4981a197cabf0bfa3027dd70b5c70f32" }
            : null,
      })),
      events: [],
    },
  };
  const supervision = {
    schema_version: 1,
    state_path: "$DEMO/state.json",
    binding: null,
    members,
    events,
    acknowledgements: [],
    holds: [],
    watchers: [
      {
        schema_version: 1,
        id: "demo-watch",
        at,
        heartbeat: at,
        deadline: "2026-10-14T06:00:00Z",
        status: "running",
        process: { pid: 1234, identity: "synthetic" },
      },
    ],
  };
  const attention = {
    schema_version: 1,
    state_path: "$DEMO/state.json",
    events: [
      {
        schema_version: 1,
        event_id: "record:retention",
        at: "2026-10-14T05:29:00Z",
        action: "record",
        data: {
          id: "retention",
          task: "Session history policy",
          kind: "decision",
          title: "How long should session history stay?",
          context:
            "The history adapter is waiting on a retention policy. Choose 7 or 30 days before implementation continues.",
          resolution_condition:
            "Answer in the Herdr lead pane. This dashboard never records your decision.",
          priority: 20,
          sources: [],
        },
      },
      {
        schema_version: 1,
        event_id: "record:review",
        at: "2026-10-14T05:24:00Z",
        action: "record",
        data: {
          id: "review",
          task: "Native dashboard surfaces",
          kind: "review",
          title: "Design report is ready for review",
          context:
            "Nova delivered the first layout and keyboard navigation notes. The report is available; acceptance is still unverified.",
          resolution_condition:
            "Inspect design-notes.md and record assessment through the lead.",
          priority: 40,
          sources: [],
        },
      },
    ],
  };
  attention.events.sort((a, b) => a.at.localeCompare(b.at));
  const live = {
    result: {
      snapshot: {
        agents: assignments.map((a, i) => ({
          name: a.agent,
          agent: "codex",
          pane_id: "w1:p" + (i + 1),
          cwd: "$DEMO",
          agent_session: { kind: "id", value: "demo-session-" + i },
          agent_status: i === 2 ? "working" : i === 3 ? "blocked" : "idle",
        })),
      },
    },
  };
  for (const [file, value] of Object.entries({
    "state.json": state,
    "state.json.supervision.json": supervision,
    "state.json.attention.json": attention,
    "live.json": live,
  }))
    await writeFile(resolve(dir, file), JSON.stringify(value, null, 2) + "\n");
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
