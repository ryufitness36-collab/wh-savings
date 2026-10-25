import { describe, expect, it } from "vitest";
import { answersMatch, gradeLocally, normalizeAnswer, shuffleDifferent, tokenizeForReorder } from "./grading";
import { nextReview, ratingFromScore } from "./srs";
import { addDays, computeStreak, dateKey, lastNDays } from "./dates";
import { diffWords } from "./diff";
import { computeMetrics, countWords, transcriptToText, type TranscriptEntry } from "./transcript";
import { buildTutorInstructions } from "./instructions";
import { DEFAULT_LESSON_SETTINGS, lessonSettingsSchema } from "./lesson";

describe("grading", () => {
  it("normalizes case, spaces, quotes and final punctuation", () => {
    expect(normalizeAnswer("  I  went to a café yesterday. ")).toBe("i went to a café yesterday");
    expect(normalizeAnswer("I’m fine!")).toBe("i'm fine");
  });

  it("treats contractions as equal", () => {
    expect(answersMatch("I'm going to study.", "I am going to study")).toBe(true);
    expect(answersMatch("I haven't seen it", "I have not seen it.")).toBe(true);
    expect(answersMatch("I can't swim", "I cannot swim")).toBe(true);
    expect(answersMatch("I went", "I go")).toBe(false);
  });

  it("grades multiple choice locally", () => {
    const q = { format: "multiple_choice" as const, correctAnswer: "have lived", acceptableAnswers: [] };
    expect(gradeLocally(q, "have lived")).toEqual({ decided: true, score: 10, isCorrect: true });
    expect(gradeLocally(q, "lived")).toEqual({ decided: true, score: 0, isCorrect: false });
  });

  it("leaves non-matching free answers to the AI", () => {
    const q = { format: "translation" as const, correctAnswer: "I have been to Kyoto twice.", acceptableAnswers: ["I've visited Kyoto twice."] };
    expect(gradeLocally(q, "I've visited Kyoto twice")).toEqual({ decided: true, score: 10, isCorrect: true });
    expect(gradeLocally(q, "I went to Kyoto two times.")).toEqual({ decided: false });
    expect(gradeLocally(q, "   ")).toEqual({ decided: true, score: 0, isCorrect: false });
  });

  it("shuffles reorder tokens into a different order", () => {
    const tokens = tokenizeForReorder("I have never been to Paris.");
    expect(tokens).toEqual(["I", "have", "never", "been", "to", "Paris."]);
    for (let i = 0; i < 20; i++) {
      const s = shuffleDifferent(tokens);
      expect([...s].sort()).toEqual([...tokens].sort());
      expect(s).not.toEqual(tokens);
    }
    // 乱数が常に同じ値でも元の順序に戻らない
    expect(shuffleDifferent(["a", "b", "c"], () => 0.999)).not.toEqual(["a", "b", "c"]);
  });
});

describe("spaced repetition", () => {
  const fresh = { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };
  const now = 1_700_000_000_000;

  it("grows the interval on success", () => {
    const first = nextReview(fresh, "good", now);
    expect(first.intervalDays).toBe(1);
    const second = nextReview(first, "good", now);
    expect(second.intervalDays).toBe(3);
    const third = nextReview(second, "good", now);
    expect(third.intervalDays).toBeCloseTo(7.5);
    expect(third.dueAt).toBe(now + Math.round(7.5 * 86400000));
  });

  it("resets on failure and lowers ease", () => {
    const learned = { ease: 2.5, intervalDays: 10, reps: 4, lapses: 0 };
    const failed = nextReview(learned, "again", now);
    expect(failed.reps).toBe(0);
    expect(failed.lapses).toBe(1);
    expect(failed.ease).toBeCloseTo(2.3);
    expect(failed.dueAt).toBe(now + 600000);
  });

  it("never lets ease drop below the minimum", () => {
    let s = { ...fresh, dueAt: 0 };
    for (let i = 0; i < 20; i++) s = nextReview(s, "again", now);
    expect(s.ease).toBeCloseTo(1.3);
  });

  it("maps scores to ratings", () => {
    expect(ratingFromScore(10)).toBe("easy");
    expect(ratingFromScore(8)).toBe("good");
    expect(ratingFromScore(6)).toBe("hard");
    expect(ratingFromScore(2)).toBe("again");
  });
});

