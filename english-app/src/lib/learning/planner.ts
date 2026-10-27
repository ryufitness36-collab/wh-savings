import { grammarCategoryLabel, isGrammarCategory } from "./grammar";
import { DURATIONS, MODE_INFO, type ConversationMode } from "./lesson";
import type { AiPlan } from "@/lib/ai/schemas";

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
  /** AIプランのときだけ：勧める理由 */
  reason?: string;
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

/** 会話の分数を、選べる時間（5/10/15/25分）のうち一番近いものにする */
export function nearestDuration(minutes: number): number {
  const options = DURATIONS.filter((d) => d > 0);
  return options.reduce((best, d) => (Math.abs(d - minutes) < Math.abs(best - minutes) ? d : best), options[0]);
}

/**
 * AIが作ったプランを検証して画面用のリンク付き項目に変換する。
 * 存在しない場面・分野は既定値に置き換え、合計時間が指定時間を大きく超えないよう切り詰める。
 */
export function aiPlanToItems(ai: AiPlan, minutes: PlanMinutes): PlanItem[] {
  const items: PlanItem[] = [];
  let total = 0;
  for (const it of ai.items.slice(0, 5)) {
    // 時間をオーバーする項目は捨てずに、残り時間に収まるよう短くする（収まらなければ省く）
    const remaining = minutes + 2 - total;
    let m = Math.max(1, Math.min(it.minutes, 30));
    if (it.kind === "conversation") {
      const target = nearestDuration(m);
      const fits = DURATIONS.filter((d) => d > 0 && d <= target && d <= remaining);
      if (fits.length === 0) continue;
      m = Math.max(...fits);
    } else if (m > remaining) {
      if (remaining < 3) continue;
      m = remaining;
    }
    let href = "/";
    if (it.kind === "review") {
      href = "/review";
    } else if (it.kind === "grammar") {
      const count = Math.max(3, Math.min(it.question_count || 5, 10));
      if (it.grammar_weak_drill) href = `/grammar?focus=weak&count=${count}`;
      else if (isGrammarCategory(it.grammar_category)) href = `/grammar?category=${it.grammar_category}&count=${count}`;
      else href = `/grammar?count=${count}`;
    } else if (it.kind === "conversation") {
      const mode: ConversationMode = it.conversation_mode !== "none" ? it.conversation_mode : "free_talk";
      const scenario = MODE_INFO[mode].scenarios.find((sc) => sc.id === it.scenario_id) ?? MODE_INFO[mode].scenarios[0];
      href = `/conversation?mode=${mode}&scenario=${scenario.id}&minutes=${m}`;
    } else if (it.kind === "writing") {
      href = it.writing_topic_ja ? `/writing?topic=${encodeURIComponent(it.writing_topic_ja)}` : "/writing";
    }
    items.push({ kind: it.kind, title: it.title_ja, detail: it.detail_ja, minutes: m, href, reason: it.reason_ja });
    total += m;
  }
  return items;
}
