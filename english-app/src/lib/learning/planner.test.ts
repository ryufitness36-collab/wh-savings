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

import { aiPlanToItems, nearestDuration } from "./planner";
import type { AiPlan } from "@/lib/ai/schemas";

const item = (over: Partial<AiPlan["items"][number]>): AiPlan["items"][number] => ({
  kind: "grammar",
  title_ja: "t",
  detail_ja: "d",
  reason_ja: "r",
  minutes: 5,
  grammar_category: "none",
  grammar_weak_drill: false,
  question_count: 0,
  conversation_mode: "none",
  scenario_id: null,
  writing_topic_ja: null,
  ...over,
});

describe("aiPlanToItems", () => {
  it("builds links and falls back for unknown scenarios", () => {
    const items = aiPlanToItems(
      {
        message_ja: "",
        items: [
          item({ kind: "grammar", grammar_category: "relative", question_count: 5 }),
          item({ kind: "conversation", conversation_mode: "cafe", scenario_id: "does-not-exist", minutes: 9 }),
          item({ kind: "writing", writing_topic_ja: "週末の予定", minutes: 5 }),
          item({ kind: "grammar", grammar_weak_drill: true, question_count: 20, minutes: 3 }),
        ],
      },
      30,
    );
    expect(items[0].href).toBe("/grammar?category=relative&count=5");
    expect(items[1].href).toBe("/conversation?mode=cafe&scenario=order&minutes=10");
    expect(items[2].href).toBe(`/writing?topic=${encodeURIComponent("週末の予定")}`);
    expect(items[3].href).toBe("/grammar?focus=weak&count=10");
    expect(items[0].reason).toBe("r");
  });

  it("shrinks items to fit the time budget instead of dropping the conversation", () => {
    const items = aiPlanToItems(
      {
        message_ja: "",
        items: [item({ kind: "review", minutes: 3 }), item({ minutes: 5 }), item({ kind: "conversation", conversation_mode: "cafe", minutes: 10 })],
      },
      15,
    );
    expect(items.map((i) => i.kind)).toEqual(["review", "grammar", "conversation"]);
    expect(items[2].minutes).toBe(5);
    expect(items[2].href).toContain("minutes=5");
  });

  it("drops items when no time is left", () => {
    const items = aiPlanToItems({ message_ja: "", items: [item({ minutes: 5 }), item({ minutes: 10 }), item({ minutes: 5 })] }, 5);
    expect(items).toHaveLength(1);
  });

  it("rounds conversation minutes to selectable durations", () => {
    expect(nearestDuration(7)).toBe(5);
    expect(nearestDuration(12)).toBe(10);
    expect(nearestDuration(40)).toBe(25);
  });
});
