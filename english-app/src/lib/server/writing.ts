import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb, LOCAL_USER_ID, schema } from "@/lib/db";
import { generateStructured } from "@/lib/ai/client";
import {
  translationSchema,
  writingCorrectionSchema,
  WRITING_LEVELS,
  type TranslationResult,
  type WritingCorrection,
  type WritingLevel,
} from "@/lib/ai/schemas";
import { newId } from "@/lib/utils";
import { addReviewItems } from "./review";
import { logActivity } from "./activity";

const CORRECT_INSTRUCTIONS = `あなたは日本人英語学習者の英作文を添削するプロの英語講師です。
指定された添削レベルに従って英文を添削してください。
- issues には修正箇所を元の文の順番で挙げ、original は元の文から正確に引用してください。
- explanation_ja は、なぜその修正が必要かを分かりやすい日本語で説明してください（文法用語には簡単な補足を）。
- 誤りがなく自然な場合は corrected_text を元の文のままにし、issues を空にしてください。
- 英語以外（日本語など）が含まれる場合は、その部分を自然な英語にしてください。`;

const TRANSLATE_INSTRUCTIONS = `あなたは日本人英語学習者を指導する英語講師です。
日本語の文を、ネイティブが実際に使う自然な英語に翻訳してください。
直訳ではなく、場面に合った自然な表現を選び、使われている文法や表現を日本語で解説してください。`;

export interface WritingEntry {
  id: string;
  kind: "correct" | "translate";
  level: string;
  input: string;
  result: WritingCorrection | TranslationResult;
  createdAt: number;
}

function save(kind: "correct" | "translate", level: string, input: string, result: unknown, userId: string) {
  const id = newId();
  const createdAt = Date.now();
  getDb()
    .insert(schema.writingEntries)
    .values({ id, userId, kind, level, input, resultJson: JSON.stringify(result), createdAt })
    .run();
  return { id, createdAt };
}

export async function correctWriting(params: { text: string; level: WritingLevel; secondsSpent: number; userId?: string }) {
  const userId = params.userId ?? LOCAL_USER_ID;
  const level = WRITING_LEVELS.find((l) => l.id === params.level)!;
  const result = await generateStructured({
    schema: writingCorrectionSchema,
    name: "writing_correction",
    instructions: CORRECT_INSTRUCTIONS,
    input: `添削レベル: ${level.label}（${level.guide}）\n\n英文:\n${params.text}`,
  });
  const saved = save("correct", params.level, params.text, result, userId);
  logActivity("writing", params.secondsSpent, userId);
  // 文法・語彙・自然さの指摘は復習に登録（スペル・句読点は除外）
  addReviewItems(
    result.issues
      .filter((i) => ["grammar", "vocabulary", "naturalness"].includes(i.type) && i.original.trim() !== i.corrected.trim())
      .slice(0, 5)
      .map((i) => ({
        source: "writing" as const,
        sourceId: saved.id,
        category: i.grammar_category ?? i.type,
        prompt: `次の英語をより自然・正確に直してください：\n${i.original}`,
        answer: i.corrected,
        explanation: i.explanation_ja,
      })),
    userId,
  );
  return { id: saved.id, createdAt: saved.createdAt, result };
}

export async function translateJapanese(params: { text: string; secondsSpent: number; userId?: string }) {
  const userId = params.userId ?? LOCAL_USER_ID;
  const result = await generateStructured({
    schema: translationSchema,
    name: "translation",
    instructions: TRANSLATE_INSTRUCTIONS,
    input: params.text,
  });
  const saved = save("translate", "-", params.text, result, userId);
  logActivity("writing", params.secondsSpent, userId);
  return { id: saved.id, createdAt: saved.createdAt, result };
}

export function listWriting(userId = LOCAL_USER_ID, limit = 30): WritingEntry[] {
  return getDb()
    .select()
    .from(schema.writingEntries)
    .where(eq(schema.writingEntries.userId, userId))
    .orderBy(desc(schema.writingEntries.createdAt))
    .limit(limit)
    .all()
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      level: r.level,
      input: r.input,
      result: JSON.parse(r.resultJson),
      createdAt: r.createdAt,
    }));
}

export function deleteWriting(id: string, userId = LOCAL_USER_ID) {
  getDb()
    .delete(schema.writingEntries)
    .where(and(eq(schema.writingEntries.id, id), eq(schema.writingEntries.userId, userId)))
    .run();
}
