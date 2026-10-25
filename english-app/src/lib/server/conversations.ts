import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb, LOCAL_USER_ID, schema } from "@/lib/db";
import { AppError, generateStructured } from "@/lib/ai/client";
import { conversationReportSchema, type ConversationReport } from "@/lib/ai/schemas";
import { lessonSettingsSchema, LEVEL_INFO, MODE_INFO, getScenario, type LessonSettings, type PracticeTarget } from "@/lib/learning/lesson";
import { computeMetrics, transcriptToText, type TranscriptEntry } from "@/lib/learning/transcript";
import { addReviewItems } from "./review";
import { getPrivacySettings } from "./settings";

export interface ConversationDetail {
  id: string;
  title: string;
  mode: string;
  level: string;
  settings: LessonSettings;
  transcript: TranscriptEntry[];
  report: ConversationReport | null;
  status: "active" | "finished" | "reported" | "report_failed";
  practiceOf: string | null;
  startedAt: number;
  endedAt: number | null;
  durationSec: number;
  userSpeakingSec: number;
  aiSpeakingSec: number;
}

type Row = typeof schema.conversations.$inferSelect;

function toDetail(row: Row): ConversationDetail {
  return {
    id: row.id,
    title: row.title,
    mode: row.mode,
    level: row.level,
    settings: lessonSettingsSchema.parse(JSON.parse(row.settingsJson)),
    transcript: JSON.parse(row.transcriptJson) as TranscriptEntry[],
    report: row.reportJson ? (JSON.parse(row.reportJson) as ConversationReport) : null,
    status: row.status,
    practiceOf: row.practiceOf,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationSec: row.durationSec,
    userSpeakingSec: row.userSpeakingSec,
    aiSpeakingSec: row.aiSpeakingSec,
  };
}

export function getConversation(id: string, userId = LOCAL_USER_ID): ConversationDetail | null {
  const row = getDb()
    .select()
    .from(schema.conversations)
    .where(and(eq(schema.conversations.id, id), eq(schema.conversations.userId, userId)))
    .get();
  return row ? toDetail(row) : null;
}

export function requireConversation(id: string, userId = LOCAL_USER_ID): ConversationDetail {
  const c = getConversation(id, userId);
  if (!c) throw new AppError("会話が見つかりません。", 404, "not_found");
  return c;
}

export function listConversations(userId = LOCAL_USER_ID, limit = 50) {
  return getDb()
    .select({
      id: schema.conversations.id,
      title: schema.conversations.title,
      mode: schema.conversations.mode,
      level: schema.conversations.level,
      status: schema.conversations.status,
      startedAt: schema.conversations.startedAt,
      durationSec: schema.conversations.durationSec,
    })
    .from(schema.conversations)
    .where(eq(schema.conversations.userId, userId))
    .orderBy(desc(schema.conversations.startedAt))
    .limit(limit)
    .all();
}

/** 前回の会話レポートから「もう一度練習する」対象を取り出す */
export function getPracticeTargets(conversationId: string | null, userId = LOCAL_USER_ID): PracticeTarget[] {
  if (!conversationId) return [];
  const c = getConversation(conversationId, userId);
  if (!c?.report) return [];
  return c.report.corrections.map((x) => ({ original: x.original, corrected: x.corrected }));
}

export function saveProgress(
  id: string,
  data: { transcript: TranscriptEntry[]; durationSec: number; userSpeakingSec: number; aiSpeakingSec: number },
  opts: { finish: boolean },
  userId = LOCAL_USER_ID,
) {
  const privacy = getPrivacySettings(userId);
  const current = requireConversation(id, userId);
  // 終了済みの会話は上書きしない（終了処理の二重送信対策）
  if (current.status !== "active") return;
  const update: Partial<typeof schema.conversations.$inferInsert> = {
    durationSec: Math.round(data.durationSec),
    userSpeakingSec: data.userSpeakingSec,
    aiSpeakingSec: data.aiSpeakingSec,
  };
  // 途中保存は「文字起こしを保存する」設定がONのときだけ。終了時はレポート作成に必要なので一時的に保存する
  if (privacy.saveTranscripts || opts.finish) update.transcriptJson = JSON.stringify(data.transcript);
  if (opts.finish) {
    update.status = "finished";
    update.endedAt = Date.now();
  }
  getDb().update(schema.conversations).set(update).where(eq(schema.conversations.id, id)).run();
}

