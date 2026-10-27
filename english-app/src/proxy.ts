import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isRemoteRequest, passwordToken, safeEqual } from "@/lib/auth";

const NEED_PASSWORD_MESSAGE =
  "インターネット経由でアクセスするには、パスワードの設定が必要です。.env.local に APP_PASSWORD=好きなパスワード を書いて、アプリを再起動してください。";

/**
 * アクセス制御。
 * - APP_PASSWORD 未設定：自分のPC・家のネットワーク内からのアクセスだけを許可し、
 *   インターネット経由（トンネルなど）のアクセスは止める（他人にAPIを使われないため）
 * - APP_PASSWORD 設定済み：ログインしていないアクセスをログイン画面へ
 */
export async function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD?.trim();
  if (!password) {
    if (!isRemoteRequest(request.headers)) return NextResponse.next();
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: NEED_PASSWORD_MESSAGE, code: "password_required" }, { status: 403 });
    }
    return new NextResponse(
      `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>パスワードの設定が必要です</title></head>` +
        `<body style="font-family:-apple-system,'Hiragino Sans',sans-serif;max-width:420px;margin:15vh auto;padding:0 20px;line-height:1.8;color:#1c2230">` +
        `<h1 style="font-size:20px">パスワードの設定が必要です</h1><p>${NEED_PASSWORD_MESSAGE}</p></body></html>`,
      { status: 403, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

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
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|icons/|manifest.webmanifest|sw.js|offline.html|login|api/auth).*)",
  ],
};
