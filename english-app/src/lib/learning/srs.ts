/**
 * 間隔反復（SM-2 アルゴリズムを簡略化したもの）。
 * 正解するたびに復習間隔が伸び、間違えると短い間隔に戻る。
 */

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface SrsState {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
}

export const RATING_LABEL: Record<ReviewRating, string> = {
  again: "もう一度",
  hard: "難しい",
  good: "できた",
  easy: "簡単",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;

export function nextReview(state: SrsState, rating: ReviewRating, now: number): SrsState & { dueAt: number } {
  let { ease, intervalDays, reps, lapses } = state;

  if (rating === "again") {
    lapses += 1;
    reps = 0;
    ease = Math.max(MIN_EASE, ease - 0.2);
    intervalDays = 0;
    // 10分後にもう一度
    return { ease, intervalDays, reps, lapses, dueAt: now + 10 * 60 * 1000 };
  }

  if (rating === "hard") ease = Math.max(MIN_EASE, ease - 0.15);
  if (rating === "easy") ease = ease + 0.15;

  if (reps === 0) {
    intervalDays = rating === "easy" ? 3 : rating === "hard" ? 0.5 : 1;
  } else if (reps === 1) {
    intervalDays = rating === "easy" ? 7 : rating === "hard" ? 2 : 3;
  } else {
    const factor = rating === "hard" ? 1.2 : rating === "easy" ? ease * 1.3 : ease;
    intervalDays = Math.max(1, intervalDays * factor);
  }
  intervalDays = Math.min(intervalDays, 180);
  reps += 1;

  return { ease, intervalDays, reps, lapses, dueAt: now + Math.round(intervalDays * DAY_MS) };
}

/** 文法問題の点数（0〜10）から復習評価に変換する */
export function ratingFromScore(score: number): ReviewRating {
  if (score >= 10) return "easy";
  if (score >= 8) return "good";
  if (score >= 5) return "hard";
  return "again";
}
