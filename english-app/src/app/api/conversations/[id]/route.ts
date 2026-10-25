import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, LOCAL_USER_ID, schema } from "@/lib/db";
import { handleRouteError, parseJson } from "@/lib/api";
import { requireConversation, saveProgress } from "@/lib/server/conversations";
import { progressSchema } from "@/lib/learning/progress";

export async function GET(_req: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ conversation: requireConversation(id) });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** 会話中の途中保存（通信が切れても記録が残るように） */
export async function PATCH(req: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  try {
    const { id } = await ctx.params;
    const data = await parseJson(req, progressSchema);
    saveProgress(id, data, { finish: false });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  try {
    const { id } = await ctx.params;
    getDb()
      .delete(schema.conversations)
      .where(and(eq(schema.conversations.id, id), eq(schema.conversations.userId, LOCAL_USER_ID)))
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
