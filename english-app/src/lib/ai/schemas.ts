import { z } from "zod";
import { GRAMMAR_CATEGORY_IDS } from "@/lib/learning/grammar";

/** 間違いを分類する文法カテゴリ（当てはまらなければ other） */
const grammarCategoryField = z
  .enum([...GRAMMAR_CATEGORY_IDS, "other"])
  .describe("この間違いに最も関係する文法カテゴリ。当てはまらなければ other");

/**
 * AI（LLM）の出力形式。OpenAI の Structured Outputs で JSON の形を強制する。
 * Structured Outputs の制約により、省略可能なフィールドは使わず nullable / 空配列で表現する。
 */

// ---------- 会話後のフィードバック ----------

const scoreItem = z.object({
  score: z.number().int().min(1).max(10).describe("1-10"),
  comment_ja: z.string().describe("根拠を日本語で1〜2文"),
});

export const conversationReportSchema = z.object({
  title_ja: z.string().describe("会話内容を表す短い日本語タイトル（20文字以内）"),
  summary_ja: z.string().describe("会話の要約（日本語、3〜5文）"),
  corrections: z
    .array(
      z.object({
        type: z.enum(["grammar", "naturalness", "vocabulary"]),
        original: z.string().describe("学習者が実際に話した英文（文字起こしからそのまま引用）"),
        corrected: z.string().describe("より自然で正しい英文"),
        explanation_ja: z.string().describe("なぜ直すのかを日本語で分かりやすく解説"),
        grammar_category: grammarCategoryField,
        related: z.array(z.string()).describe("関連する言い換え表現（1〜2個）"),
      }),
    )
    .describe("文法ミス・不自然な表現・語彙の改善。重要なものから最大10個。"),
  good_expressions: z
    .array(z.object({ expression: z.string(), comment_ja: z.string() }))
    .describe("学習者が上手に使えた表現（最大5個）"),
  improvement_points_ja: z.array(z.string()).describe("次回の改善ポイント（日本語、2〜4個）"),
  review_phrases: z
    .array(
      z.object({
        phrase: z.string().describe("復習したい英語フレーズ"),
        meaning_ja: z.string(),
        example: z.string().describe("フレーズを使った例文"),
      }),
    )
    .describe("今回の会話に関連する、復習すべき英語フレーズちょうど5個"),
  scores: z.object({
    grammar: scoreItem,
    vocabulary: scoreItem,
    fluency: scoreItem,
    engagement: scoreItem.describe("会話の継続力（質問への応答、話を広げる力）"),
  }),
});
export type ConversationReportAI = z.infer<typeof conversationReportSchema>;

/** 会話データから機械的に計算した観察値（AIの推測ではない） */
export interface ConversationMetrics {
  durationSec: number;
  userTurns: number;
  userWords: number;
  avgWordsPerTurn: number;
  userSpeakingSec: number;
  aiSpeakingSec: number;
  /** 発話時間に占める学習者の割合（0〜1）。音声の計測ができなかった場合は null */
  userSpeakingRatio: number | null;
  /** 学習者の発話時間あたりの語数（WPM）。計測できない場合は null */
  wordsPerMinute: number | null;
}

export interface ConversationReport extends ConversationReportAI {
  metrics: ConversationMetrics;
  generatedAt: number;
}

// ---------- 文法問題 ----------

export const generatedQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      format: z.enum(["translation", "multiple_choice", "fill_blank", "reorder", "error_correction"]),
      prompt: z
        .string()
        .describe(
          "translation: 日本語文 / multiple_choice・fill_blank: ___ を1つ含む英文 / reorder: 作るべき英文の日本語訳 / error_correction: 誤りを1つ含む英文",
        ),
      options: z.array(z.string()).describe("multiple_choice のみ4つの選択肢。それ以外は空配列"),
      correct_answer: z
        .string()
        .describe("模範解答。multiple_choice は正しい選択肢の文字列、fill_blank は空欄に入る語句、それ以外は完全な英文"),
      acceptable_answers: z.array(z.string()).describe("他に正解として認められる答え（なければ空配列）"),
      hint_ja: z.string().nullable().describe("必要なら短いヒント（日本語）"),
      explanation_ja: z.string().describe("日本語による文法解説（2〜4文）"),
      grammar_point: z.string().describe("この問題で問う文法ポイント（日本語、短く）"),
    }),
  ),
});
export type GeneratedQuestionsAI = z.infer<typeof generatedQuestionsSchema>;

export const gradeResultSchema = z.object({
  score: z.number().int().min(0).max(10).describe("10点満点。意味が伝わり文法的に正しければ満点。軽微なミスは部分点"),
  is_correct: z.boolean().describe("8点以上なら true"),
  verdict_ja: z.string().describe("一言での判定（例：正解です！ / 惜しい！ / 不正解）"),
  model_answer: z.string().describe("模範解答"),
  explanation_ja: z.string().describe("採点理由と文法解説（日本語）"),
  mistakes: z.array(
    z.object({ part: z.string(), fix: z.string(), reason_ja: z.string() }),
  ).describe("学習者の答えの誤り（なければ空配列）"),
  alternatives: z.array(z.string()).describe("他の自然な正解（0〜3個）"),
});
export type GradeResult = z.infer<typeof gradeResultSchema>;

