import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function main() {
  const temp = await mkdtemp(join(tmpdir(), "observatory-package-"));
  try {
    const packed = await exec(
      "npm",
      ["pack", "--json", "--pack-destination", temp],
      { cwd: root, timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
    );
    const records = JSON.parse(packed.stdout) as {
      filename: string;
      files: { path: string }[];
    }[];
    assert.equal(records.length, 1);
    const paths = records[0].files.map((f) => f.path);
    for (const required of [
      "bin/herdr-observatory.mjs",
      "dist/cli.js",
      "dist/presentation.js",
      "ui/index.html",
      "fixtures/demo/state.json",
    ])
      assert(paths.includes(required), `Package missing ${required}`);
    assert(
      !paths.some(
        (p) =>
          p.startsWith("src/") ||
          p.startsWith(".beans/") ||
          p.endsWith(".test.js") ||
          p.endsWith(".ts") ||
          p.startsWith("docs/screenshots/") ||
          p === "AGENTS.md",
      ),
      "Package leaked development content",
    );
    const consumer = join(temp, "consumer");
    await mkdir(consumer);
    const options = {
      cwd: consumer,
      timeout: 120000,
      maxBuffer: 8 * 1024 * 1024,
    };
    const prefix = [
      "exec",
      "--yes",
      "--cache",
      join(temp, "cache"),
      "--package",
      join(temp, records[0].filename),
      "--",
      "herdr-observatory",
    ];
    const output = await exec(
      "npm",
      [...prefix, "--demo", "--snapshot"],
      options,
    );
    const dashboard = JSON.parse(output.stdout) as {
      tasks: { stage: string }[];
      diagnostics: string[];
    };
    assert.deepEqual(
      dashboard.tasks.map((t) => t.stage),
      ["accepted", "awaiting verification", "running", "blocked", "queued"],
    );
    assert.deepEqual(dashboard.diagnostics, []);
    const help = await exec("npm", [...prefix, "--help"], options);
    assert(help.stdout.includes("herdr-observatory --project"));
    await assert.rejects(
      () => exec("npm", prefix, options),
      /requires --project PATH and --state FILE/,
    );
    // Native UI assets must resolve from the installed package, not this source tree.
    const installedRoot = JSON.parse(output.stdout).project as string;
    const packageRoot = resolve(installedRoot, "../..");
    const html = await exec(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const {dashboardHTML}=await import(${JSON.stringify("file://" + join(packageRoot, "dist/presentation.js"))});const html=await dashboardHTML();if(!html.includes('function morphdom')||!html.includes('Herdr Observatory'))process.exit(1);`,
      ],
      options,
    );
    assert.equal(html.stderr, "");
    console.log(
      `Package smoke passed: ${paths.length} files; npm exec from an empty directory; five board states; portable local UI/fixtures; help and missing-path validation; no development artifacts.`,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
