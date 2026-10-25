import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb, LOCAL_USER_ID, schema } from "@/lib/db";
import { generateStructured } from "@/lib/ai/client";
import { generatedQuestionsSchema, gradeResultSchema, type GeneratedQuestionsAI, type GradeResult } from "@/lib/ai/schemas";
import {
  CORRECT_THRESHOLD,
  GRAMMAR_CATEGORIES,
  GRAMMAR_LEVELS,
  QUESTION_FORMATS,
  type GrammarCategoryId,
  type GrammarLevelId,
  type GrammarQuestion,
  type QuestionFormat,
} from "@/lib/learning/grammar";
import { gradeLocally, shuffleDifferent, tokenizeForReorder, answersMatch } from "@/lib/learning/grading";
import { newId } from "@/lib/utils";
import { addReviewItems } from "./review";
import { logActivity } from "./activity";

const GENERATE_INSTRUCTIONS = `You are an expert English teacher who writes grammar exercises for Japanese learners.
Write natural, correct, unambiguous questions about the requested grammar topic.
Rules per format:
- translation: prompt is a natural Japanese sentence. correct_answer is a natural English translation. Put other natural translations in acceptable_answers.
- multiple_choice: prompt is an English sentence containing exactly one "___". options has exactly 4 distinct choices, only one correct. correct_answer is exactly one of the options.
- fill_blank: prompt is an English sentence containing exactly one "___" (add the Japanese meaning in parentheses at the end). correct_answer is the word(s) for the blank. Put other correct fillers in acceptable_answers.
- reorder: prompt is the Japanese meaning of the target sentence. correct_answer is the English sentence (5-12 words). options must be an empty array (the app shuffles the words itself).
- error_correction: prompt is an English sentence with exactly ONE grammar error related to the topic. correct_answer is the fully corrected sentence.
Write explanation_ja and hint_ja in clear, friendly Japanese suitable for learners. Do not reveal the answer in hint_ja.
Make questions practical: everyday life, travel, cafes, friends, work.`;

export async function generateQuestions(params: {
  category: GrammarCategoryId;
  level: GrammarLevelId;
  format: QuestionFormat | "mixed";
  count: number;
  userId?: string;
}): Promise<GrammarQuestion[]> {
  const userId = params.userId ?? LOCAL_USER_ID;
  const category = GRAMMAR_CATEGORIES.find((c) => c.id === params.category)!;
  const level = GRAMMAR_LEVELS.find((l) => l.id === params.level)!;

  // 最近出題した問題と重複しないように伝える
  const recent = getDb()
    .select({ q: schema.grammarAttempts.questionJson })
    .from(schema.grammarAttempts)
    .where(and(eq(schema.grammarAttempts.userId, userId), eq(schema.grammarAttempts.category, params.category)))
    .orderBy(desc(schema.grammarAttempts.createdAt))
    .limit(15)
    .all()
    .map((r) => (JSON.parse(r.q) as GrammarQuestion).prompt);

  const formatText =
    params.format === "mixed"
      ? `Use a mix of formats (translation, multiple_choice, fill_blank, reorder, error_correction), at least 3 different formats.`
      : `All questions must use the format: ${params.format}.`;

  const ai = await generateStructured({
    schema: generatedQuestionsSchema,
    name: "grammar_questions",
    instructions: GENERATE_INSTRUCTIONS,
    input: [
      `Grammar topic: ${category.topic}`,
      `Difficulty: ${level.label} (${level.guide})`,
      `Number of questions: ${params.count}`,
      formatText,
      recent.length ? `Avoid repeating these recent questions:\n${recent.map((r) => `- ${r}`).join("\n")}` : "",
    ].join("\n"),
  });

  return postProcess(ai, params.category, params.level).slice(0, params.count);
}

/** AIが作った問題を検証し、選択肢や並べ替え語句をアプリ側でシャッフルする */
export function postProcess(ai: GeneratedQuestionsAI, category: GrammarCategoryId, level: GrammarLevelId): GrammarQuestion[] {
  const result: GrammarQuestion[] = [];
  for (const q of ai.questions) {
    const format = q.format;
    const instruction = QUESTION_FORMATS.find((f) => f.id === format)!.instruction;
    const correct = q.correct_answer.trim();
    if (!correct || !q.prompt.trim()) continue;
    let options: string[] = [];
    if (format === "multiple_choice") {
      const unique = [...new Set(q.options.map((o) => o.trim()).filter(Boolean))];
      if (!unique.some((o) => answersMatch(o, correct))) continue;
      if (unique.length < 3) continue;
      options = shuffleDifferent(unique.slice(0, 4));
    } else if (format === "reorder") {
      const tokens = tokenizeForReorder(correct);
      if (tokens.length < 3) continue;
      options = shuffleDifferent(tokens);
    } else if (format === "fill_blank") {
      if (!q.prompt.includes("___")) continue;
    }
    result.push({
      id: newId(),
      category,
      level,
      format,
      instruction_ja: instruction,
      prompt: q.prompt.trim(),
      options,
      correct_answer: correct,
      acceptable_answers: q.acceptable_answers.map((a) => a.trim()).filter(Boolean),
      hint_ja: q.hint_ja,
      explanation_ja: q.explanation_ja,
      grammar_point: q.grammar_point,
    });
  }
  return result;
}

