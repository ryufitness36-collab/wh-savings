import { NextResponse } from "next/server";
import { handleRouteError, parseJson } from "@/lib/api";
import { goalsSchema, saveGoals } from "@/lib/server/settings";

/** 学習目標（週の学習時間）を保存する */
export async function PUT(req: Request) {
  try {
    const goals = await parseJson(req, goalsSchema);
    saveGoals(goals);
    return NextResponse.json({ goals });
  } catch (err) {
    return handleRouteError(err);
  }
}
