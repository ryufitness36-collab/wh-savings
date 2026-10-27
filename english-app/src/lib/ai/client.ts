import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { env } from "@/lib/env";

/** API キー未設定などをユーザー向けメッセージ付きで伝えるエラー */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly code: string = "internal_error",
  ) {
    super(message);
  }
}

let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  const apiKey = env.openaiApiKey;
  if (!apiKey) {
    throw new AppError(
      "OpenAI APIキーが設定されていません。.env.local に OPENAI_API_KEY を設定して、アプリを再起動してください。",
      503,
      "missing_api_key",
    );
  }
  if (!cached) {
    cached = new OpenAI({ apiKey, maxRetries: 2, timeout: 60_000 });
  }
  return cached;
}

/** OpenAI SDK のエラーを日本語のメッセージに変換する */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof OpenAI.APIError) {
    const status = err.status ?? 502;
    if (status === 401) return new AppError("OpenAI APIキーが無効です。キーが正しいか確認してください。", 401, "invalid_api_key");
    if (status === 429) {
      return new AppError(
        "OpenAI APIの利用上限に達したか、混み合っています。少し待ってから再度お試しください（残高・利用上限も確認してください）。",
        429,
        "rate_limited",
      );
    }
    if (status === 404) return new AppError(`指定したモデルが見つからないか、利用権限がありません（${err.message}）`, 404, "model_not_found");
    return new AppError(`OpenAI APIでエラーが発生しました（${status}）：${err.message}`, 502, "upstream_error");
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return new AppError("OpenAI APIに接続できませんでした。インターネット接続を確認してください。", 502, "connection_error");
  }
  const message = err instanceof Error ? err.message : String(err);
  return new AppError(`予期しないエラーが発生しました：${message}`, 500);
}

/**
 * JSON の形を指定してテキストモデルを呼び出す（Responses API + Structured Outputs）。
 * store: false で OpenAI 側に会話を保存しない。
 */
export async function generateStructured<T extends z.ZodType>(opts: {
  schema: T;
  name: string;
  instructions: string;
  input: string;
  maxOutputTokens?: number;
}): Promise<z.infer<T>> {
  const client = getOpenAI();
  try {
    const response = await client.responses.parse({
      model: env.textModel,
      instructions: opts.instructions,
      input: opts.input,
      store: false,
      max_output_tokens: opts.maxOutputTokens ?? 8000,
      text: { format: zodTextFormat(opts.schema, opts.name) },
    });
    if (!response.output_parsed) {
      throw new AppError("AIの応答を読み取れませんでした。もう一度お試しください。", 502, "empty_output");
    }
    return response.output_parsed as z.infer<T>;
  } catch (err) {
    throw toAppError(err);
  }
}
