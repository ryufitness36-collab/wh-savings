import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, parseJson } from "@/lib/api";
import { grammarQuestionSchema } from "@/lib/learning/grammar";
import { gradeAnswer } from "@/lib/server/grammar";

export const maxDuration = 60;

const bodySchema = z.object({
  question: grammarQuestionSchema,
  userAnswer: z.string().max(1000),
  secondsSpent: z.number().min(0).max(3600),
});

/** 解答を採点する（確実に判定できるものはローカル、それ以外はAI） */
export async function POST(req: Request) {
  try {
    const params = await parseJson(req, bodySchema);
    const graded = await gradeAnswer(params);
    return NextResponse.json(graded);
  } catch (err) {
    return handleRouteError(err);
  }
}
