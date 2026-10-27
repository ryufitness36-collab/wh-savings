import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api";
import { generateReport } from "@/lib/server/conversations";

export const maxDuration = 120;

/** 会話後のフィードバックレポートを AI で作成する（失敗時は再実行できる） */
export async function POST(_req: Request, ctx: RouteContext<"/api/conversations/[id]/report">) {
  try {
    const { id } = await ctx.params;
    const report = await generateReport(id);
    return NextResponse.json({ report });
  } catch (err) {
    return handleRouteError(err);
  }
}
