import { it, expect } from "vitest";
import { dashboardHTML } from "./presentation.js";
it("loads morphdom locally and ships parseable inline scripts under the restrictive CSP", async () => {
  const html = await dashboardHTML();
  expect(html).not.toContain("<!-- LOCAL_VENDOR -->");
  expect(html).toContain("function morphdom");
  expect(html).not.toMatch(/<script[^>]*src=/);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  expect(scripts).toHaveLength(2);
  for (const script of scripts)
    expect(() => new Function(script[1])).not.toThrow();
});
