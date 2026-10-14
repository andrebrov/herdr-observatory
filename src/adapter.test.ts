import { describe, it, expect } from "vitest";
import {
  realpath,
  mkdtemp,
  writeFile,
  readFile,
  mkdir,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { Adapter, allowedFile, type Config } from "./adapter.js";
import { evidencePayload, handleAction } from "./actions.js";
import { parseConfig, bridgeCall } from "./cli.js";
const demo = resolve("fixtures/demo"),
  config: Config = {
    projects: [demo],
    sessions: ["default"],
    state: resolve(demo, "state.json"),
    demo: true,
    evidenceRoots: [],
    ledger: resolve(demo, "TASK-LEDGER.md"),
  };
describe("read-only adapter", () => {
  it("loads portable demo fixtures with all five stages and no live commands", async () => {
    const d = await new Adapter(config).snapshot(demo, "default");
    expect(d.tasks.map((t) => t.stage)).toEqual([
      "accepted",
      "awaiting verification",
      "running",
      "blocked",
      "queued",
    ]);
    expect(d.attention).toHaveLength(2);
    expect(d.diagnostics).toEqual([]);
    expect(d.evidence.some((e) => e.integrity === "matched")).toBe(true);
  });
  it("survives missing, partial and future-schema files without writing or retaining acceptance", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "observatory-readonly-"));
    try {
      const state = resolve(dir, "state.json"),
        a = new Adapter({
          ...config,
          state,
          ledger: undefined,
          projects: [dir],
        });
      expect(
        (await a.snapshot(dir, "default")).sources.find(
          (s) => s.name === "Teamlead",
        )?.status,
      ).toBe("missing");
      for (const bytes of ['{"schema_version":6,', '{"schema_version":999}']) {
        await writeFile(state, bytes);
        const d = await a.snapshot(dir, "default");
        expect(d.tasks).toEqual([]);
        expect(d.sources.find((s) => s.name === "Teamlead")?.status).toBe(
          "error",
        );
        expect(await readFile(state, "utf8")).toBe(bytes);
      }
    } finally {
      await rm(dir, { recursive: true });
    }
  });
  it("rejects evidence outside roots and escaping symlinks", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "observatory-path-"));
    try {
      const root = resolve(dir, "root");
      await mkdir(root);
      const outside = resolve(dir, "secret.md");
      await writeFile(outside, "private");
      await symlink(outside, resolve(root, "escape.md"));
      await expect(allowedFile(outside, [root])).rejects.toThrow("outside");
      await expect(
        allowedFile(resolve(root, "escape.md"), [root]),
      ).rejects.toThrow("outside");
      await writeFile(resolve(root, "safe.md"), "safe");
      expect(await allowedFile(resolve(root, "safe.md"), [root])).toBe(
        await realpath(resolve(root, "safe.md")),
      );
    } finally {
      await rm(dir, { recursive: true });
    }
  });
  it("opens text as inert bytes and rejects arbitrary actions, IDs and demo focus", async () => {
    const d = await new Adapter(config).snapshot(demo, "default");
    const report = d.evidence.find((e) => e.title === "design-notes.md")!;
    const p = await evidencePayload(report.id, d, config);
    expect("text" in p && p.text).toContain("<script>");
    await expect(
      handleAction({ action: "dispatch" }, d, config),
    ).rejects.toThrow("Unsupported");
    await expect(evidencePayload("../secret", d, config)).rejects.toThrow(
      "Unknown",
    );
    await expect(
      handleAction({ action: "focus", id: "w1:p1" }, d, config),
    ).rejects.toThrow("disabled");
  });
  it("does not mutate any source bytes on repeated reads", async () => {
    const paths = [
      "state.json",
      "state.json.attention.json",
      "state.json.supervision.json",
      "TASK-LEDGER.md",
    ].map((p) => resolve(demo, p));
    const digest = async () =>
      Promise.all(
        paths.map(async (p) =>
          createHash("sha256")
            .update(await readFile(p))
            .digest("hex"),
        ),
      );
    const before = await digest();
    const adapter = new Adapter(config);
    await adapter.snapshot(demo, "default");
    await adapter.snapshot(demo, "default");
    expect(await digest()).toEqual(before);
  });
});
describe("CLI and native bridge", () => {
  it("requires explicit live paths and supports configured selectors", () => {
    expect(() => parseConfig([])).toThrow("requires");
    expect(parseConfig(["--demo"]).demo).toBe(true);
    expect(
      parseConfig([
        "--project",
        "/one",
        "--project",
        "/two",
        "--state",
        "/state",
        "--session",
        "one",
        "--session",
        "two",
      ]).sessions,
    ).toEqual(["one", "two"]);
  });
  it("serializes untrusted content as data in a fixed receiver", () => {
    const js = bridgeCall("notice", '</script>";globalThis.pwned=true;//');
    let received = "";
    const fake = {
      observatory: {
        notice: (s: string) => {
          received = s;
        },
      },
    };
    new Function("window", js)(fake);
    expect(received).toBe('</script>";globalThis.pwned=true;//');
    expect(js).not.toContain("</script>");
  });
});