function buildReportPrompt(c: ConversationDetail): string {
  const s = c.settings;
  const scenario = getScenario(s.mode, s.scenarioId);
  const metrics = computeMetrics(c.transcript, c.durationSec, c.userSpeakingSec, c.aiSpeakingSec);
  return [
    `Lesson: ${MODE_INFO[s.mode].label} / ${scenario.label}${s.customTopic ? ` / topic: ${s.customTopic}` : ""}`,
    `Learner level: ${LEVEL_INFO[s.level].label} (CEFR ${LEVEL_INFO[s.level].cefr})`,
    `Measured data (objective): duration ${metrics.durationSec}s, learner turns ${metrics.userTurns}, learner words ${metrics.userWords}, average words per turn ${metrics.avgWordsPerTurn}` +
      (metrics.userSpeakingRatio !== null ? `, learner share of speaking time ${Math.round(metrics.userSpeakingRatio * 100)}%` : "") +
      (metrics.wordsPerMinute !== null ? `, learner speech rate ${metrics.wordsPerMinute} words/min` : ""),
    ``,
    `Transcript (learner lines are automatic speech recognition and may contain recognition errors):`,
    transcriptToText(c.transcript),
  ].join("\n");
}

const REPORT_INSTRUCTIONS = `あなたは日本人英語学習者を指導する経験豊富な英語講師です。
AI講師(Tutor)と学習者(Learner)の英会話の文字起こしを読み、学習者向けの復習レポートを作成してください。

ルール:
- 添削対象は Learner の発言だけです。original には Learner の発言をそのまま引用してください（Tutor の発言は対象外）。
- 文字起こしは音声認識の結果なので、明らかな認識ミスと思われるもの（同音異義語の取り違え等）は添削しないでください。
- type は grammar（文法ミス）/ naturalness（文法的には誤りではないが不自然）/ vocabulary（語彙の選択）で分類します。
- 学習者のレベルに合わせ、重要度の高いものから最大10個。誤りがなければ空配列で構いません。
- 日本語で話した部分は、その内容を英語でどう言えば良かったかを corrections に含めて構いません（type は vocabulary）。
- explanation_ja は中学生にも分かるやさしい日本語で、文法用語には簡単な説明を添えてください。
- スコアは文字起こしと計測データから観察できる事実だけを根拠にしてください。発音は評価しないでください。
  - fluency は1回あたりの語数・発話の長さ・計測データを根拠にします。
  - engagement は質問への応答、自分から話を広げたか、会話が続いたかを根拠にします。
- 学習者の発言がほとんどない場合は、その旨を summary_ja に書き、スコアは低めに、改善ポイントで話す量を増やすコツを伝えてください。
- review_phrases はちょうど5個。今回の会話の場面で役立つ自然なフレーズにしてください。`;

export async function generateReport(id: string, userId = LOCAL_USER_ID): Promise<ConversationReport> {
  const c = requireConversation(id, userId);
  const hasLearnerSpeech = c.transcript.some((t) => t.role === "user" && t.text.trim() !== "");
  if (!hasLearnerSpeech) {
    throw new AppError("あなたの発話が記録されていないため、レポートを作成できません。", 422, "empty_transcript");
  }
  const db = getDb();
  try {
    const ai = await generateStructured({
      schema: conversationReportSchema,
      name: "conversation_report",
      instructions: REPORT_INSTRUCTIONS,
      input: buildReportPrompt(c),
    });
    const report: ConversationReport = {
      ...ai,
      metrics: computeMetrics(c.transcript, c.durationSec, c.userSpeakingSec, c.aiSpeakingSec),
      generatedAt: Date.now(),
    };
    const privacy = getPrivacySettings(userId);
    db.update(schema.conversations)
      .set({
        reportJson: JSON.stringify(report),
        status: "reported",
        // 文字起こしを保存しない設定なら、レポート作成後に削除する
        ...(privacy.saveTranscripts ? {} : { transcriptJson: "[]" }),
      })
      .where(eq(schema.conversations.id, id))
      .run();

    addReviewItems(
      report.corrections.map((x) => ({
        source: "conversation" as const,
        sourceId: id,
        category: x.type,
        prompt: `次の英文をより自然・正確に直してください：\n${x.original}`,
        answer: x.corrected,
        explanation: x.explanation_ja,
      })),
      userId,
    );
    return report;
  } catch (err) {
    db.update(schema.conversations).set({ status: "report_failed" }).where(eq(schema.conversations.id, id)).run();
    throw err;
  }
}
