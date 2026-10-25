import { z } from "zod";

/** 英文法問題の出題範囲・形式・難易度 */

export const GRAMMAR_CATEGORIES = [
  { id: "be_verbs", label: "be動詞・一般動詞", topic: "be verbs vs. general verbs (am/is/are, do/does, negatives and questions)" },
  { id: "tenses", label: "現在形・過去形・未来形", topic: "simple present, simple past, future (will / be going to), present and past continuous" },
  { id: "present_perfect", label: "現在完了形", topic: "present perfect (experience, completion, continuation), present perfect vs. past simple" },
  { id: "modals", label: "助動詞", topic: "modal verbs (can, could, may, might, must, have to, should, would)" },
  { id: "comparison", label: "比較級・最上級", topic: "comparatives, superlatives, as ... as, irregular forms" },
  { id: "infinitive_gerund", label: "不定詞・動名詞", topic: "to-infinitives and gerunds, verbs followed by each, purpose infinitives" },
  { id: "relative", label: "関係代名詞", topic: "relative pronouns and clauses (who, which, that, whose, where, omission)" },
  { id: "subjunctive", label: "仮定法", topic: "conditionals and the subjunctive (if I were..., I wish..., would have done)" },
  { id: "prepositions", label: "前置詞", topic: "prepositions of time, place and movement (in/on/at, for/since, by/until)" },
  { id: "passive", label: "受動態", topic: "the passive voice (be + past participle, by-phrases, passive in different tenses)" },
  { id: "participles", label: "分詞", topic: "participles as adjectives (a broken cup, a man standing there), -ing vs -ed adjectives (interesting / interested)" },
  { id: "indirect_questions", label: "間接疑問文", topic: "indirect questions and embedded clauses (Do you know where the station is? I wonder if...)" },
  { id: "conjunctions", label: "接続詞", topic: "conjunctions (because, so, although, while, when, if, unless, as soon as)" },
  { id: "articles_nouns", label: "冠詞・名詞", topic: "articles a/an/the/zero article, countable and uncountable nouns, some/any, much/many" },
  { id: "phrasal_verbs", label: "句動詞", topic: "common phrasal verbs in daily life (pick up, look for, run out of, get along with, put off)" },
  { id: "conversation", label: "日常会話の構文", topic: "useful everyday conversation patterns (Would you like..., How about..., I'm looking for..., Could you...?)" },
] as const;
export type GrammarCategoryId = (typeof GRAMMAR_CATEGORIES)[number]["id"];
export const GRAMMAR_CATEGORY_IDS = GRAMMAR_CATEGORIES.map((c) => c.id) as [GrammarCategoryId, ...GrammarCategoryId[]];

export function isGrammarCategory(id: string): id is GrammarCategoryId {
  return GRAMMAR_CATEGORIES.some((c) => c.id === id);
}

export function grammarCategoryLabel(id: string): string {
  return GRAMMAR_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const GRAMMAR_LEVELS = [
  { id: "basic", label: "初級", guide: "CEFR A1-A2: short sentences, very common vocabulary" },
  { id: "standard", label: "中級", guide: "CEFR B1: everyday situations, moderate sentence length" },
  { id: "advanced", label: "上級", guide: "CEFR B2-C1: natural complex sentences, subtle distinctions" },
] as const;
export type GrammarLevelId = (typeof GRAMMAR_LEVELS)[number]["id"];
export const GRAMMAR_LEVEL_IDS = GRAMMAR_LEVELS.map((l) => l.id) as [GrammarLevelId, ...GrammarLevelId[]];

export const QUESTION_FORMATS = [
  { id: "translation", label: "和文英訳", instruction: "次の日本語を英語にしてください。" },
  { id: "multiple_choice", label: "4択", instruction: "空欄に入る最も適切なものを選んでください。" },
  { id: "fill_blank", label: "空欄補充", instruction: "空欄（___）に入る語句を入力してください。" },
  { id: "reorder", label: "並べ替え", instruction: "語句を並べ替えて、正しい英文を作ってください。" },
  { id: "error_correction", label: "誤文訂正", instruction: "次の英文には誤りがあります。正しい英文に直してください。" },
] as const;
export type QuestionFormat = (typeof QUESTION_FORMATS)[number]["id"];
export const QUESTION_FORMAT_IDS = QUESTION_FORMATS.map((f) => f.id) as [QuestionFormat, ...QuestionFormat[]];

export function formatLabel(id: string): string {
  return QUESTION_FORMATS.find((f) => f.id === id)?.label ?? id;
}

/** 10点満点中、何点以上を「正解」とみなすか */
export const CORRECT_THRESHOLD = 8;

/** 画面に表示し、採点時にサーバーへ送り返す問題データ */
export const grammarQuestionSchema = z.object({
  id: z.string(),
  category: z.enum(GRAMMAR_CATEGORY_IDS),
  level: z.enum(GRAMMAR_LEVEL_IDS),
  format: z.enum(QUESTION_FORMAT_IDS),
  instruction_ja: z.string(),
  prompt: z.string().max(1000),
  /** 4択の選択肢、または並べ替えの語句（シャッフル済み） */
  options: z.array(z.string().max(200)).max(30),
  correct_answer: z.string().max(1000),
  acceptable_answers: z.array(z.string().max(1000)).max(10),
  hint_ja: z.string().nullable(),
  explanation_ja: z.string().max(3000),
  grammar_point: z.string().max(200),
});
export type GrammarQuestion = z.infer<typeof grammarQuestionSchema>;