describe("source recovery and action boundaries", () => {
  it("withdraws acceptance when evidence changes and recovers when original bytes return", async () => {
    const { cp } = await import("node:fs/promises");
    const dir = await mkdtemp(resolve(tmpdir(), "observatory-integrity-"));
    try {
      await cp(demo, dir, { recursive: true });
      const local = {
        ...config,
        projects: [dir],
        state: resolve(dir, "state.json"),
        ledger: undefined,
      };
      const a = new Adapter(local),
        path = resolve(dir, "reports/adapter-review.md"),
        original = await readFile(path);
      expect((await a.snapshot(dir, "default")).tasks[0].stage).toBe(
        "accepted",
      );
      await writeFile(path, "Changed report");
      expect((await a.snapshot(dir, "default")).tasks[0].stage).toBe(
        "awaiting verification",
      );
      await writeFile(path, original);
      expect((await a.snapshot(dir, "default")).tasks[0].stage).toBe(
        "accepted",
      );
      const sup = JSON.parse(
        await readFile(resolve(dir, "state.json.supervision.json"), "utf8"),
      );
      sup.members[0].resolution.schema_version = 2;
      await writeFile(
        resolve(dir, "state.json.supervision.json"),
        JSON.stringify(sup),
      );
      const d = await a.snapshot(dir, "default");
      expect(d.tasks[0].stage).not.toBe("accepted");
      expect(d.sources.find((s) => s.name === "Supervision")?.status).toBe(
        "error",
      );
    } finally {
      await rm(dir, { recursive: true });
    }
  });
  it("renders valid images and rejects spoofed image and executable evidence", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "observatory-image-"));
    try {
      const a = new Adapter(config),
        d = await a.snapshot(demo, "default");
      d.project = dir;
      const add = (file: string) => {
        const e = {
          id: "custom",
          path: resolve(dir, file),
          title: file,
          kind: "image",
          integrity: "unbound" as const,
        };
        d.evidence = [e];
        return e;
      };
      const image = add("screenshot.png");
      await writeFile(
        image.path,
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
          "base64",
        ),
      );
      expect(await evidencePayload("custom", d, config)).toHaveProperty(
        "image",
      );
      await writeFile(image.path, "<html>not an image</html>");
      await expect(evidencePayload("custom", d, config)).rejects.toThrow(
        "signature",
      );
      const html = add("report.html");
      await writeFile(html.path, "<script>bad()</script>");
      await expect(evidencePayload("custom", d, config)).rejects.toThrow(
        "Unsupported evidence",
      );
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

it("limits shared assignment, attention, event and evidence history by exact task without changing dispatch indices", async () => {
  const d = await new Adapter({
    ...config,
    task: "Read-only data adapter",
    ledger: undefined,
  }).snapshot(demo, "default");
  expect(d.tasks).toHaveLength(1);
  expect(d.tasks[0].id).toBe("demo-0");
  expect(d.tasks[0].stage).toBe("accepted");
  expect(d.attention).toEqual([]);
  expect(
    d.events.some(
      (e) =>
        e.title.includes("nova") || e.detail.includes("Session history policy"),
    ),
  ).toBe(false);
  expect(d.evidence.some((e) => e.title === "design-notes.md")).toBe(false);
});

it("keeps local-file validation available when a Markdown preview exceeds its token budget", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "observatory-markdown-limit-"));
  try {
    const d = await new Adapter(config).snapshot(demo, "default");
    d.project = dir;
    const path = resolve(dir, "complex.md"),
      text = "- item\n".repeat(30_000);
    await writeFile(path, text);
    d.evidence = [
      {
        id: "complex",
        path,
        title: "complex.md",
        kind: "md",
        integrity: "unbound",
      },
    ];
    await expect(evidencePayload("complex", d, config)).rejects.toThrow(
      "too complex",
    );
    expect(await evidencePayload("complex", d, config, false)).toHaveProperty(
      "text",
      text,
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});
