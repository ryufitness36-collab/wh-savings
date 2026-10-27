import "server-only";

/**
 * サーバー側でのみ読み込む環境変数。
 * ブラウザに公開されないよう、NEXT_PUBLIC_ は付けない。
 */
function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const env = {
  get openaiApiKey() {
    return read("OPENAI_API_KEY");
  },
  get realtimeModel() {
    return read("OPENAI_REALTIME_MODEL") ?? "gpt-realtime";
  },
  get transcribeModel() {
    return read("OPENAI_TRANSCRIBE_MODEL") ?? "gpt-4o-mini-transcribe";
  },
  get textModel() {
    return read("OPENAI_TEXT_MODEL") ?? "gpt-5.4-mini";
  },
  get databasePath() {
    return read("DATABASE_PATH") ?? "./data/app.db";
  },
  get timezone() {
    return read("APP_TIMEZONE") ?? "Asia/Tokyo";
  },
  get appPassword() {
    return read("APP_PASSWORD");
  },
};

export function isOpenAIConfigured(): boolean {
  return Boolean(env.openaiApiKey);
}
