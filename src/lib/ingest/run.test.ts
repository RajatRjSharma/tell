import { describe, expect, it } from "vitest";
import { assertFailureBudget, runIsolated } from "@/lib/ingest/run";

const quiet = { log: () => {}, sleep: () => Promise.resolve() };

describe("runIsolated", () => {
  it("keeps going after a failure and records it", async () => {
    const run = await runIsolated(
      ["a", "b", "c"],
      (item) => item,
      async (item) => {
        if (item === "b") throw new Error("boom");
        return 2;
      },
      quiet,
    );
    expect(run.written).toBe(4);
    expect(run.ok.map((r) => r.item)).toEqual(["a", "c"]);
    expect(run.failed).toEqual([{ item: "b", error: "boom" }]);
  });
});

describe("assertFailureBudget", () => {
  const run = (ok: number, failed: number) => ({
    ok: Array.from({ length: ok }, (_, i) => ({ item: i, written: 1 })),
    failed: Array.from({ length: failed }, (_, i) => ({
      item: i,
      error: "x",
    })),
    written: ok,
  });

  it("passes with no failures or failures within budget", () => {
    expect(() => assertFailureBudget("job", run(3, 0))).not.toThrow();
    expect(() => assertFailureBudget("job", run(3, 1))).not.toThrow();
    expect(() => assertFailureBudget("job", run(1, 1))).not.toThrow();
  });

  it("fails when everything failed or the budget is exceeded", () => {
    expect(() => assertFailureBudget("job", run(0, 1))).toThrow(
      "job: 1/1 failed",
    );
    expect(() => assertFailureBudget("job", run(1, 3))).toThrow(
      "job: 3/4 failed",
    );
  });
});
