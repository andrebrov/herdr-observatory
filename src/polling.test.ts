import { it, expect, vi } from "vitest";
import { Adapter } from "./adapter.js";
it("bounds refresh frequency, prevents overlapping refreshes, and stops timers", async () => {
  vi.useFakeTimers();
  const adapter = new Adapter({
    projects: [],
    sessions: ["default"],
    state: "/nonexistent-observatory-fixture/state.json",
    evidenceRoots: [],
    demo: false,
  });
  let calls = 0,
    release: () => void = () => {};
  const pending = new Promise<void>((r) => {
    release = r;
  });
  try {
    adapter.start(async () => {
      calls++;
      await pending;
    });
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(calls).toBe(1);
    release();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toBe(2);
    adapter.stop();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(calls).toBe(2);
  } finally {
    adapter.stop();
    vi.useRealTimers();
  }
});
