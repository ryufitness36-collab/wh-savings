import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, parseJson } from "@/lib/api";
import { generatePlan, getCachedPlan } from "@/lib/server/planner";

export const maxDuration = 120;

const minutesSchema = z.coerce
  .number()
  .pipe(z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)]));

/** 今日作成済みのAIプランを返す（作成していなければ plan: null） */
export async function GET(req: Request) {
  try {
    const minutes = minutesSchema.parse(new URL(req.url).searchParams.get("minutes") ?? 15);
    return NextResponse.json({ plan: getCachedPlan(minutes) });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** 学習データをもとにAIが今日の学習プランを作成する（1日1回程度を想定） */
export async function POST(req: Request) {
  try {
    const { minutes } = await parseJson(req, z.object({ minutes: minutesSchema }));
    const plan = await generatePlan(minutes);
    return NextResponse.json({ plan });
  } catch (err) {
    return handleRouteError(err);
  }
}