describe("dates", () => {
  it("formats dates in a time zone", () => {
    // 2024-01-01 20:00 UTC は日本時間では 1/2
    const ts = Date.UTC(2024, 0, 1, 20, 0, 0);
    expect(dateKey(ts, "Asia/Tokyo")).toBe("2024-01-02");
    expect(dateKey(ts, "UTC")).toBe("2024-01-01");
  });

  it("adds days across months", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(lastNDays("2024-01-02", 3)).toEqual(["2023-12-31", "2024-01-01", "2024-01-02"]);
  });

  it("computes streaks", () => {
    expect(computeStreak(["2024-01-01", "2024-01-02", "2024-01-03"], "2024-01-03")).toBe(3);
    // 今日はまだ学習していないが昨日まで継続
    expect(computeStreak(["2024-01-01", "2024-01-02"], "2024-01-03")).toBe(2);
    expect(computeStreak(["2024-01-01"], "2024-01-03")).toBe(0);
    expect(computeStreak([], "2024-01-03")).toBe(0);
  });
});

describe("diffWords", () => {
  it("marks removed and added words", () => {
    const parts = diffWords("I went to cafe yesterday.", "I went to a café yesterday.");
    const removed = parts.filter((p) => p.type === "removed").map((p) => p.text.trim()).join(" ");
    const added = parts.filter((p) => p.type === "added").map((p) => p.text.trim()).join(" ");
    expect(removed).toContain("cafe");
    expect(added).toContain("café");
    expect(added).toContain("a");
    // 結合すると修正後の文になる
    expect(parts.filter((p) => p.type !== "removed").map((p) => p.text).join("")).toBe("I went to a café yesterday.");
    expect(parts.filter((p) => p.type !== "added").map((p) => p.text).join("")).toBe("I went to cafe yesterday.");
  });

  it("returns a single same part for identical text", () => {
    expect(diffWords("Hello there", "Hello there")).toEqual([{ type: "same", text: "Hello there" }]);
  });
});

describe("transcript metrics", () => {
  const t: TranscriptEntry[] = [
    { id: "1", role: "assistant", text: "Hi! How are you today?", at: 0 },
    { id: "2", role: "user", text: "I'm good. I went to a café yesterday.", at: 1 },
    { id: "3", role: "assistant", text: "Nice! What did you order?", at: 2 },
    { id: "4", role: "user", text: "Latte.", at: 3 },
    { id: "5", role: "user", text: "", at: 4 },
  ];

  it("counts English words", () => {
    expect(countWords("I'm good. I went to a café yesterday.")).toBe(8);
    expect(countWords("こんにちは")).toBe(0);
  });

  it("computes observable metrics", () => {
    const m = computeMetrics(t, 300, 60, 40);
    expect(m.userTurns).toBe(2);
    expect(m.userWords).toBe(9);
    expect(m.avgWordsPerTurn).toBe(4.5);
    expect(m.userSpeakingRatio).toBe(0.6);
    expect(m.wordsPerMinute).toBe(9);
  });

  it("returns null ratios when speaking time was not measured", () => {
    const m = computeMetrics(t, 300, 0, 0);
    expect(m.userSpeakingRatio).toBeNull();
    expect(m.wordsPerMinute).toBeNull();
  });

  it("formats transcript text for the AI", () => {
    expect(transcriptToText(t).split("\n")).toHaveLength(4);
    expect(transcriptToText(t)).toContain("Learner: Latte.");
  });
});

