import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { Adapter, type Config } from "../src/adapter.js";
import { dashboardHTML } from "../src/presentation.js";
import { evidencePayload } from "../src/actions.js";
export async function main() {
  const project = resolve("fixtures/demo");
  const config: Config = {
    projects: [project],
    sessions: ["Demo session"],
    state: resolve(project, "state.json"),
    demo: true,
    evidenceRoots: [],
    ledger: resolve(project, "TASK-LEDGER.md"),
  };
  const dashboard = await new Adapter(config).snapshot(project, "Demo session");
  const html = await dashboardHTML();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.OBSERVATORY_CHROMIUM,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1480, height: 1040 },
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const remote: string[] = [];
    page.on("request", (r) => {
      if (r.url().startsWith("http")) remote.push(r.url());
    });
    await page.exposeFunction(
      "testBridge",
      async (m: { action: string; id: string }) => {
        if (m.action === "readEvidence") {
          const payload = await evidencePayload(m.id, dashboard, config);
          await page.evaluate((p) => {
            const w = window as unknown as {
              observatory: { evidence: (p: unknown) => void };
            };
            w.observatory.evidence(p);
          }, payload);
        }
      },
    );
    await page.setContent(html);
    // tsx preserves function names with an esbuild helper when serializing test callbacks.
    await page.evaluate("globalThis.__name = (fn) => fn");
    page.setDefaultTimeout(5000);
    await page.evaluate(
      ({ dashboard, config }) => {
        const w = window as unknown as {
          glimpse: { send: (m: unknown) => void };
          testBridge: (m: unknown) => void;
          observatory: {
            configure: (p: unknown) => void;
            snapshot: (p: unknown) => void;
          };
        };
        w.glimpse = { send: (m) => w.testBridge(m) };
        w.observatory.configure(config);
        w.observatory.snapshot(dashboard);
      },
      { dashboard, config },
    );
    await mkdir("docs/screenshots", { recursive: true });
    await page.selectOption("#theme", "dark");
    await page.screenshot({
      path: "docs/screenshots/overview-dark.png",
      fullPage: true,
    });
    await page.selectOption("#theme", "light");
    await page.screenshot({
      path: "docs/screenshots/overview-light.png",
      fullPage: true,
    });
    // A live update keeps the exact focused node and scroll, while refreshing its handler.
    await page.locator("#task-demo-0").focus();
    await page.evaluate(() => {
      Reflect.set(window, "retainedTask", document.activeElement);
      window.scrollTo(0, 250);
    });
    const scroll = await page.evaluate(() => window.scrollY);
    const revised = {
      ...dashboard,
      tasks: dashboard.tasks.map((t, i) =>
        i === 0 ? { ...t, assessment: "Updated assessment after refresh" } : t,
      ),
    };
    await page.evaluate(
      (d) =>
        (
          window as unknown as {
            observatory: { snapshot: (p: unknown) => void };
          }
        ).observatory.snapshot(d),
      revised,
    );
    assert.equal(
      await page.evaluate(
        () => document.activeElement === Reflect.get(window, "retainedTask"),
      ),
      true,
    );
    assert.equal(await page.evaluate(() => window.scrollY), scroll);
    await page.keyboard.press("Enter");
    await page
      .getByText("Updated assessment after refresh", { exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    await page.locator('[data-view="evidence"]').click();
    await page.locator("#ledger-context summary").click();
    await page.evaluate(
      (d) =>
        (
          window as unknown as {
            observatory: { snapshot: (p: unknown) => void };
          }
        ).observatory.snapshot(d),
      dashboard,
    );
    assert.equal(
      await page.locator("#ledger-context").getAttribute("open"),
      "",
    );
    await page
      .getByRole("button", { name: /design-notes.md/ })
      .first()
      .click();
    await page
      .getByText("The script above is deliberate untrusted fixture text.", {
        exact: false,
      })
      .waitFor();
    assert.equal(
      await page.evaluate(() => Reflect.get(window, "__unsafeReportExecuted")),
      undefined,
    );
    const reportText = await page.locator("#drawer-body").textContent();
    await page.evaluate(
      (d) =>
        (
          window as unknown as {
            observatory: { snapshot: (p: unknown) => void };
          }
        ).observatory.snapshot(d),
      revised,
    );
    assert.equal(await page.locator("#drawer-body").textContent(), reportText);
    await page.screenshot({
      path: "docs/screenshots/evidence-light.png",
      fullPage: true,
    });
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator("#drawer-bottom button")
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator("#close")
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#drawer").isHidden(), true);
    await page.locator("#search").focus();
    await page.keyboard.press("Escape");
    await page.locator("#search").blur();
    await page.keyboard.press("5");
    assert.equal(await page.locator("#crumb").textContent(), "Sources");
    await page.keyboard.press("/");
    assert.equal(
      await page
        .locator("#search")
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await page.locator("#search").fill("atlas");
    await page.locator('[data-view="agents"]').click();
    assert.equal(await page.locator(".agent-row").count(), 1);
    // Rendering an adversarial title remains inert text, including across refresh.
    const hostile = {
      ...dashboard,
      agents: dashboard.agents.map((a, i) =>
        i === 0
          ? { ...a, name: '<img src=x onerror="window.__unsafeTitle=true">' }
          : a,
      ),
    };
    await page.locator("#search").fill("");
    await page.evaluate(
      (d) =>
        (
          window as unknown as {
            observatory: { snapshot: (p: unknown) => void };
          }
        ).observatory.snapshot(d),
      hostile,
    );
    assert.equal(await page.locator(".agent-name img").count(), 0);
    assert.equal(
      await page.evaluate(() => Reflect.get(window, "__unsafeTitle")),
      undefined,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(remote, []);
    console.log(
      "UI checks passed: light/dark rendering, inert reports and titles, focus trap, Escape, keyboard views, search, zero remote requests, morphdom node/focus/scroll retention, updated handlers, expanded ledger, isolated viewer. Screenshots written to docs/screenshots.",
    );
  } finally {
    await browser.close();
  }
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