const GRADE_INSTRUCTIONS = `あなたは日本人英語学習者の解答を採点する英語講師です。
単純な文字列一致ではなく、意味と文法で採点してください。模範解答と違っても、自然で正しく、問題の意図（問われている文法事項）を満たしていれば満点です。
採点基準（10点満点）:
- 10: 正しく自然。模範解答と別の言い方でもOK
- 8-9: ほぼ正解。ごく小さなミス（冠詞・スペル・大文字など）が1つ
- 5-7: 意味は伝わるが文法ミスがある、または問われている文法事項を正しく使えていない
- 1-4: 大きな誤りがあり意味が十分に伝わらない
- 0: 無回答・全く無関係
is_correct は8点以上で true。解説は日本語で、学習者が次に間違えないよう具体的に。`;

export async function gradeAnswer(params: {
  question: GrammarQuestion;
  userAnswer: string;
  secondsSpent: number;
  userId?: string;
}): Promise<{ result: GradeResult; gradedBy: "local" | "ai" }> {
  const { question: q, userAnswer } = params;
  const userId = params.userId ?? LOCAL_USER_ID;
  const local = gradeLocally(
    { format: q.format, correctAnswer: q.correct_answer, acceptableAnswers: q.acceptable_answers },
    userAnswer,
  );

  let result: GradeResult;
  let gradedBy: "local" | "ai";
  if (local.decided) {
    gradedBy = "local";
    result = {
      score: local.score,
      is_correct: local.isCorrect,
      verdict_ja: local.isCorrect ? "正解です！" : userAnswer.trim() === "" ? "未回答です" : "不正解",
      model_answer: q.correct_answer,
      explanation_ja: q.explanation_ja,
      mistakes: [],
      alternatives: q.acceptable_answers.filter((a) => !answersMatch(a, userAnswer)).slice(0, 3),
    };
  } else {
    gradedBy = "ai";
    result = await generateStructured({
      schema: gradeResultSchema,
      name: "grade_result",
      instructions: GRADE_INSTRUCTIONS,
      input: [
        `Question format: ${q.format}`,
        `Instruction: ${q.instruction_ja}`,
        `Question: ${q.prompt}`,
        q.format === "reorder" ? `Words given: ${q.options.join(" / ")} (the learner must use all of these words)` : "",
        `Grammar point: ${q.grammar_point}`,
        `Model answer: ${q.correct_answer}`,
        q.acceptable_answers.length ? `Other accepted answers: ${q.acceptable_answers.join(" | ")}` : "",
        `Learner's answer: ${userAnswer}`,
      ].filter(Boolean).join("\n"),
      maxOutputTokens: 3000,
    });
    // モデルの判定と点数の整合性をとる
    result.is_correct = result.score >= CORRECT_THRESHOLD;
  }

  const attemptId = newId();
  getDb()
    .insert(schema.grammarAttempts)
    .values({
      id: attemptId,
      userId,
      category: q.category,
      level: q.level,
      format: q.format,
      questionJson: JSON.stringify(q),
      userAnswer,
      score: result.score,
      isCorrect: result.is_correct,
      feedbackJson: JSON.stringify(result),
      secondsSpent: Math.round(params.secondsSpent),
      createdAt: Date.now(),
    })
    .run();
  logActivity("grammar", params.secondsSpent, userId);

  if (!result.is_correct) {
    const prompt =
      q.format === "translation" || q.format === "reorder"
        ? `英語にしてください：\n${q.prompt}`
        : q.format === "error_correction"
          ? `次の英文の誤りを直してください：\n${q.prompt}`
          : `空欄を埋めて英文を完成させてください：\n${q.prompt}`;
    const answer =
      q.format === "multiple_choice" || q.format === "fill_blank"
        ? q.prompt.replace("___", q.correct_answer)
        : q.correct_answer;
    addReviewItems(
      [{ source: "grammar", sourceId: attemptId, category: q.category, prompt, answer, explanation: result.explanation_ja }],
      userId,
    );
  }

  return { result, gradedBy };
}
