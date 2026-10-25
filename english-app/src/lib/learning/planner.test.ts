import { describe, expect, it } from "vitest";
import { buildPlan } from "./planner";

const base = { reviewDue: 0, weakCategory: null, lastGrammarCategory: null, daysSinceConversation: null };

describe("buildPlan", () => {
  it("prioritizes due reviews", () => {
    const plan = buildPlan({ ...base, reviewDue: 8 }, 15);
    expect(plan[0].kind).toBe("review");
    expect(plan[0].detail).toContain("5問");
  });

  it("uses the weak category for grammar", () => {
    const plan = buildPlan({ ...base, weakCategory: "relative" }, 30);
    const g = plan.find((p) => p.kind === "grammar");
    expect(g?.href).toContain("category=relative");
    expect(g?.title).toContain("関係代名詞");
  });

  it("fits roughly into the chosen time", () => {
    for (const m of [5, 15, 30, 60] as const) {
      const total = buildPlan({ ...base, reviewDue: 20 }, m).reduce((s, p) => s + p.minutes, 0);
      expect(total).toBeLessThanOrEqual(m + 1);
      expect(total).toBeGreaterThan(0);
    }
  });

  it("includes conversation and writing for longer sessions", () => {
    const plan = buildPlan(base, 60);
    expect(plan.map((p) => p.kind)).toEqual(expect.arrayContaining(["conversation", "grammar", "writing"]));
  });
});
