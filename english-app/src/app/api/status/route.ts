import { NextResponse } from "next/server";
import { env, isOpenAIConfigured } from "@/lib/env";

/** APIキーの設定状況（キーそのものは返さない） */
export async function GET() {
  return NextResponse.json({
    openai: isOpenAIConfigured(),
    models: {
      realtime: env.realtimeModel,
      transcribe: env.transcribeModel,
      text: env.textModel,
    },
    passwordProtected: Boolean(env.appPassword),
  });
}
