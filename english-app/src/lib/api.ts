import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, toAppError } from "@/lib/ai/client";

/** API ルートのエラーを JSON で返す共通ハンドラ */
export function handleRouteError(err: unknown) {
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: `入力内容が正しくありません：${err.issues[0]?.message ?? ""}`, code: "invalid_input", details: err.issues.slice(0, 5) },
      { status: 400 },
    );
  }
  const appErr = err instanceof AppError ? err : toAppError(err);
  if (appErr.status >= 500) console.error("[api]", err);
  return NextResponse.json({ error: appErr.message, code: appErr.code }, { status: appErr.status });
}

export async function parseJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError("リクエストの形式が正しくありません。", 400, "invalid_json");
  }
  return schema.parse(body);
}
