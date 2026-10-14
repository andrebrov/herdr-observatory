import { describe, it, expect } from "vitest";
import {
  normalize,
  freshness,
  orderEvents,
  replayAttention,
  type Inputs,
  type Row,
  type TimelineEvent,
} from "./domain.js";
const now = Date.parse("2026-10-14T05:30:00Z");
const at = "2026-10-14T05:29:00Z";
function fixture(): Inputs {
  return {
    project: "/fixture",
    session: "default",
    now,
    demo: true,
    sources: [],
    state: {
      assignments: [
        {
          schema_version: 6,
          agent: "atlas",
          role: "developer",
          task: "task",
          at,
          status: "applied",
        },
      ],
      recovery: {
        dispatches: [
          {
            id: "dispatch-1",
            agent: "atlas",
            role: "developer",
            task: "task",
            status: "applied",
            assignment_index: 0,
          },
        ],
      },
    },
    supervision: {
      members: [
        {
          schema_version: 1,
          id: "dispatch-1",
          assignment: {
            agent: "atlas",
            task: "task",
            pane_id: "w1:p1",
            native_session: { value: "session-1" },
          },
          active: false,
          observed: { report: { present: true } },
          resolution: {
            schema_version: 1,
            at,
            outcome: "accepted",
            evidence: [{ path: "/fixture/report.md", sha256: "a".repeat(64) }],
          },
        },
      ],
    },
    live: {
      result: {
        snapshot: {
          agents: [
            {
              name: "atlas",
              pane_id: "w1:p1",
              agent_status: "idle",
              agent_session: { value: "session-1" },
            },
          ],
        },
      },
    },
    liveAt: new Date(now).toISOString(),
    evidence: [
      {
        id: "e1",
        path: "/fixture/report.md",
        title: "report.md",
        kind: "md",
        sha256: "a".repeat(64),
        integrity: "matched",
      },
    ],
  };
}
function member(f: Inputs): Row {
  return (f.supervision!.members as Row[])[0];
}
describe("acceptance semantics", () => {
  it("requires an explicit bound assignment resolution and matching evidence", () => {
    expect(normalize(fixture()).tasks[0].stage).toBe("accepted");
  });
  it.each(["idle", "done", "working"])(
    "does not accept %s, report presence, or green build",
    (activity) => {
      const f = fixture();
      delete member(f).resolution;
      f.live = {
        result: {
          snapshot: {
            agents: [
              {
                name: "atlas",
                pane_id: "w1:p1",
                agent_status: activity,
                build: "green",
              },
            ],
          },
        },
      };
      expect(normalize(f).tasks[0].stage).not.toBe("accepted");
    },
  );
  it.each(["changed", "unavailable", "unbound"] as const)(
    "does not accept %s evidence",
    (integrity) => {
      const f = fixture();
      f.evidence[0].integrity = integrity;
      expect(normalize(f).tasks[0].stage).toBe("awaiting verification");
    },
  );
  it("never interprets prose as acceptance", () => {
    const f = fixture();
    (member(f).resolution as Row).outcome = "Lead verified and accepted";
    expect(normalize(f).tasks[0].stage).toBe("awaiting verification");
  });
  it("does not accept an active enrollment", () => {
    const f = fixture();
    member(f).active = true;
    expect(normalize(f).tasks[0].stage).not.toBe("accepted");
  });
  it("does not bind a different dispatch or worker", () => {
    const f = fixture();
    member(f).id = "other";
    expect(normalize(f).tasks[0].stage).not.toBe("accepted");
    member(f).id = "dispatch-1";
    (member(f).assignment as Row).agent = "other";
    expect(normalize(f).tasks[0].stage).not.toBe("accepted");
  });
  it("does not accept a queued dispatch even with a resolution", () => {
    const f = fixture();
    (f.state!.assignments as Row[])[0].status = "sent_but_not_started";
    expect(normalize(f).tasks[0].stage).toBe("queued");
  });
  it("keeps old acceptance separate from a later correction", () => {
    const f = fixture();
    (f.state!.assignments as Row[]).push({
      schema_version: 6,
      agent: "atlas",
      role: "developer",
      task: "task",
      status: "applied",
      at: "2026-10-14T05:29:30Z",
    });
    const d = normalize(f);
    expect(d.tasks.map((t) => t.stage)).toEqual([
      "accepted",
      "awaiting verification",
    ]);
  });
});
describe("freshness and normalization", () => {
  it("labels invalid, missing and future clocks unknown", () => {
    expect(freshness(undefined, now)).toBe("unknown");
    expect(freshness("bad", now)).toBe("unknown");
    expect(freshness("2026-10-14T07:00:00Z", now)).toBe("unknown");
    expect(freshness("2026-10-14T05:30:00", now)).toBe("unknown");
  });
  it("uses observation time, not file reading time", () => {
    expect(freshness(at, now)).toBe("stale");
    expect(freshness("2026-10-14T05:29:45Z", now)).toBe("fresh");
  });
  it("does not show stale working agents as running", () => {
    const f = fixture();
    delete member(f).resolution;
    f.liveAt = at;
    f.live = {
      result: {
        snapshot: {
          agents: [
            {
              name: "atlas",
              agent_status: "working",
              pane_id: "w1:p1",
              agent_session: { value: "session-1" },
            },
          ],
        },
      },
    };
    expect(normalize(f).tasks[0].stage).toBe("awaiting verification");
    expect(normalize(f).agents[0].freshness).toBe("stale");
  });
  it("never attaches an old task to a new native session with the same name", () => {
    const f = fixture();
    delete member(f).resolution;
    f.live = {
      result: {
        snapshot: {
          agents: [
            {
              name: "atlas",
              agent_status: "working",
              pane_id: "w1:p1",
              agent_session: { value: "new-session" },
            },
          ],
        },
      },
    };
    const d = normalize(f);
    expect(d.agents[0].task).toBe("No correlated assignment");
    expect(d.tasks[0].stage).toBe("awaiting verification");
  });
  it("handles missing sources without inventing acceptance", () => {
    const d = normalize({
      project: "/fixture",
      session: "default",
      now,
      demo: false,
      sources: [],
      evidence: [],
    });
    expect(d.tasks).toEqual([]);
    expect(d.watcher).toBe("No watcher recorded");
  });
  it("resolves latest assignment by event chronology without reordering indices", () => {
    const f = fixture();
    (f.state!.assignments as Row[]).unshift({
      agent: "atlas",
      role: "reviewer",
      at: "2026-10-14T05:29:59Z",
      task: "newer",
    });
    expect(normalize(f).agents[0].role).toBe("reviewer");
  });
  it("orders events by time, then source sequence, then stable ID", () => {
    const e = (id: string, at: string, seq: number): TimelineEvent => ({
      id,
      at,
      seq,
      kind: "report",
      title: "",
      detail: "",
      source: "s",
      evidence: [],
    });
    expect(
      orderEvents([
        e("a", at, 1),
        e("b", at, 3),
        e("c", "2026-10-14T05:30:00Z", 1),
      ]).map((e) => e.id),
    ).toEqual(["c", "b", "a"]);
  });
});
describe("attention replay", () => {
  const record = {
    schema_version: 1,
    event_id: "record:q",
    at,
    action: "record",
    data: {
      id: "q",
      kind: "question",
      title: "Question",
      task: "task",
      context: "Context",
      resolution_condition: "Answer",
    },
  };
  const update = (action: string, revision: number, extra: Row = {}) => ({
    schema_version: 1,
    event_id: action,
    at,
    action: "update",
    data: {
      id: "q",
      action,
      expected_revision: revision,
      evidence: {
        schema_version: 1,
        kind: "user_answer",
        ref: "message-1",
        summary: "Operator answered",
      },
      ...extra,
    },
  });
  it("displaying a question does not resolve it", () => {
    expect(
      replayAttention({ events: [record, update("present", 1)] }, "source")[0]
        .status,
    ).toBe("open");
  });
  it("replays deferral, resolution, and reopening without changing history", () => {
    const doc = {
      events: [
        record,
        update("defer", 1, { until: "2026-10-15T00:00:00Z" }),
        update("resolve", 2),
        update("reopen", 3),
      ],
    };
    const before = JSON.stringify(doc);
    expect(replayAttention(doc, "source")[0].status).toBe("open");
    expect(JSON.stringify(doc)).toBe(before);
  });
  it("rejects unknown actions and revision mismatches", () => {
    expect(() =>
      replayAttention({ events: [record, update("resolve", 9)] }, "source"),
    ).toThrow();
    expect(() =>
      replayAttention({ events: [record, update("invented", 1)] }, "source"),
    ).toThrow();
  });
});
