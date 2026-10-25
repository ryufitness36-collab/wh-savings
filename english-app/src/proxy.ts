import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, passwordToken, safeEqual } from "@/lib/auth";

/** APP_PASSWORD が設定されているときだけ、ログインしていないアクセスを止める */
export async function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD?.trim();
  if (!password) return NextResponse.next();

  const cookie = request.cookies.get(AUTH_COOKIE)?.value ?? "";
  const expected = await passwordToken(password);
  if (cookie && safeEqual(cookie, expected)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "ログインが必要です。", code: "unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|login|api/auth).*)",
  ],
};
