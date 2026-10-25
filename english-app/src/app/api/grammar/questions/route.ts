import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, parseJson } from "@/lib/api";
import { GRAMMAR_CATEGORY_IDS, GRAMMAR_LEVEL_IDS, QUESTION_FORMAT_IDS } from "@/lib/learning/grammar";
import { generateQuestions } from "@/lib/server/grammar";

export const maxDuration = 120;

const bodySchema = z.object({
  category: z.enum(GRAMMAR_CATEGORY_IDS),
  level: z.enum(GRAMMAR_LEVEL_IDS),
  format: z.union([z.enum(QUESTION_FORMAT_IDS), z.literal("mixed")]),
  count: z.number().int().min(1).max(10).default(5),
});

/** AIで文法問題を作成する */
export async function POST(req: Request) {
  try {
    const params = await parseJson(req, bodySchema);
    const questions = await generateQuestions(params);
    if (questions.length === 0) {
      return NextResponse.json({ error: "問題を作成できませんでした。もう一度お試しください。" }, { status: 502 });
    }
    return NextResponse.json({ questions });
  } catch (err) {
    return handleRouteError(err);
  }
}