describe("tutor instructions", () => {
  it("keeps turns short and ends with questions", () => {
    const text = buildTutorInstructions(DEFAULT_LESSON_SETTINGS);
    expect(text).toContain("1-2 sentences");
    expect(text).toContain("Do NOT correct");
    expect(text).toContain("どう言えばいい");
  });

  it("switches correction and Japanese support modes", () => {
    const text = buildTutorInstructions({ ...DEFAULT_LESSON_SETTINGS, correctionMode: "inline", japaneseSupport: false });
    expect(text).toContain("recast");
    expect(text).toContain("English only");
  });

  it("includes practice targets", () => {
    const text = buildTutorInstructions(DEFAULT_LESSON_SETTINGS, [{ original: "I went to cafe", corrected: "I went to a café" }]);
    expect(text).toContain('Mistake: "I went to cafe" -> Correct: "I went to a café"');
  });

  it("includes the tutor persona, style and the learner's request", () => {
    const text = buildTutorInstructions({ ...DEFAULT_LESSON_SETTINGS, teacherId: "mia", teacherStyle: "coach", teacherNote: "サッカーの話題が好き" });
    expect(text).toContain("You are Mia");
    expect(text).toContain("Sydney");
    expect(text).toContain("speaking coach");
    expect(text).toContain("サッカーの話題が好き");
  });

  it("fills defaults for settings saved before Phase 2", () => {
    const old: Record<string, unknown> = { ...DEFAULT_LESSON_SETTINGS };
    delete old.teacherStyle;
    delete old.teacherNote;
    const parsed = lessonSettingsSchema.parse(old);
    expect(parsed.teacherStyle).toBe("friendly");
    expect(parsed.teacherNote).toBe("");
  });

  it("validates lesson settings", () => {
    expect(lessonSettingsSchema.safeParse(DEFAULT_LESSON_SETTINGS).success).toBe(true);
    expect(lessonSettingsSchema.safeParse({ ...DEFAULT_LESSON_SETTINGS, durationMinutes: 7 }).success).toBe(false);
  });
});

import { rankWeakCategories } from "./weakness";

describe("weak categories", () => {
  it("ranks frequent grammar errors and real conversation mistakes above occasional slips", () => {
    const ranked = rankWeakCategories([
      { id: "a", attempts: 10, wrong: 1, avgScore: 9, usageMistakes: 0 },
      { id: "b", attempts: 5, wrong: 4, avgScore: 4, usageMistakes: 0 },
      { id: "c", attempts: 0, wrong: 0, avgScore: null, usageMistakes: 4 },
      { id: "d", attempts: 3, wrong: 0, avgScore: 10, usageMistakes: 0 },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
});

import { weekStart } from "./dates";

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // 日曜
    expect(weekStart("2026-10-19")).toBe("2026-10-19"); // 月曜
    expect(weekStart("2026-10-21")).toBe("2026-10-19"); // 水曜
  });
});

import { bestTimeSlot, change, computeTrendFacts } from "./trends";
import { hourOf } from "./dates";

describe("trends", () => {
  it("finds the best 3-hour slot, wrapping around midnight", () => {
    const hourly = new Array(24).fill(0);
    hourly[23] = 100;
    hourly[0] = 100;
    hourly[12] = 150;
    expect(bestTimeSlot(hourly)).toBe(22);
    expect(bestTimeSlot(new Array(24).fill(0))).toBeNull();
  });

  it("compares early and recent averages", () => {
    expect(change([4, 5, 6, 7, 8, 9])).toEqual({ from: 5, to: 8 });
    expect(change([4, 6])).toEqual({ from: 4, to: 6 });
    expect(change([5])).toBeNull();
  });

  it("computes facts", () => {
    const f = computeTrendFacts({ hourly: new Array(24).fill(0), dailySeconds: [0, 600, 1200], overallScores: [], wordsPerTurn: [3, 5] });
    expect(f.avgMinutesPerStudyDay).toBe(15);
    expect(f.scoreChange).toBeNull();
    expect(f.wordsPerTurnChange).toEqual({ from: 3, to: 5 });
  });

  it("gets the hour in a time zone", () => {
    expect(hourOf(Date.UTC(2024, 0, 1, 20, 30), "Asia/Tokyo")).toBe(5);
    expect(hourOf(Date.UTC(2024, 0, 1, 0, 0), "UTC")).toBe(0);
  });
});
