import "server-only";
import { z } from "zod";
import { LOCAL_USER_ID } from "@/lib/db";
import { generateStructured } from "@/lib/ai/client";
import { insightsSchema, type Insights } from "@/lib/ai/schemas";
import { formatDurationJa } from "@/lib/utils";
import { getStats } from "./stats";
import { readSetting, writeSetting } from "./settings";

export interface InsightsResult extends Insights {
  generatedAt: number;
}

const cachedSchema = insightsSchema.extend({ generatedAt: z.number() });

const INSTRUCTIONS = `あなたは日本人英語学習者の学習データを分析するコーチです。
与えられた数値だけを根拠に、学習傾向を分析してください（推測で事実を作らない）。
データが少ない場合はその旨を正直に書き、まず続けることを勧めてください。
アプリの機能：AI英会話（モード・場面・押して話す・ヒント）、英文法（苦手克服ドリル）、英作文添削、復習（間隔反復）、AI学習プラン。`;

function cacheKey(userId: string) {
  return `insights:${getStats(userId).today}`;
}

export function getCachedInsights(userId = LOCAL_USER_ID): InsightsResult | null {
  return readSetting(cacheKey(userId), cachedSchema.nullable(), null, userId);
}

export async function generateInsights(userId = LOCAL_USER_ID): Promise<InsightsResult> {
  const s = getStats(userId);
  const f = s.trendFacts;
  const totalsByKind = s.daily.reduce(
    (acc, d) => ({
      conversation: acc.conversation + d.conversation,
      grammar: acc.grammar + d.grammar,
      writing: acc.writing + d.writing,
      review: acc.review + d.review,
    }),
    { conversation: 0, grammar: 0, writing: 0, review: 0 },
  );
  const input = [
    `直近30日の学習時間：英会話 ${formatDurationJa(totalsByKind.conversation)}、文法 ${formatDurationJa(totalsByKind.grammar)}、英作文 ${formatDurationJa(totalsByKind.writing)}、復習 ${formatDurationJa(totalsByKind.review)}`,
    `直近30日で学習した日数：${s.daily.filter((d) => d.conversation + d.grammar + d.writing + d.review > 0).length}日、連続学習 ${s.streak}日`,
    `週別の学習分（古い順、12週）：${s.weekly.map((w) => Math.round((w.conversation + w.grammar + w.writing + w.review) / 60)).join(", ")}`,
    `今週 ${formatDurationJa(s.thisWeekSeconds)} / 目標 ${formatDurationJa(s.weeklyGoalMinutes * 60)}`,
    f.bestTimeSlot !== null ? `よく学習する時間帯：${f.bestTimeSlot}時〜${(f.bestTimeSlot + 3) % 24}時` : "",
    f.avgMinutesPerStudyDay !== null ? `学習した日の平均：${f.avgMinutesPerStudyDay}分` : "",
    `英会話スコア（総合/10、古い順）：${s.conversationTrend.map((p) => p.overall).join(", ") || "なし"}`,
    f.wordsPerTurnChange ? `1回あたりの発話語数：${f.wordsPerTurnChange.from} → ${f.wordsPerTurnChange.to}` : "",
    `文法問題：${s.grammarAttempts}問、正答率 ${s.grammarAccuracy ?? "-"}%`,
    `分野別正答率：${s.categoryAccuracy.map((c) => `${c.label} ${c.accuracy}%（${c.attempts}問）`).join(" / ") || "なし"}`,
    `苦手分野：${s.weakCategories.map((w) => `${w.label}（誤答${w.wrong}/${w.attempts}、会話・英作文での間違い${w.usageMistakes}回）`).join(" / ") || "なし"}`,
    `復習：期限切れ ${s.review.due}問 / 登録 ${s.review.total}問`,
    `英作文：${s.writingCount}回`,
  ]
    .filter(Boolean)
    .join("\n");

  const ai = await generateStructured({ schema: insightsSchema, name: "learning_insights", instructions: INSTRUCTIONS, input, maxOutputTokens: 3000 });
  const result: InsightsResult = { ...ai, generatedAt: Date.now() };
  writeSetting(cacheKey(userId), result, userId);
  return result;
}
