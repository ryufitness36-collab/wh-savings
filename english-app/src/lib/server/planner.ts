import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb, LOCAL_USER_ID, schema } from "@/lib/db";
import { generateStructured } from "@/lib/ai/client";
import { aiPlanSchema, type ConversationReport } from "@/lib/ai/schemas";
import { GRAMMAR_CATEGORIES } from "@/lib/learning/grammar";
import { CONVERSATION_MODES, LEVEL_INFO, MODE_INFO, lessonSettingsSchema } from "@/lib/learning/lesson";
import { aiPlanToItems, type PlanItem, type PlanMinutes } from "@/lib/learning/planner";
import { formatDurationJa } from "@/lib/utils";
import { getStats } from "./stats";
import { readSetting, writeSetting } from "./settings";
import { z } from "zod";

export interface AiPlanResult {
  message: string;
  items: PlanItem[];
  generatedAt: number;
}

const cachedPlanSchema = z.object({
  message: z.string(),
  items: z.array(
    z.object({
      kind: z.enum(["review", "grammar", "conversation", "writing"]),
      title: z.string(),
      detail: z.string(),
      minutes: z.number(),
      href: z.string(),
      reason: z.string().optional(),
    }),
  ),
  generatedAt: z.number(),
});

const PLANNER_INSTRUCTIONS = `あなたは日本人英語学習者（初級〜中級）の専属学習コーチです。
学習者のデータを読み、今日やるべき学習メニューを、指定された時間内で2〜5個提案してください。

方針:
- 期限が来ている復習があれば優先する（忘れかけているため）。
- 苦手分野（文法問題の誤答や、英会話・英作文での間違い）を具体的に練習させる。最近の間違いがある分野は grammar_weak_drill を true にしてよい。
- 学習者の目的は海外旅行・日常英会話・外国人との交流・カフェでの接客英語。話す練習（AI英会話）を重視する。15分以上なら原則として英会話を含める。
- 前回の英会話の改善ポイントがあれば、それを練習できるモード・場面を選ぶ。
- 同じことばかりにならないよう、最近やっていない学習も適度に入れる。
- reason_ja には、必ず学習データ（数字や分野名）を根拠として1文で書く。
- 英会話は5・10・15・25分のいずれか。合計時間は指定された学習時間を超えない。
- conversation_mode と scenario_id は、与えられた候補の中から選ぶ。`;

function buildContext(minutes: PlanMinutes, userId: string): string {
  const stats = getStats(userId);
  const db = getDb();
  const latest = db
    .select({ title: schema.conversations.title, settingsJson: schema.conversations.settingsJson, reportJson: schema.conversations.reportJson })
    .from(schema.conversations)
    .where(and(eq(schema.conversations.userId, userId), eq(schema.conversations.status, "reported")))
    .orderBy(desc(schema.conversations.startedAt))
    .limit(1)
    .get();
  const report = latest?.reportJson ? (JSON.parse(latest.reportJson) as ConversationReport) : null;
  const level = latest ? lessonSettingsSchema.safeParse(JSON.parse(latest.settingsJson)) : null;

  const lines = [
    `今日の学習時間の希望: ${minutes}分`,
    `今日すでに学習した時間: ${formatDurationJa(stats.todaySeconds)} / 今週: ${formatDurationJa(stats.thisWeekSeconds)}（目標 ${formatDurationJa(stats.weeklyGoalMinutes * 60)}）`,
    `連続学習日数: ${stats.streak}日`,
    `期限が来ている復習: ${stats.review.due}問（登録済み ${stats.review.total}問）`,
    `最後の英会話: ${stats.daysSinceLastConversation === null ? "まだ一度もない" : `${stats.daysSinceLastConversation}日前`}`,
    level?.success ? `前回の英会話レベル設定: ${LEVEL_INFO[level.data.level].label}` : "",
    stats.weakCategories.length
      ? `苦手分野: ${stats.weakCategories
          .map((w) => `${w.label}（${w.category}）文法問題の誤答${w.wrong}/${w.attempts}・会話や英作文での間違い${w.usageMistakes}回`)
          .join(" / ")}`
      : "苦手分野: まだデータなし",
    stats.categoryAccuracy.length
      ? `分野別正答率: ${stats.categoryAccuracy.map((c) => `${c.label} ${c.accuracy}%（${c.attempts}問）`).join(" / ")}`
      : "文法問題: まだ解いていない",
    stats.conversationTrend.length
      ? `英会話スコア推移（古い順、総合/10）: ${stats.conversationTrend.map((p) => p.overall).join(", ")}`
      : "",
    report
      ? `前回の英会話「${latest?.title}」の改善ポイント: ${report.improvement_points_ja.join(" / ")}。スコア: 文法${report.scores.grammar.score} 語彙${report.scores.vocabulary.score} 流暢さ${report.scores.fluency.score} 継続力${report.scores.engagement.score}`
      : "",
    `英作文の回数: ${stats.writingCount}回`,
    ``,
    `grammar_category の候補: ${GRAMMAR_CATEGORIES.map((c) => `${c.id}（${c.label}）`).join(", ")}`,
    `conversation_mode と scenario_id の候補:`,
    ...CONVERSATION_MODES.map((m) => `- ${m}（${MODE_INFO[m].label}）: ${MODE_INFO[m].scenarios.map((s) => `${s.id}（${s.label}）`).join(", ")}`),
  ];
  return lines.filter((l) => l !== "").join("\n");
}

function cacheKey(minutes: PlanMinutes) {
  return `ai-plan:${getStats().today}:${minutes}`;
}

/** 今日作成済みのAIプラン（なければ null） */
export function getCachedPlan(minutes: PlanMinutes, userId = LOCAL_USER_ID): AiPlanResult | null {
  return readSetting(cacheKey(minutes), cachedPlanSchema.nullable(), null, userId);
}

export async function generatePlan(minutes: PlanMinutes, userId = LOCAL_USER_ID): Promise<AiPlanResult> {
  const ai = await generateStructured({
    schema: aiPlanSchema,
    name: "study_plan",
    instructions: PLANNER_INSTRUCTIONS,
    input: buildContext(minutes, userId),
    maxOutputTokens: 4000,
  });
  const result: AiPlanResult = { message: ai.message_ja, items: aiPlanToItems(ai, minutes), generatedAt: Date.now() };
  writeSetting(cacheKey(minutes), result, userId);
  return result;
}
