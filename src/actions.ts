import { markdownDocument } from "./markdown.js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extname, dirname } from "node:path";
import { allowedFile, type Config } from "./adapter.js";
import { object, str, type Dashboard } from "./domain.js";
const exec = promisify(execFile);
const textTypes = new Set([
  ".md",
  ".txt",
  ".json",
  ".jsonl",
  ".log",
  ".xml",
  ".csv",
  ".patch",
  ".diff",
  ".yml",
  ".yaml",
]);
const images: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};
export async function evidencePayload(
  id: string,
  dashboard: Dashboard,
  config: Config,
  includeMarkdown = true,
) {
  const evidence = dashboard.evidence.find((e) => e.id === id);
  if (!evidence) throw Error("Unknown evidence reference");
  const path = await allowedFile(evidence.path, [
    dashboard.project,
    dirname(config.state),
    ...config.evidenceRoots,
  ]);
  const extension = extname(path).toLowerCase();
  if (!textTypes.has(extension) && !images[extension])
    throw Error(
      "Unsupported evidence type; executable content is never rendered or opened",
    );
  const bytes = await readFile(path);
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  const observation = {
    readAt: new Date().toISOString(),
    actualSha256,
    integrity: evidence.sha256
      ? actualSha256 === evidence.sha256
        ? "matched"
        : "changed"
      : "unbound",
  };
  if (bytes.length > (images[extension] ? 8 : 2) * 1024 * 1024)
    throw Error("Viewer limit exceeded (2 MiB text / 8 MiB image)");
  if (images[extension]) {
    // Validate signatures before passing a data URL to the native webview.
    const valid =
      extension === ".png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : extension === ".webp"
          ? bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP"
          : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!valid) throw Error("Image signature does not match extension");
    return {
      id,
      path,
      title: evidence.title,
      ...observation,
      image: `data:${images[extension]};base64,${bytes.toString("base64")}`,
    };
  }
  return {
    id,
    path,
    title: evidence.title,
    ...observation,
    text: bytes.toString("utf8"),
    markdown:
      includeMarkdown && extension === ".md"
        ? markdownDocument(bytes.toString("utf8"), path, dashboard.evidence)
        : undefined,
  };
}
export async function handleAction(
  message: unknown,
  dashboard: Dashboard,
  config: Config,
) {
  const m = object(message),
    action = str(m.action),
    id = str(m.id);
  if (action === "readEvidence")
    return {
      kind: "evidence" as const,
      payload: await evidencePayload(id, dashboard, config),
    };
  if (action === "openEvidence") {
    const payload = await evidencePayload(id, dashboard, config, false);
    if (process.platform !== "darwin")
      throw Error("Open local file is currently supported on macOS");
    await exec("/usr/bin/open", [payload.path], { timeout: 3000 });
    return { kind: "notice" as const, payload: "Opened local evidence" };
  }
  if (action === "focus") {
    if (config.demo)
      throw Error("Pane focus is disabled in synthetic demo mode");
    const agent = dashboard.agents.find((a) => a.id === id);
    if (!agent?.focusable || !agent.pane)
      throw Error("No correlated live pane");
    // Revalidate the pane occupant against the current snapshot before explicit focus.
    const output = await exec(
      "herdr",
      ["--session", dashboard.session, "api", "snapshot"],
      { timeout: 2500, maxBuffer: 4 * 1024 * 1024 },
    );
    const snap = object(
      object(object(JSON.parse(output.stdout)).result).snapshot,
    );
    const agents = Array.isArray(snap.agents) ? snap.agents : [];
    const live = agents
      .map(object)
      .find(
        (a) =>
          a.pane_id === agent.pane &&
          (a.name === agent.name || (!a.name && a.pane_id === agent.name)) &&
          a.cwd === dashboard.project &&
          object(a.agent_session).value === agent.nativeSession,
      );
    if (!live)
      throw Error(
        "Pane occupant changed; refresh observations before focusing",
      );
    await exec(
      "herdr",
      ["--session", dashboard.session, "agent", "focus", agent.pane],
      { timeout: 2500, maxBuffer: 1024 * 1024 },
    );
    return {
      kind: "notice" as const,
      payload: `Focused ${agent.pane}. Herdr marks explicitly focused completions seen.`,
    };
  }
  throw Error("Unsupported action");
}
