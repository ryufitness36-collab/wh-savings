import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, parseJson } from "@/lib/api";
import { AUTH_COOKIE, isHttpsRequest, passwordToken, safeEqual } from "@/lib/auth";
import { env } from "@/lib/env";

const bodySchema = z.object({ password: z.string().max(200) });

export async function POST(req: Request) {
  try {
    const { password } = await parseJson(req, bodySchema);
    const expected = env.appPassword;
    if (!expected) return NextResponse.json({ ok: true });
    const [given, correct] = await Promise.all([passwordToken(password), passwordToken(expected)]);
    if (!safeEqual(given, correct)) {
      // 総当たり対策として少し待つ
      await new Promise((r) => setTimeout(r, 800));
      return NextResponse.json({ error: "パスワードが違います。" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, correct, {
      httpOnly: true,
      sameSite: "lax",
      // トンネル経由（https）では secure、Mac の http://localhost では付けない（Safari で保存されないため）
      secure: isHttpsRequest(req.url, req.headers),
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
