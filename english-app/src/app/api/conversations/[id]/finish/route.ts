import { NextResponse } from "next/server";
import { handleRouteError, parseJson } from "@/lib/api";
import { logActivity } from "@/lib/server/activity";
import { requireConversation, saveProgress } from "@/lib/server/conversations";
import { progressSchema } from "@/lib/learning/progress";

/** 会話の終了：記録を確定し、学習時間を記録する */
export async function POST(req: Request, ctx: RouteContext<"/api/conversations/[id]/finish">) {
  try {
    const { id } = await ctx.params;
    const data = await parseJson(req, progressSchema);
    const before = requireConversation(id);
    saveProgress(id, data, { finish: true });
    // 二重送信しても学習時間が二重に記録されないようにする
    if (before.status === "active") logActivity("conversation", data.durationSec);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
