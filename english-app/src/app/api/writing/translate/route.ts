import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, parseJson } from "@/lib/api";
import { translateJapanese } from "@/lib/server/writing";

export const maxDuration = 120;

const bodySchema = z.object({
  text: z.string().trim().min(1, "日本語を入力してください").max(2000, "2000文字以内で入力してください"),
  secondsSpent: z.number().min(0).max(3600).default(0),
});

export async function POST(req: Request) {
  try {
    const params = await parseJson(req, bodySchema);
    return NextResponse.json(await translateJapanese(params));
  } catch (err) {
    return handleRouteError(err);
  }
}
