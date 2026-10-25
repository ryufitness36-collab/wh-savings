import { grammarCategoryLabel } from "./grammar";

/**
 * 学習履歴に基づく「今日のおすすめ学習」（ルールベース）。
 * AIを使わないので無料・即時。復習期限・苦手分野・最近の英会話の有無から組み立てる。
 */

export const PLAN_MINUTES = [5, 15, 30, 60] as const;
export type PlanMinutes = (typeof PLAN_MINUTES)[number];

export interface PlanInput {
  reviewDue: number;
  weakCategory: string | null;
  lastGrammarCategory: string | null;
  daysSinceConversation: number | null;
}

export interface PlanItem {
  kind: "review" | "grammar" | "conversation" | "writing";
  title: string;
  detail: string;
  minutes: number;
  href: string;
}

export function buildPlan(input: PlanInput, minutes: PlanMinutes): PlanItem[] {
  const items: PlanItem[] = [];
  let left = minutes;

  if (input.reviewDue > 0) {
    const n = Math.min(input.reviewDue, minutes <= 5 ? 3 : minutes <= 15 ? 5 : 10);
    const m = Math.max(1, Math.round(n * 0.6));
    items.push({ kind: "review", title: "間違えた表現の復習", detail: `${n}問（忘れかけているタイミングです）`, minutes: m, href: "/review" });
    left -= m;
  }

  const wantsConversation = minutes >= 15 || (input.reviewDue === 0 && (input.daysSinceConversation === null || input.daysSinceConversation >= 1));
  const convMinutes = minutes >= 60 ? 25 : minutes >= 30 ? 10 : 5;
  if (wantsConversation && left >= 5) {
    items.push({ kind: "conversation", title: "AI英会話", detail: `${convMinutes}分のフリートーク`, minutes: convMinutes, href: "/conversation" });
    left -= convMinutes;
  }

  const category = input.weakCategory ?? input.lastGrammarCategory ?? "present_perfect";
  if (left >= 3) {
    const n = left >= 10 ? 10 : left >= 5 ? 5 : 3;
    items.push({
      kind: "grammar",
      title: `${grammarCategoryLabel(category)}の問題`,
      detail: `${n}問${input.weakCategory ? "（苦手分野）" : ""}`,
      minutes: n,
      href: `/grammar?category=${category}&count=${n}`,
    });
    left -= n;
  }

  if (minutes >= 30 && left >= 5) {
    items.push({ kind: "writing", title: "英作文", detail: "今日の出来事を3文で書いて添削", minutes: Math.min(10, left), href: "/writing" });
  }

  return items;
}
