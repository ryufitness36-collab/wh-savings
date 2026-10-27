import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, LOCAL_USER_ID, schema } from "@/lib/db";
import { AppError } from "@/lib/ai/client";
import { handleRouteError, parseJson } from "@/lib/api";
import { ratingFromScore } from "@/lib/learning/srs";
import { gradeReviewAnswer } from "@/lib/server/grammar";

export const maxDuration = 60;

const bodySchema = z.object({ answer: z.string().trim().min(1, "答えを入力してください").max(1000) });

/** 復習問題の答えをAIで採点し、おすすめの自己評価を返す */
export async function POST(req: Request, ctx: RouteContext<"/api/review/[id]/check">) {
  try {
    const { id } = await ctx.params;
    const { answer } = await parseJson(req, bodySchema);
    const item = getDb()
      .select()
      .from(schema.reviewItems)
      .where(and(eq(schema.reviewItems.id, id), eq(schema.reviewItems.userId, LOCAL_USER_ID)))
      .get();
    if (!item) throw new AppError("復習項目が見つかりません。", 404, "not_found");
    const graded = await gradeReviewAnswer(item, answer);
    return NextResponse.json({ ...graded, suggestedRating: ratingFromScore(graded.result.score) });
  } catch (err) {
    return handleRouteError(err);
  }
}
