import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, parseJson } from "@/lib/api";
import { AppError } from "@/lib/ai/client";
import { logActivity } from "@/lib/server/activity";
import { archiveReviewItem, rateReviewItem } from "@/lib/server/review";

const bodySchema = z.object({
  rating: z.enum(["again", "hard", "good", "easy"]),
  secondsSpent: z.number().min(0).max(3600).default(0),
});

/** 自己評価に応じて次回の復習日を決める（間隔反復） */
export async function POST(req: Request, ctx: RouteContext<"/api/review/[id]">) {
  try {
    const { id } = await ctx.params;
    const { rating, secondsSpent } = await parseJson(req, bodySchema);
    const next = rateReviewItem(id, rating);
    if (!next) throw new AppError("復習項目が見つかりません。", 404, "not_found");
    logActivity("review", secondsSpent);
    return NextResponse.json({ next });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** 「もう覚えた」項目を復習リストから外す */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/review/[id]">) {
  try {
    const { id } = await ctx.params;
    archiveReviewItem(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
