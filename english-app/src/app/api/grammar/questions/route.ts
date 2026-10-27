import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, parseJson } from "@/lib/api";
import { GRAMMAR_CATEGORY_IDS, GRAMMAR_LEVEL_IDS, QUESTION_FORMAT_IDS, isGrammarCategory } from "@/lib/learning/grammar";
import { generateQuestions } from "@/lib/server/grammar";
import { getRecentMistakes } from "@/lib/server/review";
import { getStats } from "@/lib/server/stats";

export const maxDuration = 120;

const bodySchema = z.object({
  category: z.enum(GRAMMAR_CATEGORY_IDS),
  level: z.enum(GRAMMAR_LEVEL_IDS),
  format: z.union([z.enum(QUESTION_FORMAT_IDS), z.literal("mixed")]),
  count: z.number().int().min(1).max(10).default(5),
  /** "weak"：一番苦手な分野を自動で選び、最近の間違いと同じ文法ポイントを出題する（苦手克服ドリル） */
  focus: z.enum(["none", "weak"]).default("none"),
});

/** AIで文法問題を作成する */
export async function POST(req: Request) {
  try {
    const params = await parseJson(req, bodySchema);
    let category = params.category;
    let focusMistakes: { prompt: string; answer: string }[] = [];
    if (params.focus === "weak") {
      const weakest = getStats().weakCategories.find((w) => isGrammarCategory(w.category));
      if (weakest && isGrammarCategory(weakest.category)) category = weakest.category;
      focusMistakes = getRecentMistakes(category);
    }
    const questions = await generateQuestions({ ...params, category, focusMistakes });
    if (questions.length === 0) {
      return NextResponse.json({ error: "問題を作成できませんでした。もう一度お試しください。" }, { status: 502 });
    }
    return NextResponse.json({ questions, category, focused: focusMistakes.length > 0 });
  } catch (err) {
    return handleRouteError(err);
  }
}