// ---------- 英作文添削・翻訳 ----------

export const writingCorrectionSchema = z.object({
  corrected_text: z.string().describe("添削後の英文全体"),
  overall_comment_ja: z.string().describe("全体の講評（日本語、2〜3文、良い点も含める）"),
  issues: z.array(
    z.object({
      type: z.enum(["grammar", "vocabulary", "naturalness", "spelling", "punctuation", "style"]),
      original: z.string().describe("元の文の該当部分"),
      corrected: z.string().describe("修正後"),
      explanation_ja: z.string().describe("修正理由（日本語）"),
      grammar_category: grammarCategoryField,
    }),
  ),
  natural_alternatives: z.array(
    z.object({ text: z.string(), note_ja: z.string() }),
  ).describe("より自然な言い方の提案（1〜3個）"),
});
export type WritingCorrection = z.infer<typeof writingCorrectionSchema>;

export const translationSchema = z.object({
  translation: z.string().describe("最も自然な英訳"),
  alternatives: z.array(z.object({ text: z.string(), nuance_ja: z.string() })).describe("別の言い方（1〜3個）とニュアンスの違い"),
  grammar_points: z.array(z.object({ point: z.string(), explanation_ja: z.string() })).describe("英訳に使われている文法・表現の解説（1〜4個）"),
  notes_ja: z.string().nullable().describe("直訳との違いなど補足（なければ null）"),
});
export type TranslationResult = z.infer<typeof translationSchema>;

export const WRITING_LEVELS = [
  { id: "grammar", label: "基本文法のみ", guide: "Fix only clear grammar, spelling and punctuation errors. Keep the learner's wording otherwise." },
  { id: "casual", label: "自然な日常英会話", guide: "Fix errors and make the text sound natural in casual everyday English." },
  { id: "native", label: "ネイティブらしい表現", guide: "Rewrite so it sounds like a fluent native speaker, using idiomatic expressions where appropriate." },
  { id: "business", label: "丁寧なビジネス英語", guide: "Rewrite in polite, professional business English suitable for emails and meetings." },
] as const;
export type WritingLevel = (typeof WRITING_LEVELS)[number]["id"];
export const WRITING_LEVEL_IDS = WRITING_LEVELS.map((l) => l.id) as [WritingLevel, ...WritingLevel[]];

// ---------- AI学習プランナー ----------

export const aiPlanSchema = z.object({
  message_ja: z.string().describe("今日の学習方針を伝える一言（日本語、2文以内、具体的に）"),
  items: z
    .array(
      z.object({
        kind: z.enum(["review", "grammar", "conversation", "writing"]),
        title_ja: z.string().describe("短いタイトル（例：現在完了形の問題）"),
        detail_ja: z.string().describe("やる内容（例：5問・苦手克服ドリル）"),
        reason_ja: z.string().describe("なぜこれを勧めるのか、学習データに基づく理由（日本語1文）"),
        minutes: z.number().int().min(1).max(30),
        grammar_category: z.enum([...GRAMMAR_CATEGORY_IDS, "none"]).describe("kind=grammar のときの分野。それ以外は none"),
        grammar_weak_drill: z.boolean().describe("kind=grammar で、最近の間違いに合わせた苦手克服ドリルにするなら true"),
        question_count: z.number().int().min(0).max(10).describe("kind=grammar/review の問題数。それ以外は 0"),
        conversation_mode: z
          .enum(["free_talk", "daily", "cafe", "travel", "roleplay", "discussion", "grammar_practice", "none"])
          .describe("kind=conversation のときのモード。それ以外は none"),
        scenario_id: z.string().nullable().describe("kind=conversation のときの場面ID（候補から選ぶ）。それ以外は null"),
        writing_topic_ja: z.string().nullable().describe("kind=writing のときの英作文のお題（日本語）。それ以外は null"),
      }),
    )
    .describe("2〜5個。合計時間は指定された学習時間以内"),
});
export type AiPlan = z.infer<typeof aiPlanSchema>;

// ---------- 会話中の返答ヒント ----------

export const replyHintSchema = z.object({
  question_ja: z.string().describe("AI講師が最後に聞いたことの日本語訳（短く）"),
  suggestions: z
    .array(z.object({ en: z.string().describe("学習者が言える返答例（英語）"), ja: z.string().describe("日本語訳") }))
    .describe("学習者のレベルに合った返答例ちょうど3つ（短い答え・少し詳しい答え・質問を返す答え）"),
  tip_ja: z.string().describe("返答に役立つ表現や文法のワンポイント（日本語1文）"),
});
export type ReplyHint = z.infer<typeof replyHintSchema>;

// ---------- 学習傾向の分析 ----------

export const insightsSchema = z.object({
  summary_ja: z.string().describe("学習全体の傾向の要約（日本語、2〜3文、数字を根拠に）"),
  strengths_ja: z.array(z.string()).describe("伸びている点・よくできている点（1〜3個）"),
  challenges_ja: z.array(z.string()).describe("課題（1〜3個、具体的に）"),
  recommendations_ja: z.array(z.string()).describe("来週に向けた具体的な行動提案（2〜3個。アプリの機能名を使ってよい）"),
});
export type Insights = z.infer<typeof insightsSchema>;
