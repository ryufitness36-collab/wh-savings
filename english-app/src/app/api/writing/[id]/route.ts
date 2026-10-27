import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api";
import { deleteWriting } from "@/lib/server/writing";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/writing/[id]">) {
  try {
    const { id } = await ctx.params;
    deleteWriting(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
