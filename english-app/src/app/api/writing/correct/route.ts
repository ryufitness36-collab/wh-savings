import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, parseJson } from "@/lib/api";
import { WRITING_LEVEL_IDS } from "@/lib/ai/schemas";
import { correctWriting } from "@/lib/server/writing";

export const maxDuration = 120;

const bodySchema = z.object({
  text: z.string().trim().min(1, "英文を入力してください").max(4000, "4000文字以内で入力してください"),
  level: z.enum(WRITING_LEVEL_IDS),
  secondsSpent: z.number().min(0).max(3600).default(0),
});

export async function POST(req: Request) {
  try {
    const params = await parseJson(req, bodySchema);
    return NextResponse.json(await correctWriting(params));
  } catch (err) {
    return handleRouteError(err);
  }
}
