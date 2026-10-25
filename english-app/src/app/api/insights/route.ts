import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api";
import { generateInsights, getCachedInsights } from "@/lib/server/insights";

export const maxDuration = 120;

/** 今日作成済みの学習傾向の分析（なければ null） */
export async function GET() {
  try {
    return NextResponse.json({ insights: getCachedInsights() });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** AIで学習傾向を分析する（1日1回程度を想定） */
export async function POST() {
  try {
    return NextResponse.json({ insights: await generateInsights() });
  } catch (err) {
    return handleRouteError(err);
  }
}
